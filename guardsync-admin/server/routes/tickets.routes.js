import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import { validate, validateQuery } from '../validation/index.js';
import { createTicketSchema, resolveTicketSchema, ticketQuerySchema } from '../validation/ticket.schemas.js';
import { success, created, serverError } from '../utils/responses.js';

const router = express.Router();

// GET /api/support-tickets - Get all support tickets
router.get('/', authMiddleware(true, ['staff', 'admin']), validateQuery(ticketQuerySchema), (req, res) => {
  try {
    const { status } = req.query;
    let rows;
    if (status) {
      rows = db.prepare('SELECT * FROM support_tickets WHERE status = ? ORDER BY createdAt DESC').all(status);
    } else {
      rows = db.prepare('SELECT * FROM support_tickets ORDER BY createdAt DESC').all();
    }
    return success(res, rows);
  } catch (err) {
    return serverError(res, String(err));
  }
});

// POST /api/support-tickets - Create a support ticket
router.post('/', authMiddleware(true, ['guard', 'staff', 'admin']), validate(createTicketSchema), (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO support_tickets (id, name, email, subject, message, status, createdAt)
      VALUES (?, ?, ?, ?, ?, 'open', ?)
    `).run(id, name, email, subject, message, createdAt);

    return created(res, { id, name, email, subject, message, status: 'open', createdAt });
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT /api/support-tickets/:id/resolve - Resolve a support ticket
router.put('/:id/resolve', authMiddleware(true, ['staff', 'admin']), validate(resolveTicketSchema), (req, res) => {
  try {
    const { resolvedBy, response } = req.body;
    const resolvedAt = new Date().toISOString();

    db.prepare(`
      UPDATE support_tickets 
      SET status = 'resolved', resolvedAt = ?, resolvedBy = ?, response = ?
      WHERE id = ?
    `).run(resolvedAt, resolvedBy || null, response || null, req.params.id);

    return success(res, { resolved: true, resolvedAt });
  } catch (err) {
    return serverError(res, String(err));
  }
});

// DELETE /api/support-tickets/:id - Delete a support ticket
router.delete('/:id', authMiddleware(true, ['staff', 'admin']), (req, res) => {
  try {
    db.prepare('DELETE FROM support_tickets WHERE id = ?').run(req.params.id);
    return success(res, { deleted: true });
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
