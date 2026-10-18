import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Camera, MapPin, Clock, CheckCircle, ArrowLeft, Scan, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FacialScanner } from '@/components/FacialScanner';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { calculateDistance } from '@/lib/utils';
import { clockIn, saveFaceDescriptor, verifyFace } from '@/services/GuardAPI';
import { descriptorToString } from '@/services/FaceApiService';
import { errorMessage } from '@/lib/apiError';

type CheckInStep = 'confirm' | 'scanning' | 'submitting' | 'success';

export default function CheckIn() {
  const navigate = useNavigate();
  const { guard, site, updateGuard } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<CheckInStep>('confirm');
  const [checkInTime, setCheckInTime] = useState<string>('');

  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  // First check-in enrols the guard's face; every later one is verified against it on the server
  const isFaceEnrolled = !!guard?.faceEnrolled;

  // A guard can only check in at their assigned site
  const siteId = guard?.siteId || guard?.currentShift?.siteId || site?.id;

  // Already on duty: there is nothing to check in to (checking in again would replace the
  // shift's start time). Only on arrival; right after a check-in the success screen is shown.
  const alreadyOnDuty = guard?.status === 'active' && step === 'confirm';
  useEffect(() => {
    if (alreadyOnDuty) {
      toast({ title: 'Already checked in', description: 'You are on duty. Check out from the dashboard at the end of your shift.' });
    }
  }, [alreadyOnDuty, toast]);

  const verifyOwnFace = async (descriptor: Float32Array) => {
    if (!guard?.id) return false;
    const result = await verifyFace(guard.id, descriptorToString(descriptor));
    // A failed request is not a "no match": the scanner shows the server's reason
    if (!result.success) throw new Error(errorMessage(result.error, 'Could not check your face. Please try again.'));
    return result.data?.match === true;
  };

  const handleScanComplete = async (success: boolean, descriptor?: Float32Array) => {
    if (success) {
      // Checked before anything is saved, so a guard without a site does not enrol a face for nothing
      if (!siteId) {
        toast({
          title: 'No site assigned yet',
          description: 'Ask your supervisor to assign you to a site before checking in.',
          variant: 'destructive',
        });
        setStep('confirm');
        return;
      }
      setStep('submitting');
      try {
        if (!isFaceEnrolled) {
          if (!descriptor || !guard?.id) {
            throw new Error('No face was captured');
          }
          const descriptorStr = descriptorToString(descriptor);
          const saved = await saveFaceDescriptor(guard.id, descriptorStr);
          // Already enrolled (for example from another phone): carry on, the server checks this scan at clock-in
          const alreadyEnrolled = !saved.success && saved.error?.code === 'CONFLICT';
          if (!saved.success && !alreadyEnrolled) {
            throw new Error(errorMessage(saved.error, 'Could not save your face enrolment'));
          }
          updateGuard({ faceEnrolled: true });
        }

        // Get current position for geofence check
        let lat: number | undefined;
        let lng: number | undefined;
        let withinGeofence = true;

        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            });
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;

          // Check if within geofence (simple radius check)
          if (site?.location && site?.geofenceRadius) {
            const distance = calculateDistance(lat, lng, site.location.lat, site.location.lng);
            withinGeofence = distance <= site.geofenceRadius;
          }
        } catch (geoErr) {
          console.warn('Could not get location:', geoErr);
        }

        // Log attendance to API
        const response = await clockIn(guard?.id || '', {
          siteId,
          shiftId: guard?.currentShift?.id,
          latitude: lat,
          longitude: lng,
          withinGeofence,
          faceDescriptor: descriptor ? descriptorToString(descriptor) : undefined,
        });

        if (!response.success) {
          // The server already has an open check-in for this guard: they are on duty
          if (response.error?.code === 'ALREADY_CLOCKED_IN') {
            updateGuard({ status: 'active' });
            toast({ title: 'Already checked in', description: errorMessage(response.error, 'You are already on duty.') });
            navigate('/dashboard', { replace: true });
            return;
          }
          throw new Error(errorMessage(response.error, 'Could not log your attendance. Please try again.'));
        }

        // Mark the guard as on duty so the dashboard reflects it straight away.
        // (The server adds the 'Check-in confirmed' notification itself.)
        updateGuard({ status: 'active' });

        setCheckInTime(new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }));
        setStep('success');

        toast({
          title: 'Check-in Successful',
          description: withinGeofence 
            ? 'Your attendance has been logged.' 
            : 'Logged, but you are outside the geofence.',
        });
      } catch (err) {
        console.error('Check-in error:', err);
        toast({
          title: 'Check-in Failed',
          description: errorMessage(err, 'Could not log your attendance. Please try again.'),
          variant: 'destructive',
        });
        setStep('confirm');
      }
    }
  };

  if (alreadyOnDuty) {
    return <Navigate to="/dashboard" replace />;
  }

  if (step === 'scanning') {
    return (
      <FacialScanner
        mode={isFaceEnrolled ? 'verify' : 'capture'}
        verifyDescriptor={verifyOwnFace}
        onScanComplete={handleScanComplete}
        onCancel={() => setStep('confirm')}
      />
    );
  }

  if (step === 'submitting') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin mb-6" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Logging Attendance...</h1>
          <p className="text-muted-foreground">Please wait</p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center animate-scale-in">
          <div className="w-24 h-24 rounded-full gradient-success flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Checked In!</h1>
          <p className="text-muted-foreground mb-2">Your shift has started</p>
          <p className="text-2xl font-mono text-primary">{checkInTime || currentTime}</p>
        </div>

        <div className="glass-card p-5 w-full max-w-sm mt-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Location</span>
              <span className="font-medium text-foreground">{guard?.currentShift?.location}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Shift Time</span>
              <span className="font-medium text-foreground">
                {guard?.currentShift?.startTime} - {guard?.currentShift?.endTime}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Verification</span>
              <span className="font-medium text-primary flex items-center gap-1">
                <Scan className="w-4 h-4" />
                Facial ID
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="gradient"
          size="xl"
          className="mt-8 w-full max-w-sm"
          onClick={() => navigate('/dashboard')}
        >
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="p-6 pt-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <h1 className="text-2xl font-bold text-foreground mb-2">Check In</h1>
        <p className="text-muted-foreground">Verify your identity to start your shift</p>
      </div>

      {/* Shift Details */}
      <div className="px-6">
        <div className="glass-card p-5 mb-6">
          <h3 className="font-semibold text-foreground mb-4">Shift Details</h3>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium text-foreground">{guard?.currentShift?.location}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scheduled Time</p>
                <p className="font-medium text-foreground">
                  {guard?.currentShift?.startTime} - {guard?.currentShift?.endTime}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Current Time */}
        <div className="text-center mb-8">
          <p className="text-sm text-muted-foreground mb-2">Current Time</p>
          <p className="text-4xl font-bold font-mono text-foreground">{currentTime}</p>
        </div>

        {/* No site: nothing to check in to */}
        {!siteId ? (
          <div className="glass-card p-6 flex flex-col items-center gap-3 text-center mb-4">
            <AlertCircle className="w-10 h-10 text-warning" />
            <p className="font-semibold text-foreground">No site assigned yet</p>
            <p className="text-sm text-muted-foreground">Ask your supervisor to assign you to a site, then check in here.</p>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        ) : (
        <>
        {/* Facial Recognition Button */}
        <button
          onClick={() => setStep('scanning')}
          className="w-full glass-card p-6 flex flex-col items-center gap-4 hover:bg-accent transition-all duration-300 group mb-4"
        >
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Camera className="w-12 h-12 text-primary" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-primary/50 animate-pulse" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground text-lg">Start Face Scan</p>
            <p className="text-sm text-muted-foreground">Verify identity to check in</p>
          </div>
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Position your face clearly in the frame for quick verification
        </p>
        </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
