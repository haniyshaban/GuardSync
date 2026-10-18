import rateLimit from 'express-rate-limit';

// Rate limiter for authentication endpoints (stricter)
// Failed logins: 10 per 15 minutes from one address. Successful logins do not count.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many failed attempts. Try again in 15 minutes.' } },
});

// Face checks from the guard app (check-in, wake-up checks): enough for normal use, too few to
// probe for a matching face by trial and error.
export const faceCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many face checks. Try again in 15 minutes.' } },
});

// Rate limiter for upload endpoints
export const uploadLimiter = rateLimit({ 
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { success: false, error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many uploads. Try again in a minute.' } },
});
