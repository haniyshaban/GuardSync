# @guardsync/api-client

Shared API client service for GuardSync applications.

## Overview

This package provides a unified API service layer used by both the Guard App and Staff App. It eliminates code duplication and ensures consistent API communication across all GuardSync applications.

## Features

- **Unified API Interface**: Single implementation of HTTP methods (GET, POST, PUT, DELETE)
- **Authentication**: Automatic JWT token handling with `Authorization` header injection
- **Token Management**: Configurable localStorage token persistence
- **File Uploads**: Support for multipart form data uploads
- **Type Safety**: Full TypeScript support with generic responses

## Usage

### Basic Setup

```typescript
import { ApiService, ApiResponse } from '@guardsync/api-client';

// Initialize with configuration
const api = new ApiService({
  baseUrl: 'https://api.example.com/api',
  tokenStorageKey: 'my_app_auth_token', // Optional, defaults to 'guardsync_auth_token'
});

// Or use simple string initialization
const api = new ApiService('https://api.example.com/api');
```

### Authentication

```typescript
// Set authentication token
api.setToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');

// Get current token
const token = api.getToken();

// Clear token (logout)
api.clearToken();
```

### Making Requests

```typescript
// GET request
const response = await api.get<User>('/users/123');
if (response.success) {
  console.log(response.data);
}

// POST request
const response = await api.post<User>('/users', {
  name: 'John Doe',
  email: 'john@example.com',
});

// PUT request
const response = await api.put<User>('/users/123', {
  name: 'Jane Doe',
});

// DELETE request
const response = await api.delete('/users/123');

// File upload
const formData = new FormData();
formData.append('file', file);
const response = await api.uploadFile('/uploads', formData);
```

### Response Format

All responses follow the `ApiResponse<T>` interface:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

## Integration

### In Guard App (guardsync-guard-app)

```typescript
// src/services/api.ts
import { ApiService, ApiResponse } from '@guardsync/api-client';

export type { ApiResponse };

export const api = new ApiService({
  baseUrl: API_BASE_URL + '/api',
  tokenStorageKey: 'guardsync_auth_token',
});

export default api;
```

### In Staff App (guardsync-staff-app)

```typescript
// src/services/api.ts
import { ApiService, ApiResponse } from '@guardsync/api-client';

export type { ApiResponse };

export const api = new ApiService({
  baseUrl: API_BASE_URL + '/api',
  tokenStorageKey: 'guardsync_staff_auth_token',
});

export default api;
```

## Benefits

✅ **DRY Principle**: Single source of truth for API logic  
✅ **Maintainability**: Bug fixes and features applied once  
✅ **Consistency**: Same behavior across all apps  
✅ **Type Safety**: Full TypeScript support  
✅ **Flexibility**: Configurable per-app settings (token keys, base URLs)

## Development

This is a workspace package meant to be used locally within the GuardSync monorepo.

**Dependencies in consuming apps** are defined as:
```json
"@guardsync/api-client": "file:../../shared/api-client"
```

Any changes to this package will be immediately reflected in both apps.
