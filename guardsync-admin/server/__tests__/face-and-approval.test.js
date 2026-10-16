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
  siteRowToObj: (row) => ({ ...row, isActive: !!row.isActive }),
}));

// A face template as the guard app sends it: 128 numbers as a JSON string
const face = (seed) => JSON.stringify(Array.from({ length: 128 }, (_, i) => Math.sin(i * seed) / 10));

describe('Face templates and enrolment approval', () => {
  let testData;
  let guardToken;
  let staffToken;
  let adminToken;

  beforeEach(async () => {
    testDb = createTestDb();
    testData = await seedTestData(testDb);
    testDb.prepare(`INSERT INTO staff (id, name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('test-staff-2', 'Test Officer', 'officer@test.com', 'x', 'staff', new Date().toISOString());
    guardToken = signToken({ id: testData.guardId, role: 'guard' });
    staffToken = signToken({ id: 'test-staff-2', role: 'staff' });
    adminToken = signToken({ id: testData.staffId, role: 'admin' });
  });

  afterEach(() => {
    cleanupTestDb(testDb);
    testDb = null;
  });

  const enrolledFace = () => testDb.prepare('SELECT faceDescriptor FROM guards WHERE id = ?').get(testData.guardId).faceDescriptor;

  describe('the face template never leaves the server', () => {
    it('is not in the login response, only whether a face is enrolled', async () => {
      testDb.prepare('UPDATE guards SET faceDescriptor = ? WHERE id = ?').run(face(1), testData.guardId);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: testData.guardEmail, password: testData.guardPassword })
        .expect(200);

      expect(response.body.data.guard).not.toHaveProperty('faceDescriptor');
      expect(response.body.data.guard).toHaveProperty('faceEnrolled', true);
    });

    it('is not in the guard\'s own profile', async () => {
      testDb.prepare('UPDATE guards SET faceDescriptor = ? WHERE id = ?').run(face(1), testData.guardId);

      const response = await request(app)
        .get(`/api/guards/${testData.guardId}`)
        .set('Authorization', `Bearer ${guardToken}`)
        .expect(200);

      expect(response.body.data).not.toHaveProperty('faceDescriptor');
      expect(response.body.data).toHaveProperty('faceEnrolled', true);
    });

    it('cannot be listed, not even by an admin', async () => {
      await request(app)
        .get('/api/auth/face-descriptors')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('POST /api/guards/:id/face/verify', () => {
    beforeEach(() => {
      testDb.prepare('UPDATE guards SET faceDescriptor = ? WHERE id = ?').run(face(1), testData.guardId);
    });

    it('says whether a scan matches the enrolled face', async () => {
      const same = await request(app)
        .post(`/api/guards/${testData.guardId}/face/verify`)
        .set('Authorization', `Bearer ${guardToken}`)
        .send({ faceDescriptor: face(1) })
        .expect(200);
      expect(same.body.data).toEqual({ match: true });

      const other = await request(app)
        .post(`/api/guards/${testData.guardId}/face/verify`)
        .set('Authorization', `Bearer ${guardToken}`)
        .send({ faceDescriptor: face(7) })
        .expect(200);
      expect(other.body.data).toEqual({ match: false });
    });

    it('is only for the guard themselves', async () => {
      await request(app)
        .post(`/api/guards/${testData.guardId}/face/verify`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ faceDescriptor: face(1) })
        .expect(403);
    });
  });

  describe('PUT /api/guards/:id/face', () => {
    it('lets a guard enrol their own face once', async () => {
      await request(app)
        .put(`/api/guards/${testData.guardId}/face`)
        .set('Authorization', `Bearer ${guardToken}`)
        .send({ faceDescriptor: face(1) })
        .expect(200);
      expect(enrolledFace()).toBe(face(1));

      await request(app)
        .put(`/api/guards/${testData.guardId}/face`)
        .set('Authorization', `Bearer ${guardToken}`)
        .send({ faceDescriptor: face(2) })
        .expect(409);
      expect(enrolledFace()).toBe(face(1));
    });

    it('does not let staff or admin set a face for a guard', async () => {
      for (const token of [staffToken, adminToken]) {
        await request(app)
          .put(`/api/guards/${testData.guardId}/face`)
          .set('Authorization', `Bearer ${token}`)
          .send({ faceDescriptor: face(3) })
          .expect(403);
      }
      expect(enrolledFace()).toBeNull();
    });

    it('refuses something that is not a face template', async () => {
      await request(app)
        .put(`/api/guards/${testData.guardId}/face`)
        .set('Authorization', `Bearer ${guardToken}`)
        .send({ faceDescriptor: 'not a face template' })
        .expect(400);
    });
  });

  describe('DELETE /api/guards/:id/face', () => {
    beforeEach(() => {
      testDb.prepare('UPDATE guards SET faceDescriptor = ? WHERE id = ?').run(face(1), testData.guardId);
    });

    it('lets an admin clear a face so the guard can enrol again', async () => {
      await request(app)
        .delete(`/api/guards/${testData.guardId}/face`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(enrolledFace()).toBeNull();
    });

    it('is admin only', async () => {
      await request(app)
        .delete(`/api/guards/${testData.guardId}/face`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
      expect(enrolledFace()).toBe(face(1));
    });
  });

  describe('PUT /api/guards/:id cannot approve an enrolment', () => {
    beforeEach(() => {
      testDb.prepare("UPDATE guards SET status = 'pending' WHERE id = ?").run(testData.guardId);
    });

    const status = () => testDb.prepare('SELECT status FROM guards WHERE id = ?').get(testData.guardId).status;

    it('refuses to move a guard out of pending', async () => {
      for (const token of [staffToken, adminToken]) {
        await request(app)
          .put(`/api/guards/${testData.guardId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'offline' })
          .expect(403);
      }
      expect(status()).toBe('pending');
    });

    it('still saves other edits when the status is sent unchanged', async () => {
      // The dashboard sends the whole guard back when it saves an edit
      await request(app)
        .put(`/api/guards/${testData.guardId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Renamed Guard', status: 'pending' })
        .expect(200);
      expect(status()).toBe('pending');
    });

    it('refuses to move an active guard back to pending', async () => {
      testDb.prepare("UPDATE guards SET status = 'offline' WHERE id = ?").run(testData.guardId);
      await request(app)
        .put(`/api/guards/${testData.guardId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'pending' })
        .expect(403);
      expect(status()).toBe('offline');
    });
  });
});
