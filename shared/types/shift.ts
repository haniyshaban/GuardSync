/**
 * Shift type definitions
 * Unified across admin and guard apps
 */

export interface Shift {
  id: string;
  
  // Admin app fields
  label?: string;
  // daysOfWeek: 0 (Sunday) - 6 (Saturday)
  daysOfWeek?: number[];
  
  // Guard app fields
  date?: string;
  location?: string;
  siteId?: string;
  checkInTime?: string;
  checkOutTime?: string;
  status?: 'scheduled' | 'in-progress' | 'completed' | 'missed';
  isNightShift?: boolean;
  
  // Common fields (ISO-like local times in HH:mm format)
  startTime: string;
  endTime: string;
}
