/**
 * Staff type definitions
 */

import type { StaffRole, StaffStatus } from './common';

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  role: StaffRole;
  assignedArea?: string;
  status: StaffStatus;
}
