import express from 'express';
import { authMiddleware } from '../auth.js';
import { isGuard, guardSiteId, ownSiteParam } from '../middleware/access.js';
import { validate } from '../validation/index.js';
import { createSiteSchema, updateSiteSchema } from '../validation/site.schemas.js';
import { siteRepo } from '../repositories/index.js';
import { randomUUID } from 'crypto';
import { success, created, error, badRequest, notFound, unauthorized, forbidden, conflict, serverError, noContent } from '../utils/responses.js';

const router = express.Router();

// GET /api/sites - Get all sites
router.get('/', authMiddleware(true, ['guard', 'staff', 'admin']), (req, res) => {
  const sites = siteRepo.findAllWithRelations();
  if (isGuard(req)) {
    const own = guardSiteId(req);
    return success(res, sites.filter((site) => site.id === own));
  }
  return success(res, sites);
});

// GET /api/sites/:id - Get single site
router.get('/:id', authMiddleware(true, ['guard', 'staff', 'admin']), ownSiteParam('id'), (req, res) => {
  const site = siteRepo.findByIdWithRelations(req.params.id);
  if (!site) return notFound(res, 'site', req.params.id);
  return success(res, site);
});

// POST /api/sites - Create a new site
router.post('/', authMiddleware(true, ['staff', 'admin']), validate(createSiteSchema), (req, res) => {
  const s = req.body;
  
  try {
    siteRepo.createWithRelations(s);
    return created(res, { ok: true }, 'Site created successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT /api/sites/:id - Update site
router.put('/:id', authMiddleware(true, ['staff', 'admin']), validate(updateSiteSchema), (req, res) => {
  const s = req.body;
  
  try {
    siteRepo.updateWithRelations(req.params.id, s);
    return success(res, { ok: true }, 200, 'Site updated successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// DELETE /api/sites/:id - Delete site
router.delete('/:id', authMiddleware(true, ['admin']), (req, res) => {
  try {
    siteRepo.delete(req.params.id);
    return success(res, { ok: true }, 200, 'Site deleted successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
