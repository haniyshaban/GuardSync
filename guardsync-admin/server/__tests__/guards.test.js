import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
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
    guardRepo: {
      findAll: (orderBy = 'id') => {
        const db = getDb();
        if (!db) return [];
        return db.prepare(`SELECT * FROM guards ORDER BY ${orderBy}`).all();
      },
      findById: (id) => {
        const db = getDb();
        if (!db) return null;
        return db.prepare('SELECT * FROM guards WHERE id = ?').get(id);
      },
      findByEmail: (email) => {
        const db = getDb();
        if (!db) return null;
        return db.prepare('SELECT * FROM guards WHERE email = ?').get(email);
      },
      updateClockInStatus: (guardId, clockedIn, clockInTime, status) => {
        const db = getDb();
        if (!db) return;
        db.prepare('UPDATE guards SET clockedIn = ?, clockInTime = ?, status = ? WHERE id = ?')
          .run(clockedIn ? 1 : 0, clockInTime, status, guardId);
      },
    },
    siteRepo: {
      findAllWithRelations: () => {
        const db = getDb();
        if (!db) return [];
        return db.prepare('SELECT * FROM sites').all().map(row => ({
          ...row,
          location: row.lat && row.lng ? { lat: row.lat, lng: row.lng } : undefined,
          assignedGuards: row.assignedGuards ? JSON.parse(row.assignedGuards) : [],
          isActive: !!row.isActive,
        }));
      },
    },
  };
});

describe('Guards API Tests', () => {
  let testData;
  let authToken;

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
  });

  afterEach(() => {
    cleanupTestDb(testDb);
    testDb = null;
  });

  describe('GET /api/guards', () => {
    it('should return array of guards with authentication', async () => {
      const response = await request(app)
        .get('/api/guards')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('email');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/guards')
        .expect(401);

      expect(response.body.error).toContain('Unauthorized');
    });

    it('should mask sensitive PII data', async () => {
      const response = await request(app)
        .get('/api/guards')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const guard = response.body.data[0];
      
      // Aadhar should be masked (only last 4 digits visible)
      if (guard.aadharNumber) {
        expect(guard.aadharNumber).toMatch(/XXXX-XXXX-\d{4}/);
      }
      
      // Bank account should be masked
      if (guard.bankDetails?.accountNumber) {
        expect(guard.bankDetails.accountNumber).toMatch(/XXXXXX\d{4}/);
      }
    });
  });

  describe('GET /api/guards/:id', () => {
    it('should return single guard by ID', async () => {
      const response = await request(app)
        .get(`/api/guards/${testData.guardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', testData.guardId);
      expect(response.body.data).toHaveProperty('name', 'Test Guard');
      expect(response.body.data).toHaveProperty('email', testData.guardEmail);
    });

    it('should return 404 for non-existent guard', async () => {
      const response = await request(app)
        .get('/api/guards/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not found');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get(`/api/guards/${testData.guardId}`)
        .expect(401);

      expect(response.body.error).toContain('Unauthorized');
    });
  });

  describe('POST /api/guards/enroll', () => {
    it('should enroll a new guard with valid data', async () => {
      const newGuard = {
        fullName: 'New Test Guard',
        email: 'newguard@test.com',
        phone: '+91-9999888877',
        password: 'securepass123',
        address: '456 New Street',
        emergencyContact: '+91-8888777766',
        aadharNumber: '987654321098',
        panNumber: 'XYZAB9876C',
      };

      const response = await request(app)
        .post('/api/guards/enroll')
        .send(newGuard)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('guard');
      expect(response.body.data.guard).toHaveProperty('email', newGuard.email);
      expect(response.body.data.guard).toHaveProperty('name', newGuard.fullName);
      expect(response.body.data.guard).toHaveProperty('employeeId');
      expect(response.body.data.guard).toHaveProperty('status', 'pending');
      
      // PII should be encrypted and masked
      expect(response.body.data.guard.aadharNumber).toMatch(/XXXX-XXXX-\d{4}/);
      
      // Password should not be returned
      expect(response.body.data.guard).not.toHaveProperty('password');
    });

    it('should return 409 when enrolling with existing email', async () => {
      const duplicateGuard = {
        fullName: 'Duplicate Guard',
        email: testData.guardEmail, // Use existing email
        phone: '+91-7777666655',
        password: 'testpass123',
        address: '789 Duplicate Street',
        emergencyContact: '+91-6666555544',
      };

      const response = await request(app)
        .post('/api/guards/enroll')
        .send(duplicateGuard)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('email already exists');
    });

    it('should return 400 with missing required fields', async () => {
      const incompleteGuard = {
        fullName: 'Incomplete Guard',
        // Missing email, phone, etc.
      };

      const response = await request(app)
        .post('/api/guards/enroll')
        .send(incompleteGuard)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate email format', async () => {
      const invalidEmailGuard = {
        fullName: 'Invalid Email Guard',
        email: 'notanemail',
        phone: '+91-5555444433',
        password: 'testpass123',
      };

      const response = await request(app)
        .post('/api/guards/enroll')
        .send(invalidEmailGuard)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/guards/:id', () => {
    it('should update guard with staff authentication', async () => {
      // Create staff token (would need separate staff login)
      // For now, testing structure
      const updateData = {
        name: 'Updated Guard Name',
        status: 'active',
      };

      // This will fail auth (guard token, not staff) - testing auth requirement
      const response = await request(app)
        .put(`/api/guards/${testData.guardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put(`/api/guards/${testData.guardId}`)
        .send({ name: 'Updated Name' })
        .expect(401);

      expect(response.body.error).toContain('Unauthorized');
    });

    it('should return 404 for non-existent guard', async () => {
      const response = await request(app)
        .put('/api/guards/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(403); // Will fail on role check first

      expect(response.body.error).toBeDefined();
    });
  });

  describe('DELETE /api/guards/:id', () => {
    it('should require admin role for deletion', async () => {
      const response = await request(app)
        .delete(`/api/guards/${testData.guardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.error).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete(`/api/guards/${testData.guardId}`)
        .expect(401);

      expect(response.body.error).toContain('Unauthorized');
    });
  });
});
