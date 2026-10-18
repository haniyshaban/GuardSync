import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import app from '../app.js';
import { signToken } from '../auth.js';
import { seedDatabase } from '../seed.js';
import { createTestDb, cleanupTestDb } from './helpers.js';

// Mock the db module (the seed and the real repositories run against the test database)
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

// Hashing 34 demo passwords for real would only slow the test down
vi.mock('../auth.js', async (importOriginal) => ({
  ...(await importOriginal()),
  hashPassword: async () => '$2a$10$test.hash',
}));

const initialData = JSON.parse(fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'initialData.json'), 'utf-8',
));

describe('Demo seed (SEED_DEMO=true)', () => {
  const savedEnv = process.env.SEED_DEMO;

  beforeEach(async () => {
    testDb = createTestDb();
    // An existing staff account: the seed then leaves staff alone and writes no credentials file
    testDb.prepare(`INSERT INTO staff (id, name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('staff-admin', 'Admin', 'admin@test.com', 'x', 'admin', new Date().toISOString());
    process.env.SEED_DEMO = 'true';
    await seedDatabase();
  });

  afterEach(() => {
    process.env.SEED_DEMO = savedEnv;
    cleanupTestDb(testDb);
    testDb = null;
  });

  const guards = () => testDb.prepare('SELECT * FROM guards').all();

  it('seeds the demo guards', () => {
    expect(guards()).toHaveLength(initialData.guards.length);
  });

  it('moves the demo timestamps to today, keeping their order', () => {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    for (const guard of guards()) {
      const lastSeen = Date.parse(guard.lastSeen);
      expect(lastSeen).toBeLessThanOrEqual(now);
      expect(now - lastSeen).toBeLessThanOrEqual(60 * 60 * 1000 + 60 * 1000);
      expect(guard.lastSeen.slice(0, 10)).toBe(today);
      if (guard.clockedIn) expect(guard.clockInTime.slice(0, 10)).toBe(today);
    }
    // Same relative order as in initialData.json
    const original = Object.fromEntries(initialData.guards.map((g) => [g.id, Date.parse(g.lastSeen)]));
    const seeded = guards();
    for (const a of seeded) {
      for (const b of seeded) {
        if (original[a.id] < original[b.id]) expect(Date.parse(a.lastSeen)).toBeLessThanOrEqual(Date.parse(b.lastSeen));
      }
    }
  });

  it('gives every guard seeded as on duty an open attendance row for today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const onDuty = guards().filter((g) => g.clockedIn);
    expect(onDuty.length).toBeGreaterThan(0);
    for (const guard of onDuty) {
      const open = testDb.prepare('SELECT * FROM guard_attendance WHERE guardId = ? AND clockOut IS NULL').all(guard.id);
      expect(open).toHaveLength(1);
      expect(open[0]).toMatchObject({ siteId: guard.siteId, clockIn: guard.clockInTime, date: today });
    }
    const offDuty = guards().filter((g) => !g.clockedIn).map((g) => g.id);
    expect(testDb.prepare(`SELECT COUNT(*) AS c FROM guard_attendance WHERE guardId IN (${offDuty.map(() => '?').join(',')})`).get(...offDuty).c).toBe(0);
  });

  it('fills each site\'s guard list from the guards assigned to it', async () => {
    const adminToken = signToken({ id: 'staff-admin', role: 'admin' });
    const sites = (await request(app).get('/api/sites').set('Authorization', `Bearer ${adminToken}`).expect(200)).body.data;
    expect(sites).toHaveLength(initialData.sites.length);
    for (const site of sites) {
      const assigned = guards().filter((g) => g.siteId === site.id).map((g) => g.id).sort();
      expect([...site.assignedGuards].sort()).toEqual(assigned);
      expect(testDb.prepare('SELECT COUNT(*) AS c FROM site_guards WHERE site_id = ?').get(site.id).c).toBe(assigned.length);
      expect(JSON.parse(testDb.prepare('SELECT assignedGuards FROM sites WHERE id = ?').get(site.id).assignedGuards).sort()).toEqual(assigned);
    }
  });

  it('lets a guard seeded as on duty check out', async () => {
    const onDuty = guards().find((g) => g.clockedIn);
    const token = signToken({ id: onDuty.id, role: 'guard' });
    await request(app)
      .post('/api/attendance/clock-out')
      .set('Authorization', `Bearer ${token}`)
      .send({ guardId: onDuty.id })
      .expect(200);
  });
});
