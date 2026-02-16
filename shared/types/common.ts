/**
 * Common types and enums shared across all GuardSync apps
 */

// Unified guard status encompassing all app-specific statuses
export type GuardStatus = 
  | 'online'      // Admin: actively connected/pinging
  | 'offline'     // Admin: disconnected
  | 'idle'        // Admin: no activity
  | 'alert'       // Admin: alert state
  | 'panic'       // Admin: panic button pressed
  | 'pending'     // Admin: pending activation
  | 'active'      // Guard app: on duty
  | 'on-break'    // Guard app: on break
  | 'off-duty';   // Guard app: off duty

export type OnboardingStatus = 'pending' | 'verified' | 'active';

export type ShiftType = 'day' | 'night' | 'scheduled' | 'in-progress' | 'completed' | 'missed';

export type LeaveType = 'casual' | 'sick' | 'emergency' | 'annual';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export type AttendanceStatus = 'present' | 'absent' | 'half-day' | 'late';

export type StaffRole = 'field_officer' | 'supervisor' | 'admin';

export type StaffStatus = 'online' | 'offline' | 'on_duty';

export type AlertStatus = 'pending' | 'acknowledged' | 'missed' | 'success';

export type VerificationMethod = 'facial' | 'manual';

export type GeofenceType = 'radius' | 'polygon';

export type FaceRecognitionProvider = 'local' | 'aws-rekognition';

export type MapProvider = 'openstreetmap' | 'google-maps';

export type GeofenceStrictness = 'low' | 'medium' | 'high';

export type ReportType = 'voice_note' | 'video' | 'incident';

export type MediaType = 'audio' | 'video';

export type ConveyanceStatus = 'pending' | 'approved' | 'denied';

export type PayrollStatus = 'draft' | 'finalized' | 'paid';

export type TransportStatus = 'active' | 'completed';

export interface Location {
  lat: number;
  lng: number;
}

export interface LocationWithTimestamp extends Location {
  at?: Date;
  timestamp?: string;
}

// Standard API response types for consistent error and success handling
export interface ApiError {
  code: string;        // machine-readable: 'GUARD_NOT_FOUND', 'VALIDATION_ERROR', 'UNAUTHORIZED'
  message: string;     // human-readable: 'Guard with ID x not found'
  details?: any[];     // optional: validation errors, field-level errors
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;    // optional success message
}
