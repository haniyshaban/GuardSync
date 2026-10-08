import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  LogIn,
  LogOut,
  Shield,
  ChevronRight,
  FileCheck,
  FileVideo,
  Sun,
  Sunset,
  Moon,
  MapPin,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';
import type { StaffAttendance } from '@/types';
import { getAttendanceStatus, clockIn, clockOut, getPendingConveyanceRequests, getFieldReports } from '@/services/staffApi';

type ShiftType = 'morning' | 'general' | 'night';

const shiftOptions: { value: ShiftType; label: string; icon: React.ReactNode; time: string }[] = [
  { value: 'morning', label: 'Morning Shift', icon: <Sun className="w-5 h-5" />, time: '6:00 AM - 2:00 PM' },
  { value: 'general', label: 'General Shift', icon: <Sunset className="w-5 h-5" />, time: '9:00 AM - 6:00 PM' },
  { value: 'night', label: 'Night Shift', icon: <Moon className="w-5 h-5" />, time: '10:00 PM - 6:00 AM' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { staff, attendance, setAttendance } = useAuth();
  const { toast } = useToast();
  
  const [showClockInDialog, setShowClockInDialog] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftType>('general');
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [pendingConveyance, setPendingConveyance] = useState(0);
  const [stats, setStats] = useState([
    { label: 'Sites Visited', value: '0', trend: '' },
    { label: 'Approvals', value: '0', trend: '' },
    { label: 'Reports', value: '0', trend: '' },
  ]);

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

  // Fetch attendance status from API on mount
  useEffect(() => {
    const fetchAttendanceStatus = async () => {
      if (!staff?.id) return;
      try {
        const response = await getAttendanceStatus(staff.id);
        if (response.success && response.data && !response.data.clockOutTime) {
          setAttendance(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch attendance status:', err);
      }
    };

    fetchAttendanceStatus();
  }, [staff?.id]);

  // Fetch stats from API
  useEffect(() => {
    const fetchStats = async () => {
      if (!staff?.id) return;
      try {
        // Fetch pending conveyance count
        const convResponse = await getPendingConveyanceRequests();
        if (convResponse.success && convResponse.data) {
          setPendingConveyance(convResponse.data.length);
        }

        // Fetch reports count for this staff member
        const reportsResponse = await getFieldReports(staff.id);
        if (reportsResponse.success && reportsResponse.data) {
          setStats(prev => prev.map(s =>
            s.label === 'Reports'
              ? { ...s, value: String(reportsResponse.data!.length), trend: reportsResponse.data!.length > 0 ? `+${Math.min(reportsResponse.data!.length, 5)}` : '' }
              : s.label === 'Approvals'
              ? { ...s, value: String(pendingConveyance), trend: pendingConveyance > 0 ? `+${pendingConveyance}` : '' }
              : s
          ));
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };

    fetchStats();
  }, [staff?.id, pendingConveyance]);

  // Calculate elapsed time when clocked in
  useEffect(() => {
    if (!attendance?.clockInTime) return;

    const updateElapsed = () => {
      const start = new Date(attendance.clockInTime).getTime();
      const now = Date.now();
      const diff = now - start;

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [attendance?.clockInTime]);

  const handleClockIn = async () => {
    setIsClockingIn(true);

    try {
      // Get current location
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (geoErr) {
        console.warn('Could not get location:', geoErr);
      }

      const response = await clockIn(
        staff?.id || '',
        selectedShift,
        lat && lng ? { lat, lng } : undefined
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to clock in');
      }
      
      setAttendance(response.data);
      setShowClockInDialog(false);

      toast({
        title: 'Clocked In Successfully',
        description: `You are now on ${selectedShift} shift duty.`,
      });
    } catch (err) {
      console.error('Clock in error:', err);
      toast({
        title: 'Clock In Failed',
        description: 'Could not clock in. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!attendance) return;
    
    setIsClockingOut(true);

    try {
      const response = await clockOut(staff?.id || '');

      if (!response.success) {
        throw new Error(response.error || 'Failed to clock out');
      }

      setAttendance(null);

      toast({
        title: 'Clocked Out',
        description: `Total time: ${elapsedTime}. Have a good day!`,
      });
    } catch (err) {
      console.error('Clock out error:', err);
      toast({
        title: 'Clock Out Failed',
        description: 'Could not clock out. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsClockingOut(false);
    }
  };

  const isClockedIn = !!attendance && !attendance.clockOutTime;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Clock In Dialog */}
      <Dialog open={showClockInDialog} onOpenChange={setShowClockInDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Your Shift</DialogTitle>
            <DialogDescription>
              Choose your shift type before clocking in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <RadioGroup
              value={selectedShift}
              onValueChange={(value) => setSelectedShift(value as ShiftType)}
              className="space-y-3"
            >
              {shiftOptions.map((shift) => (
                <div key={shift.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={shift.value} id={shift.value} />
                  <Label
                    htmlFor={shift.value}
                    className="flex-1 flex items-center gap-3 cursor-pointer"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedShift === shift.value
                        ? 'bg-primary/20 text-primary'
                        : 'bg-secondary text-muted-foreground'
                    }`}>
                      {shift.icon}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{shift.label}</p>
                      <p className="text-sm text-muted-foreground">{shift.time}</p>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <Button
              variant="gradient"
              className="w-full"
              onClick={handleClockIn}
              disabled={isClockingIn}
            >
              {isClockingIn ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <LogIn className="w-5 h-5 mr-2" />
              )}
              {isClockingIn ? 'Clocking In...' : 'Confirm Clock In'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="p-6 pt-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-muted-foreground text-sm">{currentDate}</p>
            <h1 className="text-2xl font-bold text-foreground mt-1">
              Hello, {staff?.name.split(' ')[0]}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className={`status-indicator ${isClockedIn ? 'status-active' : 'status-offline'}`} />
            <span className="text-sm font-medium text-foreground">
              {isClockedIn ? 'On Duty' : 'Off Duty'}
            </span>
          </div>
        </div>

        {/* Current Shift Card */}
        <div className="glass-card p-5 mb-6">
          <div className="flex items-center gap-2 text-primary mb-3">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wide">Staff Portal</span>
            {isClockedIn && attendance?.shiftType && (
              <Badge variant="secondary" className="ml-auto capitalize">
                {attendance.shiftType} Shift
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {staff?.assignedArea || 'Field Operations'}
              </h3>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{staff?.employeeId}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-foreground font-mono">{currentTime}</p>
              {isClockedIn && (
                <p className="text-sm text-primary font-mono mt-1">{elapsedTime}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            {!isClockedIn ? (
              <Button
                variant="gradient"
                className="flex-1"
                onClick={() => setShowClockInDialog(true)}
              >
                <LogIn className="w-5 h-5 mr-2" />
                Clock In
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleClockOut}
                disabled={isClockingOut}
              >
                {isClockingOut ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <LogOut className="w-5 h-5 mr-2" />
                )}
                {isClockingOut ? 'Clocking Out...' : 'Clock Out'}
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="glass-card p-4">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              {stat.trend && (
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="w-3 h-3 text-primary" />
                  <span className="text-xs text-primary">{stat.trend}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="space-y-3">
          <button
            onClick={() => navigate('/conveyance')}
            className="w-full glass-card p-4 flex items-center justify-between hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-warning" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Conveyance Approvals</p>
                <p className="text-sm text-muted-foreground">Review pending requests</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pendingConveyance > 0 && (
                <Badge variant="warning" className="bg-warning/20 text-warning">{pendingConveyance} pending</Badge>
              )}
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </button>

          <button
            onClick={() => navigate('/reporting')}
            className="w-full glass-card p-4 flex items-center justify-between hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <FileVideo className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Field Reporting</p>
                <p className="text-sm text-muted-foreground">Voice notes & video reports</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          <button
            className="w-full glass-card p-4 flex items-center justify-between hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Attendance History</p>
                <p className="text-sm text-muted-foreground">View your shift records</p>
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
