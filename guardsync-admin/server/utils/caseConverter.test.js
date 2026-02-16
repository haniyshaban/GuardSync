/**
 * Tests for Case Converter Utility
 * 
 * Tests cover:
 * - Basic snake_case to camelCase conversion
 * - Basic camelCase to snake_case conversion
 * - Nested objects
 * - Arrays
 * - Null and undefined values
 * - Date objects
 * - Edge cases
 */

import { snakeToCamel, camelToSnake } from './caseConverter.js';
import assert from 'assert';

console.log('Running Case Converter Tests...\n');

// Test 1: Basic snake_case to camelCase
console.log('Test 1: Basic snake_case to camelCase');
const snakeObj = {
  employee_id: 'EMP001',
  site_id: 'SITE001',
  clock_in_time: '2024-01-01T08:00:00Z',
  first_name: 'John',
  last_name: 'Doe'
};
const camelResult = snakeToCamel(snakeObj);
assert.strictEqual(camelResult.employeeId, 'EMP001');
assert.strictEqual(camelResult.siteId, 'SITE001');
assert.strictEqual(camelResult.clockInTime, '2024-01-01T08:00:00Z');
assert.strictEqual(camelResult.firstName, 'John');
assert.strictEqual(camelResult.lastName, 'Doe');
assert.strictEqual(camelResult.employee_id, undefined); // Original keys should not exist
console.log('✅ Passed\n');

// Test 2: Basic camelCase to snake_case
console.log('Test 2: Basic camelCase to snake_case');
const camelObj = {
  employeeId: 'EMP001',
  siteId: 'SITE001',
  clockInTime: '2024-01-01T08:00:00Z',
  firstName: 'John',
  lastName: 'Doe'
};
const snakeResult = camelToSnake(camelObj);
assert.strictEqual(snakeResult.employee_id, 'EMP001');
assert.strictEqual(snakeResult.site_id, 'SITE001');
assert.strictEqual(snakeResult.clock_in_time, '2024-01-01T08:00:00Z');
assert.strictEqual(snakeResult.first_name, 'John');
assert.strictEqual(snakeResult.last_name, 'Doe');
assert.strictEqual(snakeResult.employeeId, undefined); // Original keys should not exist
console.log('✅ Passed\n');

// Test 3: Nested objects
console.log('Test 3: Nested objects');
const nestedSnake = {
  employee_id: 'EMP001',
  personal_info: {
    first_name: 'John',
    last_name: 'Doe',
    home_address: {
      street_name: 'Main St',
      postal_code: '12345'
    }
  }
};
const nestedCamel = snakeToCamel(nestedSnake);
assert.strictEqual(nestedCamel.employeeId, 'EMP001');
assert.strictEqual(nestedCamel.personalInfo.firstName, 'John');
assert.strictEqual(nestedCamel.personalInfo.lastName, 'Doe');
assert.strictEqual(nestedCamel.personalInfo.homeAddress.streetName, 'Main St');
assert.strictEqual(nestedCamel.personalInfo.homeAddress.postalCode, '12345');
console.log('✅ Passed\n');

// Test 4: Arrays
console.log('Test 4: Arrays');
const arraySnake = {
  employee_list: [
    { employee_id: 'EMP001', first_name: 'John' },
    { employee_id: 'EMP002', first_name: 'Jane' }
  ]
};
const arrayCamel = snakeToCamel(arraySnake);
assert.strictEqual(arrayCamel.employeeList.length, 2);
assert.strictEqual(arrayCamel.employeeList[0].employeeId, 'EMP001');
assert.strictEqual(arrayCamel.employeeList[0].firstName, 'John');
assert.strictEqual(arrayCamel.employeeList[1].employeeId, 'EMP002');
assert.strictEqual(arrayCamel.employeeList[1].firstName, 'Jane');
console.log('✅ Passed\n');

// Test 5: Null and undefined values
console.log('Test 5: Null and undefined values');
assert.strictEqual(snakeToCamel(null), null);
assert.strictEqual(snakeToCamel(undefined), undefined);
assert.strictEqual(camelToSnake(null), null);
assert.strictEqual(camelToSnake(undefined), undefined);

