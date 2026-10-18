// Guard API Service - Handles all guard-related API calls
import api, { ApiResponse } from './api';
import {
  Guard,
  AttendanceLog,
  LeaveRequest,
  PatrolLog,
  WakeAlert,
  PayrollRecord,
  TransportSession,
} from '@/types/guard';

// ============ Enrollment & Profile ============

export interface EnrollmentData {
  fullName: string;
  email: string;
  phone: string;
  address?: string;
  emergencyContact?: string;
  aadharNumber: string;
  panNumber: string;
  bankDetails: {
    accountNumber: string;
    ifsc: string;
    bankName: string;
    accountHolderName: string;
  };
}

export const submitEnrollment = async (
  data: EnrollmentData,
  files: {
    photograph?: File;
    aadharDoc?: File;
    panDoc?: File;
    relievingLetter?: File;
  }
): Promise<ApiResponse<Guard>> => {
  const formData = new FormData();
  
  // Append text data
  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'object') {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, value);
    }
  });

  // Append files
  if (files.photograph) formData.append('photograph', files.photograph);
  if (files.aadharDoc) formData.append('aadharDoc', files.aadharDoc);
  if (files.panDoc) formData.append('panDoc', files.panDoc);
  if (files.relievingLetter) formData.append('relievingLetter', files.relievingLetter);

  return api.uploadFile('/guards/enroll', formData);
};

export const updateOnboardingStatus = async (
  guardId: string,
  status: 'pending' | 'verified' | 'active'
): Promise<ApiResponse<Guard>> => {
  return api.put(`/guards/${guardId}/onboarding-status`, { status });
};

export const getGuardProfile = async (guardId: string): Promise<ApiResponse<Guard>> => {
  return api.get(`/guards/${guardId}`);
};

export const updateGuardProfile = async (
  guardId: string,
  updates: Partial<Guard>
): Promise<ApiResponse<Guard>> => {
  return api.put(`/guards/${guardId}`, updates);
};

// ============ Face enrolment ============

/** Saves the guard's face descriptor the first time they scan (see PUT /guards/:id/face) */
export const saveFaceDescriptor = async (
  guardId: string,
  faceDescriptor: string
): Promise<ApiResponse<{ guardId: string; enrolled: boolean }>> => {
  return api.put(`/guards/${guardId}/face`, { faceDescriptor });
};

/** Asks the server whether a scan matches the guard's enrolled face. The enrolled face stays on the server. */
export const verifyFace = async (
  guardId: string,
  faceDescriptor: string
): Promise<ApiResponse<{ match: boolean }>> => {
  return api.post(`/guards/${guardId}/face/verify`, { faceDescriptor });
};

// ============ Attendance ============

export const clockIn = async (
  guardId: string,
  data: {
    siteId?: string;
    shiftId?: string;
    latitude?: number;
    longitude?: number;
    withinGeofence: boolean;
    selfieUrl?: string;
    /** The face template from the scan; the server checks it against the enrolled one */
    faceDescriptor?: string;
  }
): Promise<ApiResponse<AttendanceLog>> => {
  // The API expects siteId, lat and lng (see clockInSchema on the server)
  return api.post('/attendance/clock-in', {
    guardId,
    siteId: data.siteId,
    lat: data.latitude,
    lng: data.longitude,
    withinGeofence: data.withinGeofence,
    faceDescriptor: data.faceDescriptor,
  });
};

export const clockOut = async (
  guardId: string,
  data: {
    latitude: number;
    longitude: number;
    withinGeofence: boolean;
    selfieUrl?: string;
  }
): Promise<ApiResponse<AttendanceLog>> => {
  return api.post('/attendance/clock-out', { guardId, ...data });
};

export const getAttendanceLogs = async (
  guardId: string,
  month?: number,
  year?: number
): Promise<ApiResponse<AttendanceLog[]>> => {
  const params = new URLSearchParams({ guardId });
  if (month) params.append('month', month.toString());
  if (year) params.append('year', year.toString());
  return api.get(`/attendance/logs?${params}`);
};

// ============ Leave Management ============

