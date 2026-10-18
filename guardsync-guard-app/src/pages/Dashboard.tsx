import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, Clock, LogIn, LogOut, Shield, ChevronRight, 
  AlertTriangle, CheckCircle, Bell,
  Navigation, CalendarDays, Moon, Send, X, Loader2, Scan,
  Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { WakeAlert } from '@/types/guard';
import { FacialScanner } from '@/components/FacialScanner';
import { 
  submitConveyanceRequest, 
  getConveyanceStatus, 
  cancelConveyanceRequest,
  ConveyanceRequest,
  sendSOSAlert,
  clockOut,
  updateGuardLocation,
  verifyFace,
  getGuardStats,
  GuardStats,
} from '@/services/GuardAPI';
import { descriptorToString } from '@/services/FaceApiService';
import { errorMessage } from '@/lib/apiError';

// Location sync interval (30 seconds)
const LOCATION_SYNC_INTERVAL = 30 * 1000;

// Wake Alert constants
const WAKE_ALERT_TIMEOUT = 120; // 120 seconds to respond
const MIN_WAKE_INTERVAL = 30 * 60 * 1000; // 30 minutes minimum
const MAX_WAKE_INTERVAL = 90 * 60 * 1000; // 90 minutes maximum

export default function Dashboard() {
  const navigate = useNavigate();
  const { guard, site, updateGuard } = useAuth();
  const { toast } = useToast();
  // On duty is driven by the guard's clock-in status, so it survives navigation and reloads
  const [isCheckedIn, setIsCheckedIn] = useState(guard?.status === 'active');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    setIsCheckedIn(guard?.status === 'active');
  }, [guard?.status]);

  // A guard can only check in once they have been assigned to a site
  const hasSite = !!(guard?.siteId || guard?.currentShift?.siteId || site?.id);

  const handleCheckOut = async () => {
    if (!guard?.id || isCheckingOut) return;
    setIsCheckingOut(true);
    try {
      const response = await clockOut(guard.id, { latitude: 0, longitude: 0, withinGeofence: true });
      if (!response.success) {
        throw new Error(errorMessage(response.error, 'Could not log your check-out. Please try again.'));
      }
      updateGuard({ status: 'off-duty' });
      toast({ title: 'Checked Out', description: 'Your shift has been logged.' });
    } catch (err) {
      console.error('Check-out error:', err);
      toast({
        title: 'Check-out Failed',
        description: errorMessage(err, 'Could not log your check-out. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setIsCheckingOut(false);
    }
  };
  
  // The guard's real numbers from the server (a dash until they arrive)
  const [guardStats, setGuardStats] = useState<GuardStats | null>(null);
  
  // Conveyance request state
  const [showConveyanceDialog, setShowConveyanceDialog] = useState(false);
  const [conveyanceReason, setConveyanceReason] = useState('');
  const [conveyanceStatus, setConveyanceStatus] = useState<ConveyanceRequest | null>(null);
  const [isSubmittingConveyance, setIsSubmittingConveyance] = useState(false);
  const conveyancePollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Wake alert state
  const [wakeAlertActive, setWakeAlertActive] = useState(false);
  const [wakeAlertTimer, setWakeAlertTimer] = useState(WAKE_ALERT_TIMEOUT);
  const [wakeAlertTriggeredAt, setWakeAlertTriggeredAt] = useState<Date | null>(null);
  const [wakeAlertLogs, setWakeAlertLogs] = useState<WakeAlert[]>([]);
  const wakeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wakeCountdownRef = useRef<NodeJS.Timeout | null>(null);
  
  // Wake alert face verification state
  const [showWakeFaceVerify, setShowWakeFaceVerify] = useState(false);
  const [isWakeFaceVerified, setIsWakeFaceVerified] = useState(false);

  // SOS alert state
  const [showSOSDialog, setShowSOSDialog] = useState(false);
  const [sosMessage, setSosMessage] = useState('');
  const [isSubmittingSOS, setIsSubmittingSOS] = useState(false);
  const [sosActive, setSosActive] = useState(false);

  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Check if current shift is a night shift
  const isNightShift = useCallback(() => {
    if (!guard?.currentShift) return false;
    const startHour = parseInt(guard.currentShift.startTime.split(':')[0]);
    // Night shift: starts between 8PM (20) and 6AM (6)
    return startHour >= 20 || startHour < 6 || guard.currentShift.isNightShift;
  }, [guard]);

  // Generate random interval for wake alerts
  const getRandomInterval = () => {
    return Math.floor(Math.random() * (MAX_WAKE_INTERVAL - MIN_WAKE_INTERVAL)) + MIN_WAKE_INTERVAL;
  };

  // Trigger wake alert
  const triggerWakeAlert = useCallback(() => {
    if (!isCheckedIn || !isNightShift()) return;
    
    setWakeAlertActive(true);
    setWakeAlertTimer(WAKE_ALERT_TIMEOUT);
    setWakeAlertTriggeredAt(new Date());
    setIsWakeFaceVerified(false); // Reset face verification for each alert

    // Start countdown
    wakeCountdownRef.current = setInterval(() => {
      setWakeAlertTimer(prev => {
        if (prev <= 1) {
          // Time's up - missed alert
          clearInterval(wakeCountdownRef.current!);
          handleWakeAlertMissed();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isCheckedIn, isNightShift]);

  // The server compares the scan with the enrolled face; the app never holds the enrolled face
  const verifyOwnFace = async (descriptor: Float32Array) => {
    if (!guard?.id) return false;
    const result = await verifyFace(guard.id, descriptorToString(descriptor));
    return result.success && result.data?.match === true;
  };

  // Handle face verification for wake alert
  const handleWakeFaceVerify = (success: boolean) => {
    setShowWakeFaceVerify(false);
    if (success) {
      setIsWakeFaceVerified(true);
      toast({
        title: 'Face Verified',
        description: 'Now press the "I\'m Awake!" button to confirm.',
      });
    } else {
      toast({
        title: 'Verification Failed',
        description: 'Face not recognized. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle wake alert response
  const handleWakeAlertResponse = () => {
    // Only allow response if face is verified (when guard has face descriptor)
    if (guard?.faceEnrolled && !isWakeFaceVerified) {
      toast({
        title: 'Face Verification Required',
        description: 'Please verify your face before confirming.',
        variant: 'destructive',
      });
      return;
    }

    if (wakeCountdownRef.current) {
      clearInterval(wakeCountdownRef.current);
    }

    const responseTime = wakeAlertTriggeredAt 
      ? Math.round((Date.now() - wakeAlertTriggeredAt.getTime()) / 1000)
      : 0;

    const log: WakeAlert = {
      id: `wa-${Date.now()}`,
      guardId: guard?.id || '1',
      shiftId: guard?.currentShift?.id,
      triggeredAt: wakeAlertTriggeredAt?.toISOString() || new Date().toISOString(),
      respondedAt: new Date().toISOString(),
      status: 'success',
      responseTimeSeconds: responseTime,
    };

    setWakeAlertLogs(prev => [...prev, log]);
    setWakeAlertActive(false);
    setWakeAlertTriggeredAt(null);

    toast({
      title: 'Alert Acknowledged',
      description: `Response time: ${responseTime} seconds. Stay alert!`,
    });

    // Schedule next wake alert
    scheduleNextWakeAlert();
  };

  // Handle missed wake alert
  const handleWakeAlertMissed = () => {
    const log: WakeAlert = {
      id: `wa-${Date.now()}`,
      guardId: guard?.id || '1',
      shiftId: guard?.currentShift?.id,
      triggeredAt: wakeAlertTriggeredAt?.toISOString() || new Date().toISOString(),
      status: 'missed',
    };

    setWakeAlertLogs(prev => [...prev, log]);
    setWakeAlertActive(false);
    setWakeAlertTriggeredAt(null);
    // Time is up, so close the face scanner too if it is still open
    setShowWakeFaceVerify(false);

    toast({
      title: 'Alert Missed!',
      description: 'You did not respond in time. This has been logged.',
      variant: 'destructive',
    });

    // Schedule next wake alert
    scheduleNextWakeAlert();
  };

  // Schedule next wake alert
  const scheduleNextWakeAlert = useCallback(() => {
    if (wakeIntervalRef.current) {
      clearTimeout(wakeIntervalRef.current);
    }

    if (!isCheckedIn || !isNightShift()) return;

    const interval = getRandomInterval();
    console.log(`Next wake alert in ${Math.round(interval / 60000)} minutes`);
    
    wakeIntervalRef.current = setTimeout(() => {
      triggerWakeAlert();
    }, interval);
  }, [isCheckedIn, isNightShift, triggerWakeAlert]);

  // ============ Conveyance Request Functions ============
  
  // Check for active conveyance request on mount and poll for updates
  useEffect(() => {
    const checkConveyanceStatus = async () => {
      if (!guard?.id) return;
      
      try {
        const response = await getConveyanceStatus(guard.id);
        if (response.success && response.data) {
          setConveyanceStatus(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch conveyance status:', error);
      }
    };

    // Initial check
    checkConveyanceStatus();

    // Poll every 30 seconds if there's a pending request
    if (conveyanceStatus?.status === 'pending') {
      conveyancePollingRef.current = setInterval(checkConveyanceStatus, 30000);
    }

    return () => {
      if (conveyancePollingRef.current) {
        clearInterval(conveyancePollingRef.current);
      }
    };
  }, [guard?.id, conveyanceStatus?.status]);

  // Handle status updates
  useEffect(() => {
    if (conveyanceStatus?.status === 'approved') {
      toast({
        title: 'Conveyance Approved! ✓',
        description: 'Your request has been approved. You may leave the geofence.',
      });
    } else if (conveyanceStatus?.status === 'denied') {
      toast({
        title: 'Conveyance Denied',
        description: conveyanceStatus.staffNotes || 'Your request was denied.',
        variant: 'destructive',
      });
      // Clear the status after showing denial
      setTimeout(() => setConveyanceStatus(null), 5000);
    }
  }, [conveyanceStatus?.status]);

  const handleSubmitConveyanceRequest = async () => {
    if (!guard?.id || !conveyanceReason.trim()) return;

    setIsSubmittingConveyance(true);
    
    try {
      const siteId = guard.siteId || guard.currentShift?.siteId || site?.id;
      const response = await submitConveyanceRequest({
        guardId: guard.id,
        ...(siteId ? { siteId } : {}),
        reason: conveyanceReason.trim(),
        estimatedDuration: 30,
      });

      if (response.success && response.data) {
        setConveyanceStatus(response.data);
        setShowConveyanceDialog(false);
        setConveyanceReason('');
        toast({
          title: 'Request Submitted',
          description: 'Your conveyance request is pending approval.',
        });
      } else {
        toast({
          title: 'Request Failed',
          description: errorMessage(response.error, 'Could not submit request'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit conveyance request',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingConveyance(false);
    }
  };

  const handleCancelConveyanceRequest = async () => {
    if (!conveyanceStatus?.id) return;

    try {
      const response = await cancelConveyanceRequest(conveyanceStatus.id);
      if (response.success) {
        setConveyanceStatus(null);
        toast({
          title: 'Request Cancelled',
          description: 'Your conveyance request has been cancelled.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel request',
        variant: 'destructive',
      });
    }
  };

  // ============ SOS Alert Functions ============
  const handleSubmitSOS = async () => {
    if (!guard?.id) return;

    setIsSubmittingSOS(true);
    
    try {
      // Get current location
      let lat: number | undefined;
      let lng: number | undefined;
      
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
            });
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        } catch (e) {
          console.warn('Could not get location for SOS:', e);
        }
      }

      // Leave out what isn't known (no site yet, no location) rather than send null
      const siteId = guard.siteId || guard.currentShift?.siteId || site?.id;
      const siteName = site?.name || guard.currentShift?.location;
      const response = await sendSOSAlert({
        guardId: guard.id,
        guardName: guard.name,
        ...(siteId ? { siteId } : {}),
        ...(siteId && siteName ? { siteName } : {}),
        lat,
        lng,
        message: sosMessage.trim() || 'Emergency SOS Alert',
      });

      if (!response.success) throw new Error(errorMessage(response.error, 'Could not send the alert.'));

      setSosActive(true);
      setShowSOSDialog(false);
      setSosMessage('');
      
      toast({
        title: '🚨 SOS Alert Sent!',
        description: 'Help is on the way. Stay safe.',
      });
    } catch (error) {
      console.error('SOS submit error:', error);
      toast({
        title: 'SOS Failed',
        description: `${errorMessage(error, 'Could not send the alert.')} Try calling emergency services.`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingSOS(false);
    }
  };

  // Start wake alert system when checked in during night shift
  useEffect(() => {
    if (isCheckedIn && isNightShift()) {
      // Start with first alert after 5 minutes for demo
      wakeIntervalRef.current = setTimeout(() => {
        triggerWakeAlert();
      }, 5 * 60 * 1000); // 5 minutes for demo
    }

    return () => {
      if (wakeIntervalRef.current) {
        clearTimeout(wakeIntervalRef.current);
      }
      if (wakeCountdownRef.current) {
        clearInterval(wakeCountdownRef.current);
      }
    };
  }, [isCheckedIn, isNightShift, triggerWakeAlert]);

  // Sync guard location to API when checked in
  useEffect(() => {
    if (!isCheckedIn || !guard?.id) return;

    const syncLocation = async () => {
      if (!navigator.geolocation) return;
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });
        
        const { latitude, longitude } = position.coords;
        
        await updateGuardLocation(guard.id, { lat: latitude, lng: longitude });
        
        console.log('Location synced:', latitude, longitude);
      } catch (e) {
        console.warn('Could not sync location:', e);
      }
    };

    // Sync immediately on check-in
    syncLocation();

    // Then sync periodically
    const intervalId = setInterval(syncLocation, LOCATION_SYNC_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isCheckedIn, guard?.id]);

  // Load the stats again after a check-in or check-out, which changes them
  useEffect(() => {
    if (!guard?.id) return;
    let cancelled = false;
    getGuardStats(guard.id).then((response) => {
      if (!cancelled && response.success && response.data) setGuardStats(response.data);
    });
    return () => {
      cancelled = true;
    };
  }, [guard?.id, isCheckedIn]);

  const stats = [
    { label: 'Shifts Worked', value: guardStats ? String(guardStats.shiftsCompleted ?? 0) : '–' },
    { label: 'Attendance (30 days)', value: guardStats ? `${guardStats.attendanceRate ?? 0}%` : '–' },
    { label: 'Patrol Check-ins', value: guardStats ? String(guardStats.patrolsCompleted ?? 0) : '–' },
  ];

  // Wake alert stats for night shift
  const wakeAlertStats = {
    total: wakeAlertLogs.length,
    success: wakeAlertLogs.filter(l => l.status === 'success').length,
    missed: wakeAlertLogs.filter(l => l.status === 'missed').length,
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Wake Alert Face Verification Scanner */}
      {showWakeFaceVerify && (
        <FacialScanner
          mode="verify"
          verifyDescriptor={verifyOwnFace}
          matchThreshold={0.6}
          onScanComplete={handleWakeFaceVerify}
          onCancel={() => setShowWakeFaceVerify(false)}
        />
      )}

      {/* Wake Alert Dialog. The check must be answered, so it has no close button. It steps aside
          while the face scanner is open (a modal dialog on top would block the scanner) and
          comes back after the scan; the countdown keeps running meanwhile. */}
      <Dialog open={wakeAlertActive && !showWakeFaceVerify} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          hideClose
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <Bell className="w-6 h-6 animate-pulse" />
              Wake-Up Check!
            </DialogTitle>
            <DialogDescription>
              {guard?.faceEnrolled 
                ? 'Verify your face and press the button below to confirm you\'re awake.'
                : 'Press the button below to confirm you\'re awake and alert.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="text-center">
              <p className="text-5xl font-bold font-mono text-foreground mb-2">
                {wakeAlertTimer}
              </p>
              <p className="text-sm text-muted-foreground">seconds remaining</p>
            </div>

            <Progress 
              value={(wakeAlertTimer / WAKE_ALERT_TIMEOUT) * 100} 
              className="h-2"
            />

            {/* Face verification section - only show if guard has face descriptor */}
            {guard?.faceEnrolled && (
              <div className="space-y-3">
                {isWakeFaceVerified ? (
                  <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/10 text-primary">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Face Verified</span>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setShowWakeFaceVerify(true)}
                  >
                    <Scan className="w-5 h-5 mr-2" />
                    Verify Face First
                  </Button>
                )}
              </div>
            )}

            <Button 
              variant="gradient" 
              size="xl" 
              className="w-full"
              onClick={handleWakeAlertResponse}
              disabled={!!guard?.faceEnrolled && !isWakeFaceVerified}
            >
              <CheckCircle className="w-6 h-6 mr-2" />
              I'm Awake!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conveyance Request Dialog */}
      <Dialog open={showConveyanceDialog} onOpenChange={setShowConveyanceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Request Conveyance
            </DialogTitle>
            <DialogDescription>
              Submit a request to leave your assigned geofence. Your request will be reviewed by a field officer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="conveyance-reason">Reason for leaving geofence</Label>
              <Textarea
                id="conveyance-reason"
                placeholder="e.g., Need to escort material delivery to storage facility..."
                value={conveyanceReason}
                onChange={(e) => setConveyanceReason(e.target.value)}
                className="bg-secondary/50 min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConveyanceDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="gradient"
              onClick={handleSubmitConveyanceRequest}
              disabled={isSubmittingConveyance || !conveyanceReason.trim()}
            >
              {isSubmittingConveyance ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SOS Alert Dialog */}
      <Dialog open={showSOSDialog} onOpenChange={setShowSOSDialog}>
        <DialogContent className="sm:max-w-md border-red-500/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-6 h-6" />
              Emergency SOS
            </DialogTitle>
            <DialogDescription>
              Send an emergency alert to the control room. Use only in genuine emergencies.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
              <p className="text-sm text-foreground font-medium mb-2">This will:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Alert the admin control room immediately</li>
                <li>Share your current GPS location</li>
                <li>Mark you as requiring urgent assistance</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sos-message">Additional Details (optional)</Label>
              <Textarea
                id="sos-message"
                placeholder="e.g., Intruder spotted at gate B, need backup..."
                value={sosMessage}
                onChange={(e) => setSosMessage(e.target.value)}
                className="bg-secondary/50 min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSOSDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              onClick={handleSubmitSOS}
              disabled={isSubmittingSOS}
            >
              {isSubmittingSOS ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-2" />
                  Send SOS Alert
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="p-6 pt-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-muted-foreground text-sm">{currentDate}</p>
            <h1 className="text-2xl font-bold text-foreground mt-1">
              Hello, {guard?.name.split(' ')[0]}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isNightShift() && isCheckedIn && (
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary">
                <Moon className="w-3 h-3 mr-1" />
                Night
              </Badge>
            )}
            <div className={`status-indicator ${isCheckedIn ? 'status-active' : 'status-offline'}`} />
            <span className="text-sm font-medium text-foreground">
              {isCheckedIn ? 'On Duty' : 'Off Duty'}
            </span>
          </div>
        </div>

        {/* Current Shift Card */}
        <div className="glass-card p-5 mb-6">
          <div className="flex items-center gap-2 text-primary mb-3">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wide">Current Shift</span>
            {isNightShift() && (
              <Badge variant="secondary" className="ml-auto">
                <Moon className="w-3 h-3 mr-1" />
                Night Shift
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {guard?.currentShift?.location || 'No shift scheduled'}
              </h3>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                {guard?.currentShift ? (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">
                      {guard.currentShift.startTime} - {guard.currentShift.endTime}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm">No site assigned yet. Ask your supervisor.</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-foreground font-mono">{currentTime}</p>
            </div>
          </div>

          <div className="flex gap-3">
            {!isCheckedIn ? (
              // Without a site there is nowhere to check in to
              <Button
                variant="gradient"
                className="flex-1"
                onClick={() => navigate('/check-in')}
                disabled={!hasSite}
              >
                <LogIn className="w-5 h-5 mr-2" />
                {hasSite ? 'Check In' : 'No site assigned yet'}
              </Button>
            ) : (
              <>
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={handleCheckOut}
                  disabled={isCheckingOut}
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  Check Out
                </Button>
                <Button 
                  variant="outline"
                  className="border-red-500 bg-red-500/10 hover:bg-red-500/20 text-red-500"
                  onClick={() => setShowSOSDialog(true)}
                >
                  <Phone className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* SOS Active Banner */}
        {sosActive && (
          <div className="glass-card p-4 mb-6 border-2 border-red-500 bg-red-500/10 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-red-500">SOS Alert Active</p>
                <p className="text-sm text-muted-foreground">Help has been notified. Stay calm.</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSosActive(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Night Shift Wake Alert Stats */}
        {isNightShift() && isCheckedIn && wakeAlertLogs.length > 0 && (
          <div className="glass-card p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Wake-Up Checks</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">{wakeAlertStats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-lg font-bold text-primary">{wakeAlertStats.success}</p>
                <p className="text-xs text-muted-foreground">Passed</p>
              </div>
              <div>
                <p className="text-lg font-bold text-destructive">{wakeAlertStats.missed}</p>
                <p className="text-xs text-muted-foreground">Missed</p>
              </div>
            </div>
          </div>
        )}

        {/* Conveyance Request Status (when active) */}
        {conveyanceStatus && conveyanceStatus.status === 'pending' && (
          <div className="glass-card p-4 mb-6 border border-warning/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="status-indicator status-pending animate-pulse" />
                <span className="text-sm font-medium text-warning">Pending Approval</span>
              </div>
              <Badge variant="outline" className="bg-warning/20 text-warning border-warning">
                <Clock className="w-3 h-3 mr-1" />
                Waiting
              </Badge>
            </div>
            <p className="text-sm text-foreground mb-3">{conveyanceStatus.reason}</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={handleCancelConveyanceRequest}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel Request
            </Button>
          </div>
        )}

        {/* Conveyance Approved Status */}
        {conveyanceStatus && conveyanceStatus.status === 'approved' && (
          <div className="glass-card p-4 mb-6 border border-primary/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-primary">Conveyance Approved</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConveyanceStatus(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              You may leave the geofence. {conveyanceStatus.staffNotes && `Note: ${conveyanceStatus.staffNotes}`}
            </p>
          </div>
        )}

        {/* Request Conveyance Button (only when checked in and no pending request) */}
        {isCheckedIn && (!conveyanceStatus || conveyanceStatus.status !== 'pending') && (
          <div className="glass-card p-4 mb-6">
            <Button
              variant="outline"
              className="w-full border-primary/50 text-primary hover:bg-primary/10"
              onClick={() => setShowConveyanceDialog(true)}
            >
              <Send className="w-5 h-5 mr-2" />
              Request Conveyance
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Request permission to leave your assigned area
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="glass-card p-4">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="space-y-3">
          <button 
            onClick={() => navigate('/schedule')}
            className="w-full glass-card p-4 flex items-center justify-between hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">View Schedule</p>
                <p className="text-sm text-muted-foreground">Check upcoming shifts</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          <button
            onClick={() => setShowSOSDialog(true)}
            className="w-full glass-card p-4 flex items-center justify-between hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Report Incident</p>
                <p className="text-sm text-muted-foreground">Alert the control room</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          <button 
            onClick={() => navigate('/patrol')}
            className="w-full glass-card p-4 flex items-center justify-between hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Patrol Mode</p>
                <p className="text-sm text-muted-foreground">Check-in at patrol points</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          <button 
            onClick={() => navigate('/leave')}
            className="w-full glass-card p-4 flex items-center justify-between hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Request Leave</p>
                <p className="text-sm text-muted-foreground">Apply for time off</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
