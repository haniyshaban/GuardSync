import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { signToken } from '../auth.js';
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

describe('Leave requests', () => {
  let testData;
  let guardToken;
  let adminToken;

  beforeEach(async () => {
    testDb = createTestDb();
    testData = await seedTestData(testDb);
    testDb.prepare(`INSERT INTO guards (id, name, phone, email, employeeId, siteId, status) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('test-guard-2', 'Other Guard', '+91-2222222222', 'other@test.com', 'GW-2026-0002', testData.siteId, 'offline');
    guardToken = signToken({ id: testData.guardId, role: 'guard' });
    adminToken = signToken({ id: testData.staffId, role: 'admin' });
  });

  afterEach(() => {
    cleanupTestDb(testDb);
    testDb = null;
  });

  const addLeave = (id, guardId, status = 'pending') => testDb.prepare(
    `INSERT INTO leave_requests (id, guardId, startDate, endDate, reason, leaveType, status, appliedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, guardId, '2026-11-02', '2026-11-03', 'Family function', 'casual', status, new Date().toISOString());
  const exists = (id) => !!testDb.prepare('SELECT id FROM leave_requests WHERE id = ?').get(id);

  it('accepts annual leave', async () => {
    const response = await request(app)
      .post('/api/leave-requests')
      .set('Authorization', `Bearer ${guardToken}`)
      .send({ guardId: testData.guardId, leaveType: 'annual', startDate: '2026-11-02', endDate: '2026-11-06', reason: 'Holiday' })
      .expect(201);

    expect(response.body.data).toMatchObject({ guardId: testData.guardId, leaveType: 'annual', status: 'pending' });
  });

  it('lets a guard cancel their own pending request', async () => {
    addLeave('leave-1', testData.guardId);
    await request(app)
      .delete('/api/leave-requests/leave-1')
      .set('Authorization', `Bearer ${guardToken}`)
      .expect(200);
    expect(exists('leave-1')).toBe(false);
  });

  it('does not let a guard delete a request that was already decided', async () => {
    addLeave('leave-2', testData.guardId, 'approved');
    const response = await request(app)
      .delete('/api/leave-requests/leave-2')
      .set('Authorization', `Bearer ${guardToken}`)
      .expect(403);
    expect(response.body.error.message).toBe('Only a pending leave request can be cancelled');
    expect(exists('leave-2')).toBe(true);
  });

  it('does not let a guard delete another guard\'s request', async () => {
    addLeave('leave-3', 'test-guard-2');
    await request(app)
      .delete('/api/leave-requests/leave-3')
      .set('Authorization', `Bearer ${guardToken}`)
      .expect(403);
    expect(exists('leave-3')).toBe(true);
  });

  it('still lets an admin delete any request', async () => {
    addLeave('leave-4', 'test-guard-2', 'rejected');
    await request(app)
      .delete('/api/leave-requests/leave-4')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(exists('leave-4')).toBe(false);
  });

  it('answers 404 for a request that does not exist', async () => {
    await request(app)
      .delete('/api/leave-requests/no-such-request')
      .set('Authorization', `Bearer ${guardToken}`)
      .expect(404);
  });
});
