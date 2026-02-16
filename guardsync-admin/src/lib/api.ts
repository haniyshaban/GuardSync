// API Configuration and base service for Admin App
import { API_BASE_URL } from './utils';
import { ApiResponse } from '@guardsync/shared/types/common';

const API_ENDPOINT = `${API_BASE_URL}/api`;
const TOKEN_STORAGE_KEY = 'guardsync_admin_auth_token';

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage on initialization
    this.token = this.loadToken();
  }

  private loadToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  setToken(token: string): void {
    this.token = token;
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      console.log('✅ Token saved to localStorage');
    } catch (error) {
      console.error('Failed to save token to localStorage:', error);
    }
  }

  getToken(): string | null {
    // Always check localStorage for the latest token
    if (!this.token) {
      this.token = this.loadToken();
    }
    return this.token;
  }

  clearToken(): void {
    this.token = null;
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to remove token from localStorage:', error);
    }
  }

  private getHeaders(additionalHeaders: HeadersInit = {}): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };

    // Add Authorization header if token is available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async fetch<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: this.getHeaders(options.headers),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { code: 'REQUEST_FAILED', message: 'Request failed' } }));
      const errorMessage = error.error?.message || error.error || error.message || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.data || data;
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.fetch<T>(endpoint, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, body: unknown): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T = any>(endpoint: string, body: unknown): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.fetch<T>(endpoint, { method: 'DELETE' });
  }

  async uploadFile<T = any>(
    endpoint: string,
    formData: FormData
  ): Promise<T> {
    const headers: HeadersInit = {};

    // Add Authorization header if token is available (no Content-Type for FormData)
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { code: 'UPLOAD_FAILED', message: 'Upload failed' } }));
      const errorMessage = error.error?.message || error.error || error.message || 'Upload failed';
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.data || data;
  }
}

export const api = new ApiService(API_ENDPOINT);
export default api;

/**
 * Utility function to wrap native fetch with automatic Authorization header injection.
 * Use this as a drop-in replacement for fetch() in existing code.
 * 
 * @example
 * // Instead of: fetch(`${API_BASE_URL}/api/guards`)
 * // Use: fetchWithAuth(`${API_BASE_URL}/api/guards`)
 */
export function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = api.getToken();
  const headers = new Headers(init?.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    console.warn('No auth token available for request');
  }
  
  return fetch(input, {
    ...init,
    headers,
  });
}

/**
 * Parse API response and extract data field if present.
 * Handles both {success: true, data: [...]} and direct array responses.
 * 
 * @example
 * const res = await fetchWithAuth('/api/guards');
 * const json = await res.json();
 * const guards = parseApiData(json);
 */
export function parseApiData<T = any>(json: any): T {
  // If response has a data field, return it
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  // Otherwise return the json as-is
  return json as T;
}
