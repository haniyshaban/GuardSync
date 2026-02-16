/**
 * Alert and wake-up type definitions
 */

import type { AlertStatus } from './common';

export interface WakeUpAlert {
  id: string;
  guardId: string;
  sentAt?: Date;
  respondedAt?: Date;
  status: AlertStatus;
}

export interface WakeAlert {
  id: string;
  guardId: string;
  shiftId?: string;
  triggeredAt: string;
  respondedAt?: string;
  status: AlertStatus;
  responseTimeSeconds?: number;
}

export interface SOSAlert {
  id: string;
  guardId: string;
  guardName?: string;
  location?: {
    lat: number;
    lng: number;
  };
  timestamp: string;
  status: 'active' | 'resolved' | 'false-alarm';
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
}
