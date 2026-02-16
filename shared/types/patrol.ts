/**
 * Patrol tracking type definitions
 */

export interface PatrolLog {
  id: string;
  guardId: string;
  patrolPointId: string;
  patrolPointName?: string;
  shiftId?: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  withinRadius: boolean;
  distanceFromPoint?: number;
}
