/**
 * Case Converter Utility
 * 
 * Provides utilities for converting between snake_case and camelCase.
 * Handles nested objects, arrays, null values, and dates.
 */

/**
 * Converts a snake_case string to camelCase
 * @param {string} str - The snake_case string
 * @returns {string} The camelCase string
 */
function snakeToCamelCase(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

/**
 * Converts a camelCase string to snake_case
 * @param {string} str - The camelCase string
 * @returns {string} The snake_case string
 */
function camelToSnakeCase(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/([A-Z])/g, (match, letter) => `_${letter.toLowerCase()}`);
}

/**
 * Checks if value is a plain object (not Date, Array, null, etc.)
 * @param {*} obj - The value to check
 * @returns {boolean} True if plain object
 */
function isPlainObject(obj) {
  return obj !== null && 
         typeof obj === 'object' && 
         !Array.isArray(obj) && 
         !(obj instanceof Date) &&
         !(obj instanceof RegExp) &&
         Object.prototype.toString.call(obj) === '[object Object]';
}

/**
 * Converts object keys from snake_case to camelCase
 * @param {*} obj - The object, array, or primitive to convert
 * @returns {*} The converted object with camelCase keys
 */
export function snakeToCamel(obj) {
  // Handle null, undefined, primitives
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  // Handle Date objects - return as-is
  if (obj instanceof Date) {
    return obj;
  }

  // Handle Arrays - recursively convert each element
  if (Array.isArray(obj)) {
    return obj.map(item => snakeToCamel(item));
  }

  // Handle plain objects
  if (isPlainObject(obj)) {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = snakeToCamelCase(key);
      converted[camelKey] = snakeToCamel(value);
    }
    return converted;
  }

  // Return other object types as-is (RegExp, etc.)
  return obj;
}

/**
 * Converts object keys from camelCase to snake_case
 * @param {*} obj - The object, array, or primitive to convert
 * @returns {*} The converted object with snake_case keys
 */
export function camelToSnake(obj) {
  // Handle null, undefined, primitives
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  // Handle Date objects - return as-is
  if (obj instanceof Date) {
    return obj;
  }

  // Handle Arrays - recursively convert each element
  if (Array.isArray(obj)) {
    return obj.map(item => camelToSnake(item));
  }

  // Handle plain objects
  if (isPlainObject(obj)) {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = camelToSnakeCase(key);
      converted[snakeKey] = camelToSnake(value);
    }
    return converted;
  }

  // Return other object types as-is (RegExp, etc.)
  return obj;
}

export default {
  snakeToCamel,
  camelToSnake
};
