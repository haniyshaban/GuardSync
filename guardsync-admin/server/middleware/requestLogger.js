import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import logger from '../logger.js';

/**
 * HTTP request logging middleware using pino-http
 * 
 * Features:
 * - Logs every HTTP request/response with: method, url, status code, response time
 * - Generates a unique request ID per request for tracing
 * - Attaches req.log for structured logging within route handlers
 * - Automatic serialization of req/res objects
 */
const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    // Generate unique request ID for tracing
    const requestId = randomUUID();
    req.requestId = requestId;
    return requestId;
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    } else if (res.statusCode >= 500 || err) {
      return 'error';
    }
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} completed`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} failed: ${err.message}`;
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      // Don't log sensitive headers or body in production
      headers: process.env.NODE_ENV === 'development' ? req.headers : undefined,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

export default requestLogger;
