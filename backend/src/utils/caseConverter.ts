/**
 * Utility functions to convert between camelCase and snake_case
 * Frontend uses camelCase, Database uses snake_case
 */

/**
 * Convert snake_case to camelCase
 */
export function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce((acc: any, key: string) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {});
  }

  return obj;
}

/**
 * Convert camelCase to snake_case
 */
export function toSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce((acc: any, key: string) => {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnakeCase(obj[key]);
      return acc;
    }, {});
  }

  return obj;
}

/**
 * Convert database row to camelCase API response
 */
export function dbRowToApi<T = any>(row: any): T {
  return toCamelCase(row) as T;
}

/**
 * Convert API request to database format
 */
export function apiToDbRow(data: any): any {
  return toSnakeCase(data);
}
