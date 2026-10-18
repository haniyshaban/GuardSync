import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { signToken } from '../auth.js';
import { decrypt } from '../encryption.js';
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

describe('PUT /api/guards/:id saves what the dashboard edits', () => {
  let testData;
  let staffToken;

  beforeEach(async () => {
    testDb = createTestDb();
    testData = await seedTestData(testDb);
    testDb.prepare(`INSERT INTO staff (id, name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('test-staff-2', 'Test Officer', 'officer@test.com', 'x', 'staff', new Date().toISOString());
    testDb.prepare(`INSERT INTO sites (id, name, address, lat, lng, geofenceRadius, createdAt, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('test-site-2', 'Second Site', '2 Test Road', 40.75, -73.99, 150, new Date().toISOString(), 1);
    testDb.prepare('INSERT INTO site_guards (id, site_id, guard_id) VALUES (?, ?, ?)').run('sg-1', testData.siteId, testData.guardId);
    staffToken = signToken({ id: 'test-staff-2', role: 'staff' });
  });

  afterEach(() => {
    cleanupTestDb(testDb);
    testDb = null;
  });

  const put = (body) => request(app)
    .put(`/api/guards/${testData.guardId}`)
    .set('Authorization', `Bearer ${staffToken}`)
    .send(body);
  const stored = () => testDb.prepare('SELECT * FROM guards WHERE id = ?').get(testData.guardId);
  const siteGuards = () => testDb.prepare('SELECT site_id FROM site_guards WHERE guard_id = ?').all(testData.guardId).map((r) => r.site_id);

  it('saves name, phone, email, employee id, daily rate and date of joining', async () => {
    const response = await put({
      name: 'Anil Gupta', phone: '+91 9811111111', email: 'anil.gupta@test.com',
      employeeId: 'EMP-9', dailyRate: 950, dateOfJoining: '2024-03-15',
    }).expect(200);

    expect(stored()).toMatchObject({
      name: 'Anil Gupta', phone: '+91 9811111111', email: 'anil.gupta@test.com',
      employeeId: 'EMP-9', dailyRate: 950, dateOfJoining: '2024-03-15',
    });
    expect(response.body.data).toMatchObject({ email: 'anil.gupta@test.com', dailyRate: 950 });
  });

  it('only changes the fields that were sent', async () => {
    await put({ dailyRate: 900 }).expect(200);
    expect(stored()).toMatchObject({ name: 'Test Guard', email: testData.guardEmail, siteId: testData.siteId, dailyRate: 900 });
  });

  it('assigns a guard to another site', async () => {
    await put({ siteId: 'test-site-2' }).expect(200);
    expect(stored().siteId).toBe('test-site-2');
    expect(siteGuards()).toEqual(['test-site-2']);
  });

  it('unassigns a guard with siteId null', async () => {
    await put({ siteId: null }).expect(200);
    expect(stored()).toMatchObject({ siteId: null, status: 'unassigned' });
    expect(siteGuards()).toEqual([]);
  });

  it('refuses a site that does not exist', async () => {
    const response = await put({ siteId: 'no-such-site' }).expect(400);
    expect(response.body.error.message).toBe('Unknown site');
    expect(stored().siteId).toBe(testData.siteId);
  });

  it('saves the shift', async () => {
    await put({ shiftType: 'night', shiftStartTime: '20:00', shiftEndTime: '08:00' }).expect(200);
    expect(stored()).toMatchObject({ shiftType: 'night', shiftStartTime: '20:00', shiftEndTime: '08:00' });
  });

  it('refuses an email another guard already uses (409)', async () => {
    testDb.prepare(`INSERT INTO guards (id, name, phone, email, employeeId, status) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('test-guard-2', 'Other Guard', '+91-2222222222', 'other@test.com', 'GW-2026-0002', 'offline');

    const response = await put({ email: 'Other@test.com' }).expect(409);
    expect(response.body.error.message).toBe('Another guard already uses this email');
    expect(stored().email).toBe(testData.guardEmail);
  });

  it('accepts the guard\'s own email sent back unchanged', async () => {
    await put({ email: testData.guardEmail, name: 'Renamed' }).expect(200);
    expect(stored().name).toBe('Renamed');
  });

  it('still cannot move a guard into or out of pending', async () => {
    await put({ status: 'pending', shiftType: 'night' }).expect(403);
    expect(stored()).toMatchObject({ status: 'active', shiftType: 'day' });
  });

  it('does not save PII here (that goes through /profile) and does not fail on it either', async () => {
    await put({ name: 'Renamed', address: 'Somewhere else', emergencyContact: null }).expect(200);
    expect(stored().name).toBe('Renamed');
    expect(decrypt(stored().address)).toBe('123 Guard Street');
  });

  it('accepts location history entries in the demo data\'s format', async () => {
    await put({ locationHistory: [{ lat: 12.97, lng: 77.74, at: '2026-01-09T00:00:00.000Z' }] }).expect(200);
    expect(JSON.parse(stored().locationHistory)).toEqual([{ lat: 12.97, lng: 77.74, at: '2026-01-09T00:00:00.000Z' }]);
  });

  it('explains what is wrong with invalid input', async () => {
    let response = await put({ phone: 'abc' }).expect(400);
    expect(response.body.error.message).toBe('phone: Phone must be at least 10 characters');

    response = await put({ dateOfJoining: '15/03/2024' }).expect(400);
    expect(response.body.error.message).toBe('dateOfJoining: Date must be in YYYY-MM-DD format');

    response = await put({ shiftType: 'evening' }).expect(400);
    expect(response.body.error.message).toMatch(/^shiftType: /);
  });
});
