import crypto from 'crypto';

// AES-256-GCM requires a 32-byte key (256 bits)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits authentication tag
const ENCODING = 'base64';

/**
 * Get the encryption key from environment variables.
 * In production, ENCRYPTION_KEY must be set.
 * In development, falls back to a hardcoded key with a warning.
 * 
 * @returns {Buffer} - 32-byte encryption key
 */
function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (envKey) {
    // Convert hex string to buffer (must be 64 hex chars = 32 bytes)
    if (envKey.length !== 64) {
      throw new Error(
        'ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes). ' +
        'Generate one with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"'
      );
    }
    
    try {
      return Buffer.from(envKey, 'hex');
    } catch (err) {
      throw new Error('ENCRYPTION_KEY must be a valid hexadecimal string');
    }
  }
  
  // Production requires explicit key
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required in production. ' +
      'Generate a secure key with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"'
    );
  }
  
  // Development fallback with warning
  // Note: Using process.stderr to avoid circular dependency with logger
  process.stderr.write('⚠️  WARNING: Using hardcoded encryption key for development. DO NOT use in production!\n');
  // Hardcoded dev key (NEVER use this in production!)
  return Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
}

// Cache the key to avoid repeated environment lookups and warnings
let cachedKey = null;

/**
 * Encrypt plaintext using AES-256-GCM
 * 
 * @param {string} plaintext - The data to encrypt
 * @returns {string} - Encrypted data in format: iv:authTag:ciphertext (all base64)
 */
export function encrypt(plaintext) {
  if (!plaintext) {
    return null;
  }
  
  // Convert to string if not already
  const text = String(plaintext);
  
  // Get or cache the encryption key
  if (!cachedKey) {
    cachedKey = getEncryptionKey();
  }
  
  // Generate random IV for each encryption (never reuse IVs!)
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, cachedKey, iv);
  
  // Encrypt the data
  let encrypted = cipher.update(text, 'utf8', ENCODING);
  encrypted += cipher.final(ENCODING);
  
  // Get the authentication tag
  const authTag = cipher.getAuthTag();
  
  // Return format: iv:authTag:ciphertext (all base64 encoded)
  return `${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted}`;
}

/**
 * Decrypt ciphertext that was encrypted with encrypt()
 * 
 * @param {string} encryptedString - Encrypted data in format: iv:authTag:ciphertext
 * @returns {string} - Decrypted plaintext
 */
export function decrypt(encryptedString) {
  if (!encryptedString) {
    return null;
  }
  
  // Check if it's in the expected format
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    // If not in encrypted format, assume it's plaintext (for migration compatibility)
    return encryptedString;
  }
  
  const [ivBase64, authTagBase64, encryptedData] = parts;
  
  try {
    // Get or cache the encryption key
    if (!cachedKey) {
      cachedKey = getEncryptionKey();
    }
    
    // Convert from base64
    const iv = Buffer.from(ivBase64, ENCODING);
    const authTag = Buffer.from(authTagBase64, ENCODING);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, cachedKey, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedData, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    // Log decryption error to stderr to avoid circular dependency with logger
    process.stderr.write(`Decryption error: ${err.message}\n`);
    // If decryption fails, return null rather than exposing potentially corrupted data
    return null;
  }
}

/**
 * Check if a value is already encrypted
 * 
 * @param {string} value - Value to check
 * @returns {boolean} - True if the value appears to be encrypted
 */
export function isEncrypted(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  
  // Check for the format: base64:base64:base64
  const parts = value.split(':');
  if (parts.length !== 3) {
    return false;
  }
  
  // Basic validation that parts look like base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return parts.every(part => base64Regex.test(part) && part.length > 0);
}

/**
 * Generate a random encryption key (for setup/configuration)
 * Run: node -e "import('./encryption.js').then(m => console.log(m.generateKey()))"
 */
export function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}
