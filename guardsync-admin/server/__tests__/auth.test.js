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

describe('Auth API Tests', () => {
  let testData;

  beforeEach(async () => {
    testDb = createTestDb();
    testData = await seedTestData(testDb);
  });

  afterEach(() => {
    cleanupTestDb(testDb);
    testDb = null;
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid guard credentials and return token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testData.guardEmail,
          password: testData.guardPassword,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('role', 'guard');
      expect(response.body.data).toHaveProperty('guard');
      expect(response.body.data.guard).toHaveProperty('email', testData.guardEmail);
      expect(response.body.data.guard).toHaveProperty('name', 'Test Guard');
    });

    it('should return 401 with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testData.guardEmail,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid email or password');
    });

    it('should return 401 with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid email or password');
    });

    it('should return 400 with missing email field', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 with missing password field', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testData.guardEmail,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'notanemail',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Protected Routes - Auth Middleware', () => {
    it('should return 401 when accessing /api/guards without token', async () => {
      const response = await request(app)
        .get('/api/guards')
        .expect(401);

      expect(response.body.error).toEqual({ code: 'UNAUTHORIZED', message: 'Please log in again' });
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/guards')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);

      expect(response.body.error).toEqual({ code: 'UNAUTHORIZED', message: 'Please log in again' });
    });

    it('should access protected route with valid token', async () => {
      // First login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testData.guardEmail,
          password: testData.guardPassword,
        })
        .expect(200);

      const token = loginResponse.body.data.token;

      // Then access protected route (a guard reads their own record)
      const response = await request(app)
        .get(`/api/guards/${testData.guardId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', testData.guardId);
    });

    it('should return 401 with malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/guards')
        .set('Authorization', 'InvalidFormat token123')
        .expect(401);

      expect(response.body.error).toEqual({ code: 'UNAUTHORIZED', message: 'Please log in again' });
    });

    it('answers a wrong role with 403 in the standard error shape', async () => {
      const guardToken = signToken({ id: testData.guardId, role: 'guard' });
      const response = await request(app)
        .get('/api/guards')
        .set('Authorization', `Bearer ${guardToken}`)
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: { code: 'FORBIDDEN', message: "You don't have permission to do this" },
      });
    });

    it('answers 401 ACCOUNT_INACTIVE once the account is removed', async () => {
      const guardToken = signToken({ id: testData.guardId, role: 'guard' });
      testDb.prepare('DELETE FROM guards WHERE id = ?').run(testData.guardId);

      const response = await request(app)
        .get(`/api/guards/${testData.guardId}`)
        .set('Authorization', `Bearer ${guardToken}`)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: { code: 'ACCOUNT_INACTIVE', message: 'This account is no longer active' },
      });
    });

    it('answers 401 ACCOUNT_INACTIVE for a disabled staff account', async () => {
      const adminToken = signToken({ id: testData.staffId, role: 'admin' });
      testDb.prepare("UPDATE staff SET status = 'disabled' WHERE id = ?").run(testData.staffId);

      const response = await request(app)
        .get('/api/guards')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('ACCOUNT_INACTIVE');
    });
  });
});
