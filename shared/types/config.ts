/**
 * System configuration type definitions
 */

import type { FaceRecognitionProvider, MapProvider, GeofenceStrictness } from './common';

export interface SystemConfig {
  usePremiumAPIs: boolean;
  faceRecognition: FaceRecognitionProvider;
  mapProvider: MapProvider;
  locationUpdateInterval: number;
  geofenceStrictness: GeofenceStrictness;
  autoClockOut: boolean;
  updatedAt?: string;
}

export interface DashboardStats {
  totalGuards: number;
  activeGuards: number;
  offlineGuards: number;
  alertGuards: number;
  totalSites: number;
  activeSites: number;
}