const objWithNulls = {
  employee_id: 'EMP001',
  site_id: null,
  clock_in_time: undefined
};
const convertedNulls = snakeToCamel(objWithNulls);
assert.strictEqual(convertedNulls.employeeId, 'EMP001');
assert.strictEqual(convertedNulls.siteId, null);
assert.strictEqual(convertedNulls.clockInTime, undefined);
console.log('✅ Passed\n');

// Test 6: Primitive values (should return as-is)
console.log('Test 6: Primitive values');
assert.strictEqual(snakeToCamel('hello'), 'hello');
assert.strictEqual(snakeToCamel(123), 123);
assert.strictEqual(snakeToCamel(true), true);
assert.strictEqual(camelToSnake('hello'), 'hello');
assert.strictEqual(camelToSnake(123), 123);
assert.strictEqual(camelToSnake(false), false);
console.log('✅ Passed\n');

// Test 7: Date objects (should preserve)
console.log('Test 7: Date objects');
const dateObj = new Date('2024-01-01');
const objWithDate = {
  employee_id: 'EMP001',
  join_date: dateObj
};
const convertedDate = snakeToCamel(objWithDate);
assert.strictEqual(convertedDate.joinDate instanceof Date, true);
assert.strictEqual(convertedDate.joinDate.getTime(), dateObj.getTime());
console.log('✅ Passed\n');

// Test 8: Empty objects and arrays
console.log('Test 8: Empty objects and arrays');
const emptyObj = snakeToCamel({});
assert.deepStrictEqual(emptyObj, {});
const emptyArr = snakeToCamel([]);
assert.deepStrictEqual(emptyArr, []);
console.log('✅ Passed\n');

// Test 9: Mixed case fields (already camelCase should remain)
console.log('Test 9: Fields without underscores');
const mixedObj = {
  id: '123',
  name: 'John',
  employee_id: 'EMP001'
};
const mixedResult = snakeToCamel(mixedObj);
assert.strictEqual(mixedResult.id, '123');
assert.strictEqual(mixedResult.name, 'John');
assert.strictEqual(mixedResult.employeeId, 'EMP001');
console.log('✅ Passed\n');

// Test 10: Round-trip conversion
console.log('Test 10: Round-trip conversion');
const original = {
  employee_id: 'EMP001',
  site_id: 'SITE001',
  nested_data: {
    first_name: 'John',
    last_name: 'Doe'
  }
};
const toCamel = snakeToCamel(original);
const backToSnake = camelToSnake(toCamel);
assert.strictEqual(backToSnake.employee_id, 'EMP001');
assert.strictEqual(backToSnake.site_id, 'SITE001');
assert.strictEqual(backToSnake.nested_data.first_name, 'John');
assert.strictEqual(backToSnake.nested_data.last_name, 'Doe');
console.log('✅ Passed\n');

// Test 11: Array of primitives
console.log('Test 11: Array of primitives');
const primitiveArray = [1, 'hello', true, null];
const convertedPrimitives = snakeToCamel(primitiveArray);
assert.deepStrictEqual(convertedPrimitives, [1, 'hello', true, null]);
console.log('✅ Passed\n');

// Test 12: Complex nested structure
console.log('Test 12: Complex nested structure');
const complex = {
  employee_data: {
    personal_info: {
      full_name: 'John Doe',
      contact_numbers: ['123', '456']
    },
    work_history: [
      { company_name: 'ABC Corp', start_date: '2020-01-01' },
      { company_name: 'XYZ Inc', start_date: '2022-01-01' }
    ]
  }
};
const complexResult = snakeToCamel(complex);
assert.strictEqual(complexResult.employeeData.personalInfo.fullName, 'John Doe');
assert.deepStrictEqual(complexResult.employeeData.personalInfo.contactNumbers, ['123', '456']);
assert.strictEqual(complexResult.employeeData.workHistory[0].companyName, 'ABC Corp');
assert.strictEqual(complexResult.employeeData.workHistory[0].startDate, '2020-01-01');
assert.strictEqual(complexResult.employeeData.workHistory[1].companyName, 'XYZ Inc');
console.log('✅ Passed\n');

console.log('========================================');
console.log('✅ All Case Converter Tests Passed!');
console.log('========================================');