export const submitLeaveRequest = async (
  guardId: string,
  data: {
    startDate: string;
    endDate: string;
    reason: string;
    leaveType: 'casual' | 'sick' | 'emergency' | 'annual';
  }
): Promise<ApiResponse<LeaveRequest>> => {
  return api.post('/leave-requests', { guardId, ...data });
};

export const getLeaveRequests = async (
  guardId: string
): Promise<ApiResponse<LeaveRequest[]>> => {
  return api.get(`/leave-requests?guardId=${encodeURIComponent(guardId)}`);
};

/** A guard can cancel their own request while it is still pending */
export const cancelLeaveRequest = async (
  leaveId: string
): Promise<ApiResponse<{ ok: boolean }>> => {
  return api.delete(`/leave-requests/${leaveId}`);
};

// ============ Patrol ============

export const logPatrolPoint = async (
  guardId: string,
  data: {
    patrolPointId: string;
    patrolPointName: string;
    shiftId?: string;
    latitude: number;
    longitude: number;
    withinRadius: boolean;
    distanceFromPoint?: number;
  }
): Promise<ApiResponse<PatrolLog>> => {
  const { latitude, longitude, ...rest } = data;
  return api.post('/patrol-logs', { guardId, ...rest, lat: latitude, lng: longitude });
};

export const getPatrolLogs = async (
  guardId: string,
  shiftId?: string
): Promise<ApiResponse<PatrolLog[]>> => {
  const params = new URLSearchParams();
  if (shiftId) params.append('shiftId', shiftId);
  const query = params.toString();
  return api.get(`/patrol-logs/${guardId}${query ? `?${query}` : ''}`);
};

// ============ Wake Alerts ============

export const logWakeAlert = async (
  guardId: string,
  data: {
    shiftId?: string;
    triggeredAt: string;
    respondedAt?: string;
    status: 'pending' | 'success' | 'missed';
    responseTimeSeconds?: number;
  }
): Promise<ApiResponse<WakeAlert>> => {
  return api.post('/wake-alerts/log', { guardId, ...data });
};

export const getWakeAlerts = async (
  guardId: string,
  shiftId?: string
): Promise<ApiResponse<WakeAlert[]>> => {
  const params = new URLSearchParams({ guardId });
  if (shiftId) params.append('shiftId', shiftId);
  return api.get(`/wake-alerts?${params}`);
};

// ============ Transport ============

export const startTransportSession = async (
  guardId: string
): Promise<ApiResponse<TransportSession>> => {
  return api.post('/transport/start', { guardId });
};

export const endTransportSession = async (
  sessionId: string
): Promise<ApiResponse<TransportSession>> => {
  return api.post(`/transport/${sessionId}/end`, {});
};

export const updateTransportLocation = async (
  sessionId: string,
  location: { latitude: number; longitude: number }
): Promise<ApiResponse<void>> => {
  return api.post(`/transport/${sessionId}/location`, location);
};

// ============ Payroll ============

export const getPayrollRecord = async (
  guardId: string,
  month: number,
  year: number
): Promise<ApiResponse<PayrollRecord>> => {
  // One month's payslip; the server works it out from attendance if it doesn't exist yet.
  // (GET /payroll/:guardId without month and year is the list of all records.)
  return api.get(`/payroll/${guardId}/${month}/${year}`);
};

export const getPayrollHistory = async (
  guardId: string
): Promise<ApiResponse<PayrollRecord[]>> => {
  return api.get(`/payroll/${guardId}`);
};

// ============ Conveyance Requests ============

export interface ConveyanceRequest {
  id: string;
  guardId: string;
  guardName: string;
  siteId: string;
  siteName: string;
  reason: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'denied';
  respondedAt?: string;
  respondedBy?: string;
  staffNotes?: string;
  estimatedDuration?: number;
  currentLocation?: {
    lat: number;
    lng: number;
  };
}

export interface ConveyanceRequestPayload {
  guardId: string;
  siteId?: string;
  reason: string;
  estimatedDuration?: number;
  currentLocation?: {
    lat: number;
    lng: number;
  };
}

