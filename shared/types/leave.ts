/**
 * Leave request type definitions
 */

import type { LeaveType, LeaveStatus } from './common';

export interface LeaveRequest {
  id: string;
  guardId: string;
  guardName?: string;
  startDate: string;
  endDate: string;
  reason: string;
  leaveType: LeaveType;
  status: LeaveStatus;
  appliedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNotes?: string;
}
