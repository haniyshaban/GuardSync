// Services index - export all services for easy importing
export { default as api, type ApiResponse } from './api';
export { default as AadharService, maskAadharNumber, requestAadharOTP, verifyAadharOTP, resendAadharOTP } from './AadharService';
export { default as GeolocationService, getCurrentPosition, checkGeofence, checkPatrolPoint, locationWatcher, MOCK_PATROL_POINTS } from './GeolocationService';
export { default as GuardAPI } from './GuardAPI';
