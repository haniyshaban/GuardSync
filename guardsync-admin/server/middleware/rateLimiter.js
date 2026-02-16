import rateLimit from 'express-rate-limit';

// Rate limiter for authentication endpoints (stricter)
export const authLimiter = rateLimit({ 
  windowMs: 60 * 1000, // 1 minute
  max: 20 // 20 requests per minute
});

// Rate limiter for upload endpoints
export const uploadLimiter = rateLimit({ 
  windowMs: 60 * 1000, // 1 minute
  max: 30 // 30 requests per minute
});
