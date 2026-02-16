/**
 * Centralized configuration for the GuardSync Staff application.
 * 
 * All environment variables should be defined in:
 * - .env files for local development
 * - docker-compose.yml for Docker environments
 * - capacitor.config.ts for mobile builds
 * - Build configuration for production deployments
 */

// Get the base API URL from environment
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Derive WebSocket URL from API URL (replace http with ws)
const wsUrl = apiUrl.replace(/^http/, 'ws');

export const config = {
  /**
   * Base URL for the API server (e.g., http://localhost:4000)
   */
  apiUrl,
  
  /**
   * WebSocket URL derived from API URL (e.g., ws://localhost:4000)
   */
  wsUrl,
  
  /**
   * Full path to the API endpoints
   */
  apiEndpoint: `${apiUrl}/api`,
} as const;

// Log configuration in development (but not in production to avoid exposing URLs)
if (import.meta.env.DEV) {
  console.log('[Config] API URL:', config.apiUrl);
  console.log('[Config] WS URL:', config.wsUrl);
}
