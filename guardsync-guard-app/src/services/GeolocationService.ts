// Geolocation Service for GPS-based features
import { PatrolPoint, PatrolLog, LocationPing } from '@/types/guard';
import { calculateDistance } from '@guardsync/utils';

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeofenceCheckResult {
  isWithinGeofence: boolean;
  distance: number;
  nearestPoint?: PatrolPoint;
}

// Get current position with Promise wrapper
export const getCurrentPosition = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

// Check if position is within a geofence (single point)
export const checkGeofence = (
  position: GeolocationPosition,
  center: { latitude: number; longitude: number },
  radiusMeters: number
): boolean => {
  const distance = calculateDistance(
    position.latitude,
    position.longitude,
    center.latitude,
    center.longitude
  );
  return distance <= radiusMeters;
};

// Check if position is near any patrol point
export const checkPatrolPoint = (
  position: GeolocationPosition,
  patrolPoints: PatrolPoint[]
): GeofenceCheckResult => {
  let nearestPoint: PatrolPoint | undefined;
  let minDistance = Infinity;

  for (const point of patrolPoints) {
    const distance = calculateDistance(
      position.latitude,
      position.longitude,
      point.latitude,
      point.longitude
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = point;
    }
  }

  const isWithin = nearestPoint ? minDistance <= nearestPoint.radiusMeters : false;

  return {
    isWithinGeofence: isWithin,
    distance: Math.round(minDistance),
    nearestPoint,
  };
};

// Location watcher for continuous tracking
export class LocationWatcher {
  private watchId: number | null = null;
  private callbacks: ((position: GeolocationPosition) => void)[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  start(
    onPosition: (position: GeolocationPosition) => void,
    intervalMs: number = 30000
  ): void {
    this.callbacks.push(onPosition);

    // Use watchPosition for continuous tracking
    if (this.watchId === null) {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const pos: GeolocationPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          this.callbacks.forEach((cb) => cb(pos));
        },
        (error) => {
          console.error('Location watch error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: intervalMs,
        }
      );
    }
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.callbacks = [];
  }

  isWatching(): boolean {
    return this.watchId !== null;
  }
}

// Singleton instance for app-wide location tracking
export const locationWatcher = new LocationWatcher();

/**
 * DEMO FALLBACK PATROL POINTS
 * 
 * These patrol points are ONLY used when:
 * 1. The guard's assigned site has no patrol route configured
 * 2. The API is not reachable (offline mode)
 * 
 * In production, patrol routes should always be configured per-site
 * via the admin platform (Sites > Manage Site > Patrol Route).
 * 
 * Location: Generic Bangalore tech park coordinates for demo purposes
 */
export const MOCK_PATROL_POINTS: PatrolPoint[] = [
  {
    id: 'demo-pp1',
    siteId: 'demo-site',
    name: 'Main Gate (Demo)',
    latitude: 12.9716,
    longitude: 77.5946,
    radiusMeters: 10,
    order: 1,
  },
  {
    id: 'demo-pp2',
    siteId: 'demo-site',
    name: 'Parking Area A (Demo)',
    latitude: 12.9720,
    longitude: 77.5950,
    radiusMeters: 10,
    order: 2,
  },
  {
    id: 'demo-pp3',
    siteId: 'demo-site',
    name: 'Building A Entrance (Demo)',
    latitude: 12.9725,
    longitude: 77.5955,
    radiusMeters: 10,
    order: 3,
  },
  {
    id: 'demo-pp4',
    siteId: 'demo-site',
    name: 'Fire Exit (Demo)',
    latitude: 12.9718,
    longitude: 77.5960,
    radiusMeters: 10,
    order: 4,
  },
  {
    id: 'demo-pp5',
    siteId: 'demo-site',
    name: 'Loading Bay (Demo)',
    latitude: 12.9712,
    longitude: 77.5952,
    radiusMeters: 10,
    order: 5,
  },
];

export default {
  getCurrentPosition,
  calculateDistance,
  checkGeofence,
  checkPatrolPoint,
  locationWatcher,
  MOCK_PATROL_POINTS,
};
