import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, Clock, CheckCircle, ArrowLeft, Scan, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FacialScanner } from '@/components/FacialScanner';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { calculateDistance } from '@/lib/utils';
import { clockIn, createNotification } from '@/services/GuardAPI';

type CheckInStep = 'confirm' | 'scanning' | 'submitting' | 'success';

export default function CheckIn() {
  const navigate = useNavigate();
  const { guard, site } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<CheckInStep>('confirm');
  const [checkInTime, setCheckInTime] = useState<string>('');

  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const handleScanComplete = async (success: boolean) => {
    if (success) {
      setStep('submitting');
      try {
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
          shiftId: guard?.currentShift?.id,
          latitude: lat,
          longitude: lng,
          withinGeofence,
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to log check-in');
        }

        // Create notification for successful check-in
        await createNotification({
          guardId: guard?.id || '',
          type: 'success',
          title: 'Check-in Confirmed',
          message: `Successfully checked in at ${guard?.currentShift?.location || site?.name || 'your site'}.`,
        });

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
          description: 'Could not log your attendance. Please try again.',
          variant: 'destructive',
        });
        setStep('confirm');
      }
    }
  };

  if (step === 'scanning') {
    return (
      <FacialScanner
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
              <span className="font-medium text-accent flex items-center gap-1">
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
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-accent" />
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

        {/* Facial Recognition Button */}
        <button
          onClick={() => setStep('scanning')}
          className="w-full glass-card p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition-all duration-300 group mb-4"
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
      </div>

      <BottomNav />
    </div>
  );
}
