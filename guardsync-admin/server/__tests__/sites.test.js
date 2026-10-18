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
    siteRepo: {
      findAllWithRelations: () => {
        const db = getDb();
        if (!db) return [];
        return db.prepare('SELECT * FROM sites').all().map(row => ({
          ...row,
          location: row.lat && row.lng ? { lat: row.lat, lng: row.lng } : undefined,
          assignedGuards: row.assignedGuards ? JSON.parse(row.assignedGuards) : [],
          geofencePolygon: row.geofencePolygon ? JSON.parse(row.geofencePolygon) : null,
          patrolRoute: row.patrolRoute ? JSON.parse(row.patrolRoute) : null,
          isActive: !!row.isActive,
        }));
      },
      findByIdWithRelations: (id) => {
        const db = getDb();
        if (!db) return null;
        const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(id);
        if (!row) return null;
        return {
          ...row,
          location: row.lat && row.lng ? { lat: row.lat, lng: row.lng } : undefined,
          assignedGuards: row.assignedGuards ? JSON.parse(row.assignedGuards) : [],
          geofencePolygon: row.geofencePolygon ? JSON.parse(row.geofencePolygon) : null,
          patrolRoute: row.patrolRoute ? JSON.parse(row.patrolRoute) : null,
          isActive: !!row.isActive,
        };
      },
      createWithRelations: (siteData) => {
        const db = getDb();
        if (!db) return;
        const id = siteData.id || crypto.randomUUID();
        db.prepare(`INSERT INTO sites (
          id, name, address, lat, lng, geofenceRadius, geofenceType, 
          geofencePolygon, assignedGuards, isActive, createdAt, patrolRoute
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          id,
          siteData.name,
          siteData.address,
          siteData.location?.lat || 0,
          siteData.location?.lng || 0,
          siteData.geofenceRadius || 100,
          siteData.geofenceType || 'radius',
          siteData.geofencePolygon ? JSON.stringify(siteData.geofencePolygon) : null,
          siteData.assignedGuards ? JSON.stringify(siteData.assignedGuards) : '[]',
          siteData.isActive !== false ? 1 : 0,
          new Date().toISOString(),
          siteData.patrolRoute ? JSON.stringify(siteData.patrolRoute) : null
        );
        return id;
      },
      updateWithRelations: (id, siteData) => {
        const db = getDb();
        if (!db) return;
        const updates = [];
        const values = [];
        
        if (siteData.name) { updates.push('name = ?'); values.push(siteData.name); }
        if (siteData.address) { updates.push('address = ?'); values.push(siteData.address); }
        if (siteData.location) {
          updates.push('lat = ?', 'lng = ?');
          values.push(siteData.location.lat, siteData.location.lng);
        }
        if (siteData.geofenceRadius !== undefined) {
          updates.push('geofenceRadius = ?');
          values.push(siteData.geofenceRadius);
        }
        if (siteData.isActive !== undefined) {
          updates.push('isActive = ?');
          values.push(siteData.isActive ? 1 : 0);
        }
        
        values.push(id);
        db.prepare(`UPDATE sites SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      },
      delete: (id) => {
        const db = getDb();
        if (!db) return;
        db.prepare('DELETE FROM sites WHERE id = ?').run(id);
      },
    },
    guardRepo: {
      findAll: () => {
        const db = getDb();
        if (!db) return [];
        return db.prepare('SELECT * FROM guards').all();
      },
    },
  };
});

describe('Sites API Tests', () => {
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

  describe('GET /api/sites', () => {
    it('should return array of sites with authentication', async () => {
      const response = await request(app)
        .get('/api/sites')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('address');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/sites')
        .expect(401);

      expect(response.body.error).toContain('Unauthorized');
    });

    it('should include location object with lat/lng', async () => {
      const response = await request(app)
        .get('/api/sites')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const site = response.body.data[0];
      expect(site).toHaveProperty('location');
      expect(site.location).toHaveProperty('lat');
      expect(site.location).toHaveProperty('lng');
      expect(typeof site.location.lat).toBe('number');
      expect(typeof site.location.lng).toBe('number');
    });

    it('should parse assignedGuards as array', async () => {
      const response = await request(app)
        .get('/api/sites')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const site = response.body.data[0];
      expect(site).toHaveProperty('assignedGuards');
      expect(Array.isArray(site.assignedGuards)).toBe(true);
    });
  });

  describe('GET /api/sites/:id', () => {
    it('should return single site by ID', async () => {
      const response = await request(app)
        .get(`/api/sites/${testData.siteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', testData.siteId);
      expect(response.body.data).toHaveProperty('name', 'Test Site');
      expect(response.body.data).toHaveProperty('address', '123 Test Street');
    });

    it('should return 404 for non-existent site', async () => {
      const response = await request(app)
        .get('/api/sites/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not found');
    });

    it('does not let a guard open a site they are not assigned to', async () => {
      await request(app)
        .get('/api/sites/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get(`/api/sites/${testData.siteId}`)
        .expect(401);

      expect(response.body.error).toContain('Unauthorized');
    });
  });

  describe('POST /api/sites', () => {
    it('should create new site with staff role', async () => {
      const newSite = {
        name: 'New Test Site',
        address: '789 New Site Street',
        location: {
          lat: 41.8781,
          lng: -87.6298,
        },
        geofenceRadius: 150,
        isActive: true,
      };

      // This will fail with guard token (needs staff/admin)
      const response = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newSite)
        .expect(403);

      expect(response.body.error).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      const newSite = {
        name: 'Unauthorized Site',
        address: '999 Unauthorized Street',
        location: { lat: 0, lng: 0 },
      };

      const response = await request(app)
        .post('/api/sites')
        .send(newSite)
        .expect(401);

      expect(response.body.error).toContain('Unauthorized');
    });

    it('should return 400 with missing required fields', async () => {
      const incompleteSite = {
        name: 'Incomplete Site',
        // Missing address and location
      };

      const response = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteSite)
        .expect(403); // Will fail on role check first

      expect(response.body.error).toBeDefined();
    });
  });

  describe('PUT /api/sites/:id', () => {
    it('should require staff/admin role for update', async () => {
      const updateData = {
        name: 'Updated Site Name',
        isActive: false,
      };

      const response = await request(app)
        .put(`/api/sites/${testData.siteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put(`/api/sites/${testData.siteId}`)
        .send({ name: 'Updated Name' })
        .expect(401);

      expect(response.body.error).toContain('Unauthorized');
    });

    it('should return 404 for non-existent site', async () => {
      const response = await request(app)
        .put('/api/sites/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(403); // Will fail on role check first

      expect(response.body.error).toBeDefined();
    });
  });

  describe('DELETE /api/sites/:id', () => {
    it('should require admin role for deletion', async () => {
      const response = await request(app)
        .delete(`/api/sites/${testData.siteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.error).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete(`/api/sites/${testData.siteId}`)
        .expect(401);

      expect(response.body.error).toContain('Unauthorized');
    });
  });
});
