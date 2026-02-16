/**
 * Case Converter Middleware
 * 
 * Automatically converts between camelCase (frontend) and snake_case (backend/database)
 * - Request middleware: converts incoming camelCase JSON bodies to snake_case
 * - Response middleware: wraps res.json() to convert snake_case output to camelCase
 */

import { snakeToCamel, camelToSnake } from '../utils/caseConverter.js';

/**
 * Request middleware: Converts incoming request body from camelCase to snake_case
 * This allows route handlers to work directly with snake_case DB column names
 */
export function convertRequestCase(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = camelToSnake(req.body);
  }
  
  // Also convert query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = camelToSnake(req.query);
  }
  
  next();
}

/**
 * Response middleware: Wraps res.json() to convert snake_case responses to camelCase
 * This ensures the frontend always receives camelCase data
 */
export function convertResponseCase(req, res, next) {
  // Store original json function
  const originalJson = res.json.bind(res);
  
  // Override res.json()
  res.json = function(data) {
    // Convert snake_case to camelCase before sending
    const convertedData = snakeToCamel(data);
    return originalJson(convertedData);
  };
  
  next();
}

/**
 * Combined middleware: Apply both request and response conversion
 */
export function caseConverterMiddleware(req, res, next) {
  // Convert request
  if (req.body && typeof req.body === 'object') {
    req.body = camelToSnake(req.body);
  }
  
  if (req.query && typeof req.query === 'object') {
    req.query = camelToSnake(req.query);
  }
  
  // Override res.json for response conversion
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    const convertedData = snakeToCamel(data);
    return originalJson(convertedData);
  };
  
  next();
}

export default caseConverterMiddleware;
