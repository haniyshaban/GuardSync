import { z } from 'zod';
import { snakeToCamel } from '../utils/caseConverter.js';

/**
 * Validation middleware factory
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
export function validate(schema) {
  return (req, res, next) => {
    // Request bodies are converted to snake_case before they get here. Some schemas are
    // written in snake_case and some in camelCase, so try the body both ways.
    let result = schema.safeParse(req.body);
    if (!result.success) {
      const camel = schema.safeParse(snakeToCamel(req.body));
      if (camel.success) result = camel;
    }
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: result.error.issues,
        }
      });
    }
    req.body = result.data; // use parsed/sanitized data
    next();
  };
}

/**
 * URL parameter validation middleware factory
 * @param {Object} paramSchemas - Object mapping param names to Zod schemas
 * @returns {Function} Express middleware
 */
export function validateParams(paramSchemas) {
  return (req, res, next) => {
    const schema = z.object(paramSchemas);
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid URL parameters',
          details: result.error.issues,
        }
      });
    }
    req.params = result.data;
    next();
  };
}

/**
 * Query parameter validation middleware factory
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: result.error.issues,
        }
      });
    }
    req.query = result.data;
    next();
  };
}

// Common reusable schemas
export const commonSchemas = {
  id: z.string().min(1, 'ID cannot be empty'),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(10, 'Phone must be at least 10 characters').max(15, 'Phone must be at most 15 characters'),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  datetimeISO: z.string().datetime('Invalid ISO datetime'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  status: z.enum(['pending', 'active', 'approved', 'rejected', 'completed', 'cancelled']),
};
