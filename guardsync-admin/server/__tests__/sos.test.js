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

describe('POST /api/sos-alerts', () => {
  let testData;
  let guardToken;

  beforeEach(async () => {
    testDb = createTestDb();
    testData = await seedTestData(testDb);
    guardToken = signToken({ id: testData.guardId, role: 'guard' });
  });

  afterEach(() => {
    cleanupTestDb(testDb);
    testDb = null;
  });

  const raise = (body) => request(app)
    .post('/api/sos-alerts')
    .set('Authorization', `Bearer ${guardToken}`)
    .send(body);
  const alerts = () => testDb.prepare('SELECT * FROM sos_alerts').all();

  it('accepts siteId null, as the guard app sends it, and uses the guard\'s site', async () => {
    const response = await raise({
      guardId: testData.guardId, guardName: 'Test Guard', siteId: null, siteName: 'Test Site', message: 'Intruder at gate B',
    }).expect(201);

    expect(response.body.data).toMatchObject({ siteId: testData.siteId, siteName: 'Test Site', status: 'active' });
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0]).toMatchObject({ guardId: testData.guardId, siteId: testData.siteId, message: 'Intruder at gate B' });
    expect(testDb.prepare('SELECT status FROM guards WHERE id = ?').get(testData.guardId).status).toBe('alert');
  });

  it('accepts an SOS with no site at all and fills in the site name', async () => {
    const response = await raise({ guardId: testData.guardId, guardName: 'Test Guard', siteName: null }).expect(201);
    expect(response.body.data).toMatchObject({ siteId: testData.siteId, siteName: 'Test Site' });
  });

  it('accepts a guard with no site', async () => {
    testDb.prepare('UPDATE guards SET siteId = NULL WHERE id = ?').run(testData.guardId);
    const response = await raise({ guardId: testData.guardId, guardName: 'Test Guard', siteId: null }).expect(201);
    expect(response.body.data.siteId).toBeNull();
  });

  it('reports a real problem by its own field', async () => {
    const response = await raise({ guardId: testData.guardId, siteId: null }).expect(400);
    expect(response.body.error.message).toBe('guardName: Required');
  });
});
