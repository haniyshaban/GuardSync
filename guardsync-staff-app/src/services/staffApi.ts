import api, { ApiResponse } from './api';
import type { Staff, ConveyanceRequest, FieldReport, StaffAttendance } from '@/types';

// Staff Authentication
export const staffLogin = async (email: string, password: string): Promise<ApiResponse<{ staff: Staff }>> => {
  return api.post('/staff/login', { email, password });
};

// Attendance
export const clockIn = async (
  staffId: string,
  shiftType: 'morning' | 'general' | 'night',
  location?: { lat: number; lng: number }
): Promise<ApiResponse<StaffAttendance>> => {
  return api.post('/staff/attendance/clock-in', { staffId, shiftType, location });
};

export const clockOut = async (
  staffId: string,
  location?: { lat: number; lng: number }
): Promise<ApiResponse<StaffAttendance>> => {
  return api.post('/staff/attendance/clock-out', { staffId, location });
};

export const getAttendanceStatus = async (staffId: string): Promise<ApiResponse<StaffAttendance | null>> => {
  return api.get(`/staff/attendance/status/${staffId}`);
};

// Conveyance Requests
export const getPendingConveyanceRequests = async (): Promise<ApiResponse<ConveyanceRequest[]>> => {
  return api.get('/conveyance/pending');
};

export const respondToConveyanceRequest = async (
  requestId: string,
  action: 'approve' | 'deny',
  staffId: string,
  notes?: string
): Promise<ApiResponse<ConveyanceRequest>> => {
  return api.put(`/conveyance/${requestId}/respond`, { action, staffId, notes });
};

// Field Reports
export const submitFieldReport = async (
  formData: FormData
): Promise<ApiResponse<FieldReport>> => {
  return api.uploadFile('/reports/field', formData);
};

export const getFieldReports = async (staffId?: string): Promise<ApiResponse<FieldReport[]>> => {
  const endpoint = staffId ? `/reports/field?staffId=${staffId}` : '/reports/field';
  return api.get(endpoint);
};
