/**
 * Generate a cryptographically secure UUID v4
 * Works in both Node.js and browser environments
 * @returns UUID v4 string
 */
export const generateId = (): string => {
  // Browser environment - use native Web Crypto API
  if (typeof window !== 'undefined' && typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Node.js environment - use crypto module
  if (typeof window === 'undefined') {
    // Dynamic import for Node.js only
    const { randomUUID } = require('crypto');
    return randomUUID();
  }
  
  // Fallback for older browsers (should rarely happen)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Generate a cryptographically secure UUID v4
 * Alias for generateId() for backward compatibility
 * @returns UUID v4 string
 */
export const generateUUID = (): string => {
  return generateId();
};

/**
 * Generate a cryptographically secure UUID v4
 * Returns full UUID instead of short ID for collision safety
 * @returns UUID v4 string
 */
export const generateShortId = (): string => {
  return generateId();
};

/**
 * Generate a cryptographically secure UUID v4 for client-side use
 * Uses the browser's native crypto.randomUUID() when available
 * @returns UUID v4 string
 */
export const generateClientId = (): string => {
  return generateId();
};
