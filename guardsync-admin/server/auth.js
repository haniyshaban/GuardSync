import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import logger from './logger.js';

// JWT Secret Configuration
// In production: MUST be set via environment variable
// In development: Uses a cryptographically random fallback (regenerated on each restart)
let JWT_SECRET;

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      '❌ FATAL: JWT_SECRET environment variable is required in production. ' +
      'Generate one with: openssl rand -hex 64'
    );
  }
  JWT_SECRET = process.env.JWT_SECRET;
} else {
  // Development mode
  if (!process.env.JWT_SECRET) {
    // Generate a cryptographically random secret for dev
    // Note: This means dev tokens expire on server restart, which is acceptable for development
    JWT_SECRET = crypto.randomBytes(64).toString('hex');
    logger.warn('Using auto-generated JWT secret for development. Set JWT_SECRET env var for production.');
  } else {
    JWT_SECRET = process.env.JWT_SECRET;
  }
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export function signToken(payload, opts = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, ...opts });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function authMiddleware(required = true, roles = []) {
  return (req, res, next) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      if (required) return res.status(401).json({ error: 'Unauthorized' });
      return next();
    }

    try {
      const decoded = verifyToken(token);
      req.user = decoded;
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

export async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function comparePassword(plain, hashedOrPlainFromDb, onPlainMatchRehash) {
  if (!hashedOrPlainFromDb) return false;
  const looksHashed = typeof hashedOrPlainFromDb === 'string' && hashedOrPlainFromDb.startsWith('$2');
  if (looksHashed) {
    return bcrypt.compare(plain, hashedOrPlainFromDb);
  }
  // Backward-compat: match plaintext and optionally rehash
  const match = plain === hashedOrPlainFromDb;
  if (match && typeof onPlainMatchRehash === 'function') {
    try {
      const newHash = await hashPassword(plain);
      await onPlainMatchRehash(newHash);
    } catch (_) {}
  }
  return match;
}
