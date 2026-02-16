// Shared API Client Service
// Used by both GuardSync Guard App and Staff App

import type { ApiResponse, ApiError } from '../types/common';

export type { ApiResponse, ApiError };

export interface ApiServiceConfig {
  baseUrl: string;
  tokenStorageKey?: string;
}

export class ApiService {
  private baseUrl: string;
  private token: string | null = null;
  private tokenStorageKey: string;

  constructor(config: string | ApiServiceConfig) {
    if (typeof config === 'string') {
      this.baseUrl = config;
      this.tokenStorageKey = 'guardsync_auth_token';
    } else {
      this.baseUrl = config.baseUrl;
      this.tokenStorageKey = config.tokenStorageKey || 'guardsync_auth_token';
    }
    // Load token from localStorage on initialization
    this.token = this.loadToken();
  }

  private loadToken(): string | null {
    try {
      return localStorage.getItem(this.tokenStorageKey);
    } catch {
      return null;
    }
  }

  setToken(token: string): void {
    this.token = token;
    try {
      localStorage.setItem(this.tokenStorageKey, token);
    } catch (error) {
      console.error('Failed to save token to localStorage:', error);
    }
  }

  getToken(): string | null {
    return this.token;
  }

  clearToken(): void {
    this.token = null;
    try {
      localStorage.removeItem(this.tokenStorageKey);
    } catch (error) {
      console.error('Failed to remove token from localStorage:', error);
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // Add Authorization header if token is available
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle new error response format
        return {
          success: false,
          error: data.error || { code: 'REQUEST_FAILED', message: 'Request failed' },
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        error: { 
          code: 'NETWORK_ERROR', 
          message: error instanceof Error ? error.message : 'Network error' 
        },
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async uploadFile<T>(
    endpoint: string,
    formData: FormData
  ): Promise<ApiResponse<T>> {
    try {
      const headers: HeadersInit = {};

      // Add Authorization header if token is available
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle new error response format  
        return {
          success: false,
          error: data.error || { code: 'UPLOAD_FAILED', message: 'Upload failed' },
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        error: { 
          code: 'NETWORK_ERROR', 
          message: error instanceof Error ? error.message : 'Network error' 
        },
      };
    }
  }
}
