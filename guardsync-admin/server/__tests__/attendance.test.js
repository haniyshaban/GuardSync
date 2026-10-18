import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { signToken } from '../auth.js';
import { createTestDb, seedTestData, cleanupTestDb } from './helpers.js';

// Mock the db module
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
  siteRowToObj: (row) => ({
    ...row,
    location: row.lat && row.lng ? { lat: row.lat, lng: row.lng } : undefined,
    assignedGuards: row.assignedGuards ? JSON.parse(row.assignedGuards) : [],
    geofencePolygon: row.geofencePolygon ? JSON.parse(row.geofencePolygon) : null,
    patrolRoute: row.patrolRoute ? JSON.parse(row.patrolRoute) : null,
    isActive: !!row.isActive,
  }),
}));

// Mock the repositories
vi.mock('../repositories/index.js', async () => {
  const getDb = () => testDb;
  
  return {
    attendanceRepo: {
      findWithFilters: (filters) => {
        const db = getDb();
        if (!db) return [];
        
        let query = 'SELECT * FROM attendance WHERE 1=1';
        const params = [];
        
        if (filters.guardId) {
          query += ' AND guardId = ?';
          params.push(filters.guardId);
        }
        
        if (filters.siteId) {
          query += ' AND siteId = ?';
          params.push(filters.siteId);
        }
        
        if (filters.startDate) {
          query += ' AND date >= ?';
          params.push(filters.startDate);
        }
        
        if (filters.endDate) {
          query += ' AND date <= ?';
          params.push(filters.endDate);
        }
        
        query += ' ORDER BY date DESC, clockIn DESC';
        
        return db.prepare(query).all(...params);
      },
      clockIn: (guardId, siteId, lat, lng, withinGeofence) => {
        const db = getDb();
        if (!db) return;
        const now = new Date().toISOString();
        const date = now.split('T')[0];
        const id = crypto.randomUUID();
        
        db.prepare(`INSERT INTO attendance (
          id, guardId, siteId, date, clockIn, lat, lng, withinGeofence, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          id, guardId, siteId, date, now, lat, lng, withinGeofence ? 1 : 0, now
        );
        
        return id;
      },
      findActiveClockin: (guardId) => {
        const db = getDb();
        if (!db) return null;
        return db.prepare(
          'SELECT * FROM attendance WHERE guardId = ? AND clockOut IS NULL ORDER BY clockIn DESC LIMIT 1'
        ).get(guardId);
      },
      clockOut: (attendanceId, clockOut) => {
        const db = getDb();
        if (!db) return;
        db.prepare('UPDATE attendance SET clockOut = ? WHERE id = ?').run(clockOut, attendanceId);
      },
    },
    siteRepo: {
      findById: (id) => {
        const db = getDb();
        if (!db) return null;
        return db.prepare('SELECT * FROM sites WHERE id = ?').get(id);
      },
    },
    guardRepo: {
      findById: (id) => {
        const db = getDb();
        if (!db) return null;
        return db.prepare('SELECT * FROM guards WHERE id = ?').get(id);
      },
      updateClockInStatus: (guardId, clockedIn, clockInTime, status) => {
        const db = getDb();
        if (!db) return;
        db.prepare('UPDATE guards SET clockedIn = ?, clockInTime = ?, status = ? WHERE id = ?')
          .run(clockedIn ? 1 : 0, clockInTime, status, guardId);
      },
    },
  };
});

describe('Attendance API Tests', () => {
  let testData;
  let authToken;
  let adminToken;

  beforeEach(async () => {
    testDb = createTestDb();
    testData = await seedTestData(testDb);
    
    // Get auth token for protected routes
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testData.guardEmail,
        password: testData.guardPassword,
      });
    
    authToken = loginResponse.body.data.token;
    adminToken = signToken({ id: testData.staffId, role: 'admin' });
  });

  afterEach(() => {
    cleanupTestDb(testDb);
    testDb = null;
  });

  describe('POST /api/attendance/clock-in', () => {
    it('should refuse a site that does not exist', async () => {
      // The site id is shown back in admin reports, so free text (here, HTML) must not be stored
      const response = await request(app)
        .post('/api/attendance/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ guardId: testData.guardId, siteId: '<img src=x onerror=alert(1)>' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(testDb.prepare('SELECT COUNT(*) AS c FROM attendance').get().c).toBe(0);
    });

    it('should create attendance record on clock-in', async () => {
      const clockInData = {
        guardId: testData.guardId,
        siteId: testData.siteId,
        lat: 40.7128,
        lng: -74.0060,
        withinGeofence: true,
      };

      const response = await request(app)
        .post('/api/attendance/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send(clockInData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('guardId', testData.guardId);
      expect(response.body.data).toHaveProperty('siteId', testData.siteId);
      expect(response.body.data).toHaveProperty('clockIn');
      expect(response.body.data).toHaveProperty('withinGeofence', true);
      expect(response.body.data).toHaveProperty('date');
    });

    it('should accept clock-in outside geofence', async () => {
      const clockInData = {
        guardId: testData.guardId,
        siteId: testData.siteId,
        lat: 41.0000,
        lng: -75.0000,
        withinGeofence: false,
      };

      const response = await request(app)
        .post('/api/attendance/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send(clockInData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('withinGeofence', false);
    });

    it('should return 401 without authentication', async () => {
      const clockInData = {
        guardId: testData.guardId,
        siteId: testData.siteId,
        lat: 40.7128,
        lng: -74.0060,
        withinGeofence: true,
      };

      const response = await request(app)
        .post('/api/attendance/clock-in')
        .send(clockInData)
        .expect(401);

      expect(response.body.error).toEqual({ code: 'UNAUTHORIZED', message: 'Please log in again' });
    });

    it('should return 400 with missing required fields', async () => {
      const incompleteData = {
        guardId: testData.guardId,
        // Missing siteId, lat, lng
      };

      const response = await request(app)
        .post('/api/attendance/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should update guard clockedIn status', async () => {
      const clockInData = {
        guardId: testData.guardId,
        siteId: testData.siteId,
        lat: 40.7128,
        lng: -74.0060,
        withinGeofence: true,
      };

      await request(app)
        .post('/api/attendance/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send(clockInData)
        .expect(201);

      // Check guard status in database
      const guard = testDb.prepare('SELECT * FROM guards WHERE id = ?').get(testData.guardId);
      expect(guard.clockedIn).toBe(1);
      expect(guard.clockInTime).toBeDefined();
      expect(guard.status).toBe('online');
    });
  });

  describe('POST /api/attendance/clock-out', () => {
    beforeEach(async () => {
      // Clock in first
      await request(app)
        .post('/api/attendance/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          guardId: testData.guardId,
          siteId: testData.siteId,
          lat: 40.7128,
          lng: -74.0060,
          withinGeofence: true,
        });
    });

    it('should update attendance record on clock-out', async () => {
      const clockOutData = {
        guardId: testData.guardId,
      };

      const response = await request(app)
        .post('/api/attendance/clock-out')
        .set('Authorization', `Bearer ${authToken}`)
        .send(clockOutData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('guardId', testData.guardId);
      expect(response.body.data).toHaveProperty('clockIn');
      expect(response.body.data).toHaveProperty('clockOut');
    });

    it('should return 404 when no active clock-in exists', async () => {
      // Clock out once
      await request(app)
        .post('/api/attendance/clock-out')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ guardId: testData.guardId });

      // Try to clock out again without clocking in
      const response = await request(app)
        .post('/api/attendance/clock-out')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ guardId: testData.guardId })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not found');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/attendance/clock-out')
        .send({ guardId: testData.guardId })
        .expect(401);

      expect(response.body.error).toEqual({ code: 'UNAUTHORIZED', message: 'Please log in again' });
    });

    it('should return 400 with missing guardId', async () => {
      // An admin clocking a guard out has to say which guard
      const response = await request(app)
        .post('/api/attendance/clock-out')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('clocks a guard out as themselves, whatever guard id they send', async () => {
      const response = await request(app)
        .post('/api/attendance/clock-out')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ guardId: 'someone-else' })
        .expect(200);

      expect(response.body.data).toHaveProperty('guardId', testData.guardId);
    });

    it('should update guard clockedIn status to false', async () => {
      await request(app)
        .post('/api/attendance/clock-out')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ guardId: testData.guardId })
        .expect(200);

      // Check guard status in database
      const guard = testDb.prepare('SELECT * FROM guards WHERE id = ?').get(testData.guardId);
      expect(guard.clockedIn).toBe(0);
      expect(guard.clockInTime).toBeNull();
      expect(guard.status).toBe('offline');
    });
  });

  describe('GET /api/attendance', () => {
    beforeEach(async () => {
      // Create some attendance records
      const now = new Date().toISOString();
      const date = now.split('T')[0];
      
      testDb.prepare(`INSERT INTO attendance (
        id, guardId, siteId, date, clockIn, clockOut, lat, lng, withinGeofence, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'att-1',
        testData.guardId,
        testData.siteId,
        date,
        now,
        new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        40.7128,
        -74.0060,
        1,
        now
      );
    });

    it('should return attendance records with authentication', async () => {
      const response = await request(app)
        .get('/api/attendance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('guardId');
      expect(response.body.data[0]).toHaveProperty('siteId');
      expect(response.body.data[0]).toHaveProperty('clockIn');
    });

    it('should filter by guardId', async () => {
      const response = await request(app)
        .get(`/api/attendance?guardId=${testData.guardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every(record => record.guardId === testData.guardId)).toBe(true);
    });

    it('should filter by siteId', async () => {
      const response = await request(app)
        .get(`/api/attendance?siteId=${testData.siteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every(record => record.siteId === testData.siteId)).toBe(true);
    });

    it('should filter by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/attendance?startDate=${today}&endDate=${today}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every(record => record.date === today)).toBe(true);
    });

    it('should include location object when lat/lng present', async () => {
      const response = await request(app)
        .get('/api/attendance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const recordWithLocation = response.body.data.find(r => r.lat && r.lng);
      if (recordWithLocation) {
        expect(recordWithLocation).toHaveProperty('location');
        expect(recordWithLocation.location).toHaveProperty('lat');
        expect(recordWithLocation.location).toHaveProperty('lng');
      }
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/attendance')
        .expect(401);

      expect(response.body.error).toEqual({ code: 'UNAUTHORIZED', message: 'Please log in again' });
    });

    it('should return empty array when no records match filters', async () => {
      const response = await request(app)
        .get('/api/attendance?guardId=non-existent-guard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('only ever gives a guard their own records', async () => {
      const response = await request(app)
        .get('/api/attendance?guardId=non-existent-guard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every(record => record.guardId === testData.guardId)).toBe(true);
    });
  });
});
