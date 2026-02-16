/**
 * Material transport tracking type definitions
 */

import type { TransportStatus } from './common';

export interface TransportSession {
  id: string;
  guardId: string;
  startTime: string;
  endTime?: string;
  status: TransportStatus;
  locationHistory: LocationPing[];
}

export interface LocationPing {
  timestamp: string;
  latitude: number;
  longitude: number;
}
