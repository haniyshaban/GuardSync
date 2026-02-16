/**
 * Conveyance request type definitions
 */

import type { Location, ConveyanceStatus } from './common';

export interface ConveyanceRequest {
  id: string;
  guardId: string;
  guardName: string;
  siteId: string;
  siteName: string;
  reason: string;
  requestedAt: string;
  status: ConveyanceStatus;
  respondedAt?: string;
  respondedBy?: string;
  staffNotes?: string;
  estimatedDuration?: number; // in minutes
  currentLocation?: Location;
}
