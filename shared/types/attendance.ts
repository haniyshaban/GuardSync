/**
 * Attendance tracking type definitions
 * Unified across admin, guard, and staff apps
 */

import type { Location, AttendanceStatus } from './common';

export interface AttendanceLog {
  id: string;
  guardId: string;
  
  // Admin app fields
  siteId?: string;
  clockIn?: Date;
  clockOut?: Date;
  clockInLocation?: Location;
  clockOutLocation?: Location;
  clockInSelfie?: string;
  clockOutSelfie?: string;
  withinGeofence: boolean;
  notes?: string;
  
  // Guard app additional fields
  shiftId?: string;
  date?: string;
  clockInTime?: string;
  clockOutTime?: string;
  selfieUrl?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  totalHours?: number;
  status?: AttendanceStatus;
}

export interface StaffAttendance {
  id: string;
  staffId: string;
  clockInTime: string;
  clockOutTime?: string;
  shiftType: 'morning' | 'general' | 'night';
  location?: Location;
  date: string;
}
