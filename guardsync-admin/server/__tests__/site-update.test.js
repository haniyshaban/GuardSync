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

const checkpoints = (n) => Array.from({ length: n }, (_, i) => ({
  id: `pp-${i + 1}`, name: `Checkpoint ${i + 1}`, latitude: 40.71 + i / 1000, longitude: -74.0, radiusMeters: 15, order: i + 1,
}));

describe('Sites keep what was not changed', () => {
  let testData;
  let staffToken;
  let adminToken;

  beforeEach(async () => {
    testDb = createTestDb();
    testData = await seedTestData(testDb);
    testDb.prepare(`INSERT INTO staff (id, name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('test-staff-2', 'Test Officer', 'officer@test.com', 'x', 'staff', new Date().toISOString());
    staffToken = signToken({ id: 'test-staff-2', role: 'staff' });
    adminToken = signToken({ id: testData.staffId, role: 'admin' });

    // A second guard on the site, and a pending enrolment that names it
    testDb.prepare(`INSERT INTO guards (id, name, phone, email, employeeId, siteId, status) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('test-guard-2', 'Second Guard', '+91-2222222222', 'second@test.com', 'GW-2026-0002', testData.siteId, 'offline');
    testDb.prepare(`INSERT INTO guards (id, name, phone, email, employeeId, siteId, status) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('test-guard-3', 'Pending Guard', '+91-3333333333', 'pending@test.com', 'GW-2026-0003', testData.siteId, 'pending');
    for (const guardId of [testData.guardId, 'test-guard-2']) {
      testDb.prepare('INSERT INTO site_guards (id, site_id, guard_id) VALUES (?, ?, ?)').run(`sg-${guardId}`, testData.siteId, guardId);
    }
    checkpoints(2).forEach((p) => testDb.prepare(
      'INSERT INTO site_patrol_points (id, site_id, name, latitude, longitude, radius_meters, point_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(p.id, testData.siteId, p.name, p.latitude, p.longitude, p.radiusMeters, p.order));
  });

  afterEach(() => {
    cleanupTestDb(testDb);
    testDb = null;
  });

  const put = (body, token = staffToken) => request(app)
    .put(`/api/sites/${testData.siteId}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
  const getSite = async () => (await request(app)
    .get(`/api/sites/${testData.siteId}`)
    .set('Authorization', `Bearer ${staffToken}`)
    .expect(200)).body.data;

  describe('PUT /api/sites/:id', () => {
    it('changes the name and nothing else', async () => {
      await put({ name: 'Renamed Site' }).expect(200);

      const site = await getSite();
      expect(site).toMatchObject({
        name: 'Renamed Site', address: '123 Test Street', geofenceRadius: 100, isActive: true,
        assignedGuards: [testData.guardId, 'test-guard-2'],
      });
      expect(site.patrolRoute).toHaveLength(2);
    });

    it('can switch a site to inactive and back without touching the rest', async () => {
      await put({ isActive: false }).expect(200);
      let site = await getSite();
      expect(site).toMatchObject({ isActive: false, geofenceRadius: 100 });
      expect(site.assignedGuards).toHaveLength(2);
      expect(site.patrolRoute).toHaveLength(2);

      await put({ isActive: true }).expect(200);
      site = await getSite();
      expect(site.isActive).toBe(true);
    });

    it('saves the radius and replaces the patrol route when they are sent', async () => {
      await put({ geofenceType: 'radius', geofenceRadius: 250, patrolRoute: checkpoints(3) }).expect(200);

      const site = await getSite();
      expect(site.geofenceRadius).toBe(250);
      expect(site.patrolRoute.map((p) => p.name)).toEqual(['Checkpoint 1', 'Checkpoint 2', 'Checkpoint 3']);
      expect(site.assignedGuards).toHaveLength(2);
    });

    it('saves a polygon geofence', async () => {
      const polygon = [{ lat: 40.71, lng: -74.0 }, { lat: 40.72, lng: -74.0 }, { lat: 40.72, lng: -74.01 }];
      await put({ geofenceType: 'polygon', geofencePolygon: polygon }).expect(200);

      const site = await getSite();
      expect(site.geofenceType).toBe('polygon');
      expect(site.geofencePolygon).toEqual(polygon);
      expect(site.geofenceRadius).toBe(100);
    });

    it('replaces the assigned guards when the list is sent, also with an empty list', async () => {
      await put({ assignedGuards: ['test-guard-2'] }).expect(200);
      expect((await getSite()).assignedGuards).toEqual(['test-guard-2']);

      await put({ assignedGuards: [] }).expect(200);
      expect((await getSite()).assignedGuards).toEqual([]);
    });

    it('accepts the whole site sent back, as an older dashboard does', async () => {
      const site = await getSite();
      await put({ ...site, isActive: false }).expect(200);

      const saved = await getSite();
      expect(saved).toMatchObject({ isActive: false, geofenceRadius: 100, name: 'Test Site' });
      expect(saved.patrolRoute).toHaveLength(2);
    });

    it('explains an invalid value', async () => {
      const response = await put({ geofenceRadius: 0 }).expect(400);
      expect(response.body.error.message).toBe('geofenceRadius: Geofence radius must be at least 10 meters');
    });

    it('returns 404 for a site that does not exist', async () => {
      await request(app)
        .put('/api/sites/no-such-site')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'x' })
        .expect(404);
    });
  });

  describe('DELETE /api/sites/:id', () => {
    const guard = (id) => testDb.prepare('SELECT siteId, status FROM guards WHERE id = ?').get(id);
    const count = (table) => testDb.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE site_id = ?`).get(testData.siteId).c;

    it('unassigns the site\'s guards and removes what belonged to the site', async () => {
      const response = await request(app)
        .delete(`/api/sites/${testData.siteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.unassignedGuards).toBe(3);
      expect(guard(testData.guardId)).toEqual({ siteId: null, status: 'unassigned' });
      expect(guard('test-guard-2')).toEqual({ siteId: null, status: 'unassigned' });
      // An enrolment waiting for approval stays pending
      expect(guard('test-guard-3')).toEqual({ siteId: null, status: 'pending' });
      expect(count('site_guards')).toBe(0);
      expect(count('site_patrol_points')).toBe(0);
      expect(testDb.prepare('SELECT COUNT(*) AS c FROM sites WHERE id = ?').get(testData.siteId).c).toBe(0);
    });

    it('returns 404 for a site that does not exist', async () => {
      await request(app)
        .delete('/api/sites/no-such-site')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('is admin only', async () => {
      await request(app)
        .delete(`/api/sites/${testData.siteId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
      expect(guard(testData.guardId).siteId).toBe(testData.siteId);
    });
  });

  describe('POST /api/sites', () => {
    it('creates an active site with its own id and patrol route', async () => {
      const response = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'New Site', address: '5 New Road', location: { lat: 41.0, lng: -73.0 }, geofenceRadius: 120, patrolRoute: checkpoints(1).map((p) => ({ ...p, id: 'pp-new-1' })) })
        .expect(201);

      expect(response.body.data.id).toEqual(expect.any(String));
      expect(response.body.data).toMatchObject({ name: 'New Site', isActive: true, geofenceRadius: 120 });
      expect(response.body.data.patrolRoute).toHaveLength(1);
    });
  });
});
