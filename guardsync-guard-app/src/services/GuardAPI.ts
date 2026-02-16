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

// ============ Attendance ============

export const clockIn = async (
  guardId: string,
  data: {
    shiftId?: string;
    latitude: number;
    longitude: number;
    withinGeofence: boolean;
    selfieUrl?: string;
  }
): Promise<ApiResponse<AttendanceLog>> => {
  return api.post('/attendance/clock-in', { guardId, ...data });
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
  return api.post('/leave/request', { guardId, ...data });
};

export const getLeaveRequests = async (
  guardId: string
): Promise<ApiResponse<LeaveRequest[]>> => {
  return api.get(`/leave/guard/${guardId}`);
};

export const cancelLeaveRequest = async (
  leaveId: string
): Promise<ApiResponse<LeaveRequest>> => {
  return api.delete(`/leave/${leaveId}`);
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
  return api.post('/patrol/log', { guardId, ...data });
};

export const getPatrolLogs = async (
  guardId: string,
  shiftId?: string
): Promise<ApiResponse<PatrolLog[]>> => {
  const params = new URLSearchParams({ guardId });
  if (shiftId) params.append('shiftId', shiftId);
  return api.get(`/patrol/logs?${params}`);
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
  return api.get(`/payroll/${guardId}?month=${month}&year=${year}`);
};

export const getPayrollHistory = async (
  guardId: string
): Promise<ApiResponse<PayrollRecord[]>> => {
  return api.get(`/payroll/${guardId}/history`);
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
  siteId: string;
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
  siteId?: string | null;
  siteName?: string | null;
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

export const uploadFile = async (file: File): Promise<ApiResponse<{ url: string }>> => {
  const formData = new FormData();
  formData.append('file', file);
  return api.uploadFile('/upload', formData);
};

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
  uploadFile,
};

export default GuardAPI;
