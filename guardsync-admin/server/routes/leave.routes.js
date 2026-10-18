import express from 'express';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../auth.js';
import { actAsSelf, scopeQueryToSelf, ownsRow } from '../middleware/access.js';
import { validate } from '../validation/index.js';
import { createLeaveRequestSchema, updateLeaveRequestSchema } from '../validation/leave.schemas.js';
import { leaveRepo } from '../repositories/index.js';
import { success, created, error, badRequest, notFound, unauthorized, forbidden, conflict, serverError, noContent } from '../utils/responses.js';

const router = express.Router();

// Helper to transform leave request row (currently no transformations needed)
const leaveRowToObj = (row) => row;

// GET leave requests for a guard
router.get('/', authMiddleware(true, ['guard', 'staff', 'admin']), scopeQueryToSelf, (req, res) => {
  try {
    const guardId = req.query.guardId || req.query.guard_id;
    let rows;
    if (guardId) {
      rows = leaveRepo.findByGuardId(guardId);
    } else {
      rows = leaveRepo.findAll('appliedAt DESC');
    }
    return success(res, rows.map(leaveRowToObj));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// GET single leave request
router.get('/:id', authMiddleware(true, ['guard', 'staff', 'admin']), ownsRow('leave_requests'), (req, res) => {
  try {
    const row = leaveRepo.findById(req.params.id);
    if (!row) return notFound(res, 'leave request', req.params.id);
    return success(res, leaveRowToObj(row));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// POST create leave request
router.post('/', authMiddleware(true, ['guard', 'admin']), actAsSelf, validate(createLeaveRequestSchema), (req, res) => {
  const l = req.body;
  const id = randomUUID();
  try {
    leaveRepo.create({
      id,
      guardId: l.guardId,
      startDate: l.startDate,
      endDate: l.endDate,
      reason: l.reason,
      leaveType: l.leaveType || 'casual',
      status: 'pending',
      appliedAt: new Date().toISOString()
    });
    const row = leaveRepo.findById(id);
    return created(res, leaveRowToObj(row), 'Leave request created successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT update leave request (for admin approval/rejection)
router.put('/:id', authMiddleware(true, ['staff', 'admin']), validate(updateLeaveRequestSchema), (req, res) => {
  const l = req.body;
  try {
    leaveRepo.update(req.params.id, {
      status: l.status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: l.reviewedBy || null,
      adminNotes: l.adminNotes || null,
    });
    const row = leaveRepo.findById(req.params.id);
    if (!row) return notFound(res, 'leave request', req.params.id);
    return success(res, leaveRowToObj(row), 200, 'Leave request updated successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// DELETE leave request. A guard may cancel their own request while it is still pending.
router.delete('/:id', authMiddleware(true, ['guard', 'staff', 'admin']), ownsRow('leave_requests'), (req, res) => {
  try {
    const row = leaveRepo.findById(req.params.id);
    if (!row) return notFound(res, 'leave request', req.params.id);
    if (req.user.role === 'guard' && row.status !== 'pending') {
      return forbidden(res, 'Only a pending leave request can be cancelled');
    }
    leaveRepo.delete(req.params.id);
    return success(res, { ok: true }, 200, 'Leave request deleted successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
