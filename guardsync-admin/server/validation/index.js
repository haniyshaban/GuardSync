import { z } from 'zod';
import { snakeToCamel, camelToSnake } from '../utils/caseConverter.js';

/**
 * Which key style a schema is written in: 'camel', 'snake', or 'either' when its keys are
 * single words (or it is not an object schema).
 */
function keyStyle(schema) {
  let inner = schema;
  // Look through .refine(), .optional() and the like to the object underneath
  while (inner && !(inner instanceof z.ZodObject)) {
    if (inner instanceof z.ZodEffects) inner = inner.innerType();
    else if (typeof inner.unwrap === 'function') inner = inner.unwrap();
    else if (inner._def?.innerType) inner = inner._def.innerType;
    else return 'either';
  }
  if (!inner) return 'either';
  const keys = Object.keys(inner.shape);
  const camel = keys.some((key) => /[A-Z]/.test(key));
  const snake = keys.some((key) => key.includes('_'));
  if (camel && !snake) return 'camel';
  if (snake && !camel) return 'snake';
  return 'either';
}

const keyCount = (data) => (data && typeof data === 'object' ? Object.keys(data).length : 0);

/**
 * Parse input in the key style of the schema.
 * Request bodies and query strings arrive with snake_case keys (middleware/caseConverter.js),
 * while schemas are written in either style. Parsing the wrong style does not fail: an
 * all-optional schema just drops every two-word field, and the change is silently lost.
 * So the input is converted to the schema's own style and parsed once. For a schema whose keys
 * fit both styles, the parse that succeeds keeping more keys wins.
 */
function parseInSchemaStyle(schema, input) {
  const style = keyStyle(schema);
  const attempts = style === 'camel' ? [snakeToCamel(input)]
    : style === 'snake' ? [camelToSnake(input)]
    : [snakeToCamel(input), camelToSnake(input)];
  let best = null;
  for (const attempt of attempts) {
    const result = schema.safeParse(attempt);
    if (!best || (result.success && (!best.success || keyCount(result.data) > keyCount(best.data)))) {
      best = result;
    }
  }
  return best;
}

/**
 * The first problem in plain words, e.g. "phone: Phone must be at least 10 characters".
 * Field names are shown in camelCase, the way the apps send them.
 */
function firstIssueMessage(zodError) {
  const issue = zodError.issues[0];
  if (!issue) return 'Invalid request data';
  const field = issue.path
    .map((part) => (typeof part === 'string' ? part.replace(/_([a-z])/g, (m, letter) => letter.toUpperCase()) : part))
    .join('.');
  return field ? `${field}: ${issue.message}` : issue.message;
}

function validationError(res, zodError) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: firstIssueMessage(zodError),
      details: zodError.issues,
    }
  });
}

/**
 * Validation middleware factory
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = parseInSchemaStyle(schema, req.body);
    if (!result.success) return validationError(res, result.error);
    req.body = result.data; // use parsed/sanitized data, in the schema's key style
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
    // Query keys are snake_cased by the case converter too, so the same rule applies
    const result = parseInSchemaStyle(schema, req.query);
    if (!result.success) return validationError(res, result.error);
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
