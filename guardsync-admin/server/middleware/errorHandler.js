import { serverError, badRequest } from '../utils/responses.js';
import logger from '../logger.js';

/**
 * Global error handler middleware
 * Catches all unhandled errors and returns a standardized error response
 * 
 * This should be the LAST middleware in the Express app
 */
export function errorHandler(err, req, res, next) {
  // Log the error with full context
  logger.error({ 
    err, 
    req: { 
      id: req.id,
      method: req.method, 
      url: req.url, 
      body: process.env.NODE_ENV === 'development' ? req.body : undefined 
    } 
  }, 'Request failed');
  
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }
  
  // Handle multer file upload errors
  if (err.message && err.message.includes('file type')) {
    return badRequest(res, err.message);
  }
  
  // Handle other errors
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const code = statusCode === 500 ? 'INTERNAL_ERROR' : 'ERROR';
  
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}

/**
 * 404 Not Found handler for undefined routes
 * Should be registered after all route handlers but before error handler
 */
export function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`
    }
  });
}
