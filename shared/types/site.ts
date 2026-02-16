/**
 * Site and location-related type definitions
 */

import type { Location, GeofenceType } from './common';
import type { Shift } from './shift';

export interface Site {
  id: string;
  name: string;
  address: string;
  location: Location;
  geofenceRadius: number; // in meters
  geofenceType?: GeofenceType;
  geofencePolygon?: Location[];
  assignedGuards: string[];
  // site-level shift definitions
  shifts?: Shift[];
  // mapping of assigned guard -> shift at this site
  assignedGuardShifts?: { guardId: string; shiftId: string }[];
  isActive: boolean;
  createdAt: Date;
  // Patrol route checkpoints for this site
  patrolRoute?: PatrolCheckpoint[];
}

export interface PatrolCheckpoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  order: number;
}

export interface PatrolPoint {
  id: string;
  siteId: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  order: number;
}
