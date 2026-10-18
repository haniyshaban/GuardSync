import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { signToken } from '../auth.js';
import { decrypt } from '../encryption.js';
import { validate, validateQuery } from '../validation/index.js';
import { updateGuardSchema, updateGuardProfileSchema } from '../validation/guard.schemas.js';
import { clockInSchema } from '../validation/attendance.schemas.js';
import { loginSchema } from '../validation/auth.schemas.js';
import { createLeaveRequestSchema } from '../validation/leave.schemas.js';
import { patrolLogQuerySchema } from '../validation/patrol.schemas.js';
import { camelToSnake } from '../utils/caseConverter.js';
import { createTestDb, seedTestData, cleanupTestDb } from './helpers.js';

// Mock the db module (the real repositories run against the test database)
let testDb;
vi.mock('../db.js', () => ({
  default: new Proxy({}, {
    get: (target, prop) => {
      if (testDb && typeof testDb[prop] === 'function') {
        return testDb[prop].bind(testDb);
      }
      return testDb?.[prop];
    }
  }),
  siteRowToObj: (row) => ({ ...row, isActive: !!row.isActive }),
}));

// Run a validation middleware the way Express would, with the body as the case converter
// leaves it (snake_case keys)
function run(middleware, input, where = 'body') {
  const req = { [where]: camelToSnake(input) };
  let outcome = null;
  const res = { status: (code) => ({ json: (body) => { outcome = { code, body }; } }) };
  middleware(req, res, () => { outcome = { next: true, value: req[where] }; });
  return outcome;
}

describe('validate()', () => {
  it('keeps two-word fields for a camelCase schema whose fields are all optional', () => {
    const outcome = run(validate(updateGuardSchema), { siteId: 'site-2', shiftType: 'night', currentShiftId: null });
    expect(outcome.next).toBe(true);
    expect(outcome.value).toEqual({ siteId: 'site-2', shiftType: 'night', currentShiftId: null });
  });

  it('keeps every field of the guard profile form', () => {
    const outcome = run(validate(updateGuardProfileSchema), {
      address: 'MG Road', emergencyContact: '+91 9000000099', bankName: 'Canara Bank',
    });
    expect(outcome.value).toEqual({ address: 'MG Road', emergencyContact: '+91 9000000099', bankName: 'Canara Bank' });
  });

  it('gives a snake_case schema snake_case keys', () => {
    const outcome = run(validate(clockInSchema), { guardId: 'g-1', siteId: 's-1', withinGeofence: true });
    expect(outcome.value).toEqual({ guard_id: 'g-1', site_id: 's-1', within_geofence: true });
  });

  it('works for single-word schemas and schemas with a refine()', () => {
    expect(run(validate(loginSchema), { email: 'a@b.co', password: 'secret123' }).value)
      .toEqual({ email: 'a@b.co', password: 'secret123' });
    expect(run(validate(createLeaveRequestSchema), {
      guardId: 'g-1', startDate: '2026-01-01', endDate: '2026-01-02', reason: 'Wedding', leaveType: 'sick',
    }).value).toEqual({ guardId: 'g-1', startDate: '2026-01-01', endDate: '2026-01-02', reason: 'Wedding', leaveType: 'sick' });
  });

  it('drops fields the schema does not list', () => {
    const outcome = run(validate(updateGuardSchema), { name: 'Ravi', success: true, data: { x: 1 } });
    expect(outcome.value).toEqual({ name: 'Ravi' });
  });

  it('reports the first problem in plain words', () => {
    const outcome = run(validate(updateGuardSchema), { phone: 'abc' });
    expect(outcome.code).toBe(400);
    expect(outcome.body.error.code).toBe('VALIDATION_ERROR');
    expect(outcome.body.error.message).toBe('phone: Phone must be at least 10 characters');
  });

  it('names the field the way the app sends it, also for snake_case schemas', () => {
    const outcome = run(validate(clockInSchema), { guardId: 'g-1' });
    expect(outcome.body.error.message).toBe('siteId: Required');
  });

  it('reports a refine() problem with its own message', () => {
    const outcome = run(validate(createLeaveRequestSchema), {
      guardId: 'g-1', startDate: '2026-01-05', endDate: '2026-01-01', reason: 'x',
    });
    expect(outcome.body.error.message).toBe('endDate: End date must be after or equal to start date');
  });
});

describe('validateQuery()', () => {
  it('keeps two-word query parameters for a camelCase schema', () => {
    const outcome = run(validateQuery(patrolLogQuerySchema), { shiftId: 'shift-1', date: '2026-01-01' }, 'query');
    expect(outcome.value).toEqual({ shiftId: 'shift-1', date: '2026-01-01' });
  });
});

describe('Routes see the fields that were sent', () => {
  let testData;
  let adminToken;
  let guardToken;

  beforeEach(async () => {
    testDb = createTestDb();
    testData = await seedTestData(testDb);
    adminToken = signToken({ id: testData.staffId, role: 'admin' });
    guardToken = signToken({ id: testData.guardId, role: 'guard' });
  });

  afterEach(() => {
    cleanupTestDb(testDb);
    testDb = null;
  });

  it('saves the settings page (PUT /api/config)', async () => {
    await request(app)
      .put('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ locationUpdateInterval: 45, geofenceStrictness: 'high', autoClockOut: false })
      .expect(200);

    const response = await request(app).get('/api/config').expect(200);
    expect(response.body.data).toMatchObject({ locationUpdateInterval: 45, geofenceStrictness: 'high', autoClockOut: false });
  });

  it('refuses an out-of-range setting with a plain message', async () => {
    const response = await request(app)
      .put('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ locationUpdateInterval: 500 })
      .expect(400);
    expect(response.body.error.message).toBe('locationUpdateInterval: Number must be less than or equal to 300');
  });

  it('saves a guard\'s emergency contact and bank name (PUT /api/guards/:id/profile)', async () => {
    await request(app)
      .put(`/api/guards/${testData.guardId}/profile`)
      .set('Authorization', `Bearer ${guardToken}`)
      .send({ address: 'MG Road, Bangalore', emergencyContact: '+91 9000000099', bankName: 'Canara Bank' })
      .expect(200);

    const row = testDb.prepare('SELECT address, emergencyContact, bankName FROM guards WHERE id = ?').get(testData.guardId);
    expect(decrypt(row.address)).toBe('MG Road, Bangalore');
    expect(decrypt(row.emergencyContact)).toBe('+91 9000000099');
    expect(decrypt(row.bankName)).toBe('Canara Bank');
  });
});
