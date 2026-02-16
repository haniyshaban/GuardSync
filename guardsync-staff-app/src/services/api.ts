// API Configuration and base service
// Points to the guardwise-platform Express server
import { API_BASE_URL } from '@/lib/utils';
import { ApiService, ApiResponse } from '@guardsync/api-client';

const API_ENDPOINT = `${API_BASE_URL}/api`;
const TOKEN_STORAGE_KEY = 'guardsync_staff_auth_token';

export type { ApiResponse };

export const api = new ApiService({
  baseUrl: API_ENDPOINT,
  tokenStorageKey: TOKEN_STORAGE_KEY,
});

export default api;
