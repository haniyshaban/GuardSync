// API Configuration and base service
// Points to the guardwise-platform Express server
import { API_BASE_URL as BASE_URL } from '@/lib/utils';
import { ApiService, ApiResponse } from '@guardsync/api-client';

const API_BASE_URL = BASE_URL + '/api';
const TOKEN_STORAGE_KEY = 'guardsync_auth_token';

export type { ApiResponse };

export const api = new ApiService({
  baseUrl: API_BASE_URL,
  tokenStorageKey: TOKEN_STORAGE_KEY,
});

export default api;