export const submitConveyanceRequest = async (
  payload: ConveyanceRequestPayload
): Promise<ApiResponse<ConveyanceRequest>> => {
  return api.post('/conveyance/request', payload);
};

export const getConveyanceStatus = async (
  guardId: string
): Promise<ApiResponse<ConveyanceRequest | null>> => {
  return api.get(`/conveyance/status/${guardId}`);
};

export const cancelConveyanceRequest = async (
  requestId: string
): Promise<ApiResponse<{ success: boolean }>> => {
  return api.delete(`/conveyance/${requestId}`);
};

export const getConveyanceHistory = async (
  guardId: string
): Promise<ApiResponse<ConveyanceRequest[]>> => {
  return api.get(`/conveyance/history/${guardId}`);
};

// ============ Stats & Profile ============

export interface GuardStats {
  shiftsCompleted: number;
  attendanceRate: number;
  patrolsCompleted: number;
}

export const getGuardStats = async (guardId: string): Promise<ApiResponse<GuardStats>> => {
  return api.get(`/stats/guard/${guardId}`);
};

// ============ Notifications ============

export interface Notification {
  id: string;
  guardId: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export const getNotifications = async (guardId: string): Promise<ApiResponse<Notification[]>> => {
  return api.get(`/notifications/${guardId}`);
};

export const markNotificationAsRead = async (notificationId: string): Promise<ApiResponse<void>> => {
  return api.put(`/notifications/${notificationId}/read`, {});
};

export const markAllNotificationsAsRead = async (guardId: string): Promise<ApiResponse<void>> => {
  return api.put(`/notifications/${guardId}/read-all`, {});
};

export const createNotification = async (data: {
  guardId: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
}): Promise<ApiResponse<Notification>> => {
  return api.post('/notifications', data);
};

// ============ Schedules ============

export interface Schedule {
  id: string;
  guardId: string;
  date: string;
  startTime: string;
  endTime: string;
  siteId: string;
  siteName: string;
  isNightShift: boolean;
}

export const getSchedules = async (
  guardId: string,
  from?: string,
  to?: string
): Promise<ApiResponse<Schedule[]>> => {
  const params = new URLSearchParams({ guardId });
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  return api.get(`/schedules/${guardId}?${params}`);
};

// ============ SOS Alerts ============

export interface SOSAlert {
  id: string;
  guardId: string;
  guardName: string;
  siteId?: string;
  siteName?: string;
  lat?: number;
  lng?: number;
  message: string;
  timestamp: string;
  status: 'active' | 'resolved';
}

export const sendSOSAlert = async (data: {
  guardId: string;
  guardName: string;
  // Left out when the guard has no site
  siteId?: string;
  siteName?: string;
  lat?: number;
  lng?: number;
  message: string;
}): Promise<ApiResponse<SOSAlert>> => {
  return api.post('/sos-alerts', data);
};

// ============ Location Updates ============

export const updateGuardLocation = async (
  guardId: string,
  location: { lat: number; lng: number }
): Promise<ApiResponse<void>> => {
  return api.put(`/guards/${guardId}/location`, location);
};

// ============ File Upload ============
// There is no upload call here on purpose. The server's upload route is POST /uploads (outside
// /api) and needs a login, so an enrolling guard, who has no account yet, cannot upload; the
// old call went to /api/upload, which does not exist, and every file was silently dropped.

// Export as namespace
export const GuardAPI = {
  submitEnrollment,
  updateOnboardingStatus,
  getGuardProfile,
  updateGuardProfile,
  clockIn,
  clockOut,
  getAttendanceLogs,
  submitLeaveRequest,
  getLeaveRequests,
  cancelLeaveRequest,
  logPatrolPoint,
  getPatrolLogs,
  logWakeAlert,
  getWakeAlerts,
  startTransportSession,
  endTransportSession,
  updateTransportLocation,
  getPayrollRecord,
  getPayrollHistory,
  submitConveyanceRequest,
  getConveyanceStatus,
  cancelConveyanceRequest,
  getConveyanceHistory,
  getGuardStats,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
  getSchedules,
  sendSOSAlert,
  updateGuardLocation,
};

export default GuardAPI;
