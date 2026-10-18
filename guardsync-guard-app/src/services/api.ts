// API Configuration and base service
// Points to the guardwise-platform Express server
import { API_BASE_URL as BASE_URL } from '@/lib/utils';
import { ApiService, ApiResponse, ApiError } from '@guardsync/api-client';

const API_BASE_URL = BASE_URL + '/api';
const TOKEN_STORAGE_KEY = 'guardsync_auth_token';

export type { ApiResponse, ApiError };

// Replies to a request made without a valid session. Older servers send these as plain strings.
const SESSION_ERROR_CODES = ['UNAUTHORIZED', 'ACCOUNT_INACTIVE'];
const SESSION_ERROR_TEXTS = ['Unauthorized', 'Invalid token', 'Account is no longer active'];

/**
 * The shared client, plus two things the guard app needs:
 * - every error comes back as { code, message }, even when the server sent a plain string, and
 * - when a logged-in request is refused because the session is over (token expired, account
 *   removed or disabled), the app is told so it can log the guard out.
 */
class GuardApiService extends ApiService {
  private sessionEndedHandler: ((error: ApiError) => void) | null = null;

  onSessionEnded(handler: ((error: ApiError) => void) | null): void {
    this.sessionEndedHandler = handler;
  }

  private normalise<T>(endpoint: string, sentWithToken: boolean, response: ApiResponse<T>): ApiResponse<T> {
    if (response.success) return response;

    const raw: unknown = response.error;
    let error: ApiError;
    if (typeof raw === 'string') {
      const code = raw === 'Account is no longer active' ? 'ACCOUNT_INACTIVE'
        : SESSION_ERROR_TEXTS.includes(raw) ? 'UNAUTHORIZED'
        : raw === 'Forbidden' ? 'FORBIDDEN'
        : 'REQUEST_FAILED';
      error = { code, message: raw };
    } else if (raw && typeof raw === 'object') {
      error = raw as ApiError;
    } else {
      error = { code: 'REQUEST_FAILED', message: 'Request failed' };
    }
    if (error.code === 'NETWORK_ERROR') {
      error = { ...error, message: "Can't reach the server. Check your connection and try again." };
    }

    // A failed login is not the end of a session; neither is a reply that arrives after logout
    const isLogin = endpoint.startsWith('/auth/');
    if (SESSION_ERROR_CODES.includes(error.code) && sentWithToken && !isLogin && this.getToken()) {
      this.sessionEndedHandler?.(error);
    }

    return { ...response, error };
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const sentWithToken = !!this.getToken();
    return this.normalise(endpoint, sentWithToken, await super.get<T>(endpoint));
  }

  async post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    const sentWithToken = !!this.getToken();
    return this.normalise(endpoint, sentWithToken, await super.post<T>(endpoint, body));
  }

  async put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    const sentWithToken = !!this.getToken();
    return this.normalise(endpoint, sentWithToken, await super.put<T>(endpoint, body));
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const sentWithToken = !!this.getToken();
    return this.normalise(endpoint, sentWithToken, await super.delete<T>(endpoint));
  }

  async uploadFile<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const sentWithToken = !!this.getToken();
    return this.normalise(endpoint, sentWithToken, await super.uploadFile<T>(endpoint, formData));
  }
}

export const api = new GuardApiService({
  baseUrl: API_BASE_URL,
  tokenStorageKey: TOKEN_STORAGE_KEY,
});

export default api;
