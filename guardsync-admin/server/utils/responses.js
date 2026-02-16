/**
 * Standard API response utilities for consistent error and success responses
 * 
 * Success response shape:
 * {
 *   success: true,
 *   data: T,
 *   message?: string
 * }
 * 
 * Error response shape:
 * {
 *   success: false,
 *   error: {
 *     code: string,        // machine-readable: 'GUARD_NOT_FOUND', 'VALIDATION_ERROR'
 *     message: string,     // human-readable: 'Guard with ID x not found'
 *     details?: any[]      // optional: validation errors, field-level errors
 *   }
 * }
 */

/**
 * Send a successful API response
 * @param {object} res - Express response object
 * @param {any} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {string|null} message - Optional success message
 */
export function success(res, data, statusCode = 200, message = null) {
  const response = { success: true, data };
  if (message) {
    response.message = message;
  }
  return res.status(statusCode).json(response);
}

/**
 * Send an error API response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Machine-readable error code
 * @param {string} message - Human-readable error message
 * @param {any[]|null} details - Optional error details
 */
export function error(res, statusCode, code, message, details = null) {
  const response = {
    success: false,
    error: { code, message }
  };
  if (details) {
    response.error.details = details;
  }
  return res.status(statusCode).json(response);
}

// Shorthand helper functions for common errors

/**
 * Send a 404 Not Found error
 * @param {object} res - Express response object
 * @param {string} entity - Entity type (e.g., 'guard', 'user')
 * @param {string|number} id - Entity ID
 */
export function notFound(res, entity, id) {
  return error(
    res,
    404,
    `${entity.toUpperCase()}_NOT_FOUND`,
    `${entity.charAt(0).toUpperCase() + entity.slice(1)} with ID ${id} not found`
  );
}

/**
 * Send a 400 Bad Request error
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {any[]|null} details - Optional validation details
 */
export function badRequest(res, message, details = null) {
  return error(res, 400, 'VALIDATION_ERROR', message, details);
}

/**
 * Send a 401 Unauthorized error
 * @param {object} res - Express response object
 * @param {string} message - Error message
 */
export function unauthorized(res, message = 'Unauthorized') {
  return error(res, 401, 'UNAUTHORIZED', message);
}

/**
 * Send a 403 Forbidden error
 * @param {object} res - Express response object
 * @param {string} message - Error message
 */
export function forbidden(res, message = 'Forbidden') {
  return error(res, 403, 'FORBIDDEN', message);
}

/**
 * Send a 500 Internal Server Error
 * @param {object} res - Express response object
 * @param {string} message - Error message
 */
export function serverError(res, message = 'Internal server error') {
  return error(res, 500, 'INTERNAL_ERROR', message);
}

/**
 * Send a 409 Conflict error
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {any[]|null} details - Optional conflict details
 */
export function conflict(res, message, details = null) {
  return error(res, 409, 'CONFLICT', message, details);
}

/**
 * Send a 201 Created success response
 * @param {object} res - Express response object
 * @param {any} data - Created resource data
 * @param {string|null} message - Optional success message
 */
export function created(res, data, message = null) {
  return success(res, data, 201, message);
}

/**
 * Send a 204 No Content success response
 * @param {object} res - Express response object
 */
export function noContent(res) {
  return res.status(204).send();
}
