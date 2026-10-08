import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  CheckCircle,
  AlertCircle,
  Navigation,
  Loader2,
  RefreshCw,
  Clock,
  Map,
  List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PatrolPoint, PatrolLog } from '@/types/guard';
import { calculateDistance } from '@/lib/utils';
import PatrolMap from '@/components/PatrolMap';
import { logPatrolPoint } from '@/services/GuardAPI';
import {
  getCurrentPosition,
  checkPatrolPoint,
  MOCK_PATROL_POINTS,
  type GeolocationPosition,
} from '@/services/GeolocationService';

interface PatrolPointStatus extends PatrolPoint {
  isCompleted: boolean;
  completedAt?: string;
  distance?: number;
}

export default function PatrolMode() {
  const navigate = useNavigate();
  const { guard, site } = useAuth();
  const { toast } = useToast();

  const [patrolPoints, setPatrolPoints] = useState<PatrolPointStatus[]>([]);
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<PatrolPointStatus | null>(null);
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>([]);
  const [patrolStartTime, setPatrolStartTime] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [siteName, setSiteName] = useState<string>('');

  // Determine the next point (first incomplete point by order)
  const nextPoint = useMemo(() => {
    return [...patrolPoints]
      .sort((a, b) => a.order - b.order)
      .find(p => !p.isCompleted);
  }, [patrolPoints]);

  // Initialize patrol points from site's patrol route or fallback to mock
  useEffect(() => {
    let points: PatrolPointStatus[] = [];
    
    // Try to use patrol route from logged-in guard's site
    if (site?.patrolRoute && site.patrolRoute.length > 0) {
      setSiteName(site.name);
      points = site.patrolRoute.map((checkpoint: any) => ({
        id: checkpoint.id,
        siteId: site.id,
        name: checkpoint.name,
        latitude: checkpoint.latitude,
        longitude: checkpoint.longitude,
        radiusMeters: checkpoint.radiusMeters || 15,
        order: checkpoint.order,
        isCompleted: false,
      }));
    } else {
      // DEMO FALLBACK: Use demo patrol points when site has no configured route
      // In production, sites should always have patrol routes configured via admin
      console.warn('⚠️ No patrol route configured for site - using demo fallback points');
      setSiteName('Demo Site');
      points = MOCK_PATROL_POINTS.map((point) => ({
        ...point,
        isCompleted: false,
      }));
    }
    
    setPatrolPoints(points);
    setPatrolStartTime(new Date());
    getLocation();
  }, [site]);

  // Get current location
  const getLocation = async () => {
    setIsLoading(true);
    try {
      const position = await getCurrentPosition();
      setCurrentPosition(position);

      // Update distances to patrol points
      setPatrolPoints((prev) =>
        prev.map((point) => ({
          ...point,
          distance: Math.round(
            calculateDistance(
              position.latitude,
              position.longitude,
              point.latitude,
              point.longitude
            )
          ),
        }))
      );
    } catch (error) {
      toast({
        title: 'Location Error',
        description: 'Unable to get your location. Please enable GPS.',
        variant: 'destructive',
      });
      // Use mock position for demo
      const mockPosition: GeolocationPosition = {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 10,
        timestamp: Date.now(),
      };
      setCurrentPosition(mockPosition);
      setPatrolPoints((prev) =>
        prev.map((point, index) => ({
          ...point,
          distance: index * 15 + 5, // Mock increasing distances
        }))
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Check-in to a patrol point
  const handleCheckIn = async (point: PatrolPointStatus) => {
    if (!currentPosition) {
      toast({
        title: 'Location Required',
        description: 'Please wait for location to be detected',
        variant: 'destructive',
      });
      return;
    }

    setIsCheckingIn(true);
    setSelectedPoint(point);

    try {
      // Refresh location for accurate check-in
      const position = await getCurrentPosition();
      const distance = calculateDistance(
        position.latitude,
        position.longitude,
        point.latitude,
        point.longitude
      );

      const withinRadius = distance <= point.radiusMeters;

      // Create patrol log and persist to API
      const logData = {
        guardId: guard?.id || '1',
        siteId: site?.id || point.siteId,
        patrolPointId: point.id,
        patrolPointName: point.name,
        shiftId: guard?.currentShift?.id,
        lat: position.latitude,
        lng: position.longitude,
        withinRadius,
        distanceFromPoint: Math.round(distance),
      };

      // Persist to API
      try {
        const response = await logPatrolPoint(guard?.id || '', {
          patrolPointId: point.id,
          patrolPointName: point.name,
          shiftId: guard?.currentShift?.id,
          latitude: position.latitude,
          longitude: position.longitude,
          withinRadius: distance <= point.radius,
          distanceFromPoint: Math.round(distance),
        });
        
        if (response.success && response.data) {
          setPatrolLogs((prev) => [...prev, response.data!]);
        } else {
          // Fallback to local log if API fails
          const localLog: PatrolLog = {
            id: `pl-${Date.now()}`,
            guardId: guard?.id || '',
            patrolPointId: point.id,
            patrolPointName: point.name,
            shiftId: guard?.currentShift?.id,
            latitude: position.latitude,
            longitude: position.longitude,
            withinRadius: distance <= point.radius,
            distanceFromPoint: Math.round(distance),
            timestamp: new Date().toISOString(),
          };
          setPatrolLogs((prev) => [...prev, localLog]);
        }
      } catch (apiErr) {
        console.error('Failed to save patrol log to API:', apiErr);
        // Fallback to local log
        const localLog: PatrolLog = {
          id: `pl-${Date.now()}`,
          ...logData,
          latitude: position.latitude,
          longitude: position.longitude,
          timestamp: new Date().toISOString(),
        };
        setPatrolLogs((prev) => [...prev, localLog]);
      }

      // Update patrol point status
      setPatrolPoints((prev) =>
        prev.map((p) =>
          p.id === point.id
            ? {
                ...p,
                isCompleted: true,
                completedAt: new Date().toISOString(),
                distance: Math.round(distance),
              }
            : p
        )
      );

      if (withinRadius) {
        toast({
          title: 'Check-in Successful',
          description: `You've checked in at ${point.name}`,
        });
      } else {
        toast({
          title: 'Check-in Recorded',
          description: `Recorded but you're ${Math.round(distance)}m away from the point`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Check-in Failed',
        description: 'Unable to verify location. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCheckingIn(false);
      setSelectedPoint(null);
    }
  };

  // Calculate progress
  const completedCount = patrolPoints.filter((p) => p.isCompleted).length;
  const totalCount = patrolPoints.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Get elapsed time
  const getElapsedTime = () => {
    if (!patrolStartTime) return '0:00';
    const elapsed = Math.floor((Date.now() - patrolStartTime.getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Sort points by distance (nearest first)
  const sortedPoints = [...patrolPoints].sort((a, b) => {
    // Show incomplete points first
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }
    // Then sort by distance
    return (a.distance || 0) - (b.distance || 0);
  });

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

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Patrol Mode</h1>
            <p className="text-sm text-muted-foreground">
              {siteName ? siteName : 'Check-in at each patrol point'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-secondary rounded-lg p-1">
              <Button
                variant={viewMode === 'map' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewMode('map')}
              >
                <Map className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="outline" size="icon" onClick={getLocation}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Progress Card */}
        <Card className="glass-card border-0 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-primary" />
                <span className="font-semibold">Patrol Progress</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{getElapsedTime()}</span>
              </div>
            </div>

            <Progress value={progressPercent} className="h-2 mb-2" />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {completedCount} of {totalCount} points completed
              </span>
              <span className="font-medium text-primary">
                {Math.round(progressPercent)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Patrol Map */}
        {viewMode === 'map' && !isLoading && patrolPoints.length > 0 && (
          <div className="mb-6">
            <PatrolMap
              patrolPoints={patrolPoints}
              currentPosition={currentPosition}
              nextPointId={nextPoint?.id}
            />
            {nextPoint && (
              <Card className="glass-card border-0 mt-3">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                        <span className="text-sm font-bold text-green-500">{nextPoint.order}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Next: {nextPoint.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {nextPoint.distance !== undefined ? `${nextPoint.distance}m away` : 'Calculating...'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={nextPoint.distance && nextPoint.distance <= nextPoint.radiusMeters ? 'gradient' : 'outline'}
                      size="sm"
                      onClick={() => handleCheckIn(nextPoint)}
                      disabled={isCheckingIn}
                    >
                      {isCheckingIn && selectedPoint?.id === nextPoint.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Check In'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Current Location */}
        {currentPosition && viewMode === 'list' && (
          <div className="glass-card p-3 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Your Location</p>
              <p className="text-xs text-muted-foreground">
                {currentPosition.latitude.toFixed(6)}, {currentPosition.longitude.toFixed(6)}
                <span className="ml-2">
                  (±{Math.round(currentPosition.accuracy)}m accuracy)
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Patrol Points List */}
        {viewMode === 'list' && (
          <>
            <h2 className="text-lg font-semibold text-foreground mb-3">Patrol Points</h2>
            <div className="space-y-3">
              {isLoading ? (
                <div className="glass-card p-8 text-center">
                  <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin mb-3" />
                  <p className="text-muted-foreground">Getting your location...</p>
                </div>
              ) : (
                sortedPoints.map((point) => (
                  <Card
                    key={point.id}
                    className={`glass-card border-0 transition-all ${
                      point.isCompleted ? 'opacity-70' : ''
                    } ${point.id === nextPoint?.id ? 'ring-2 ring-green-500/50' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              point.isCompleted
                                ? 'bg-primary/10'
                                : point.id === nextPoint?.id
                                ? 'bg-green-500/20 animate-pulse'
                                : point.distance && point.distance <= point.radiusMeters
                                ? 'bg-primary/20'
                                : 'bg-secondary'
                            }`}
                          >
                            {point.isCompleted ? (
                              <CheckCircle className="w-5 h-5 text-primary" />
                            ) : point.id === nextPoint?.id ? (
                              <span className="text-sm font-bold text-green-500">
                                {point.order}
                              </span>
                            ) : (
                              <span className="text-sm font-bold text-foreground">
                                {point.order}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{point.name}</p>
                            {point.id === nextPoint?.id && !point.isCompleted && (
                              <Badge variant="outline" className="border-green-500 text-green-500 mb-1">
                                Next Point
                              </Badge>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {point.distance !== undefined && (
                                <Badge
                                  variant={
                                    point.distance <= point.radiusMeters
                                      ? 'default'
                                      : 'secondary'
                                  }
                                  className={
                                    point.distance <= point.radiusMeters
                                      ? 'bg-primary/10 text-primary'
                                      : ''
                                  }
                                >
                                  {point.distance}m away
                                </Badge>
                              )}
                              {point.distance && point.distance <= point.radiusMeters && (
                                <Badge
                                  variant="outline"
                                  className="border-primary text-primary"
                                >
                                  In Range
                                </Badge>
                              )}
                            </div>
                            {point.completedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Checked in at{' '}
                                {new Date(point.completedAt).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                        </div>

                        {!point.isCompleted && (
                          <Button
                            variant={
                              point.distance && point.distance <= point.radiusMeters
                                ? 'gradient'
                                : 'outline'
                            }
                            size="sm"
                            onClick={() => handleCheckIn(point)}
                            disabled={isCheckingIn}
                          >
                            {isCheckingIn && selectedPoint?.id === point.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Check In'
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}

        {/* Completion Message */}
        {completedCount === totalCount && totalCount > 0 && (
          <Card className="glass-card border-0 mt-6 bg-primary/10">
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground mb-2">
                Patrol Complete!
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                All patrol points have been checked. Great work!
              </p>
              <Button variant="gradient" onClick={() => navigate('/dashboard')}>
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
