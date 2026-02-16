import { randomUUID } from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class TicketRepository extends BaseRepository {
  constructor(db) {
    super(db, 'support_tickets');
  }

  /**
   * Find tickets by status
   */
  findByStatus(status) {
    return this.query(
      'SELECT * FROM support_tickets WHERE status = ? ORDER BY createdAt DESC',
      [status]
    );
  }

  /**
   * Find open tickets
   */
  findOpen() {
    return this.findByStatus('open');
  }

  /**
   * Find closed tickets
   */
  findClosed() {
    return this.findByStatus('closed');
  }

  /**
   * Find tickets by email
   */
  findByEmail(email) {
    return this.query(
      'SELECT * FROM support_tickets WHERE email = ? ORDER BY createdAt DESC',
      [email]
    );
  }

  /**
   * Create ticket
   */
  createTicket(ticketData) {
    const id = randomUUID();
    return this.create({
      id,
      name: ticketData.name,
      email: ticketData.email,
      subject: ticketData.subject,
      message: ticketData.message,
      status: 'open',
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Resolve ticket
   */
  resolve(id, resolvedBy, response) {
    return this.update(id, {
      status: 'closed',
      resolvedAt: new Date().toISOString(),
      resolvedBy,
      response
    });
  }

  /**
   * Reopen ticket
   */
  reopen(id) {
    return this.update(id, {
      status: 'open',
      resolvedAt: null,
      resolvedBy: null,
      response: null
    });
  }

  /**
   * Count tickets by status
   */
  countByStatus(status) {
    const result = this.queryOne(
      'SELECT COUNT(*) as count FROM support_tickets WHERE status = ?',
      [status]
    );
    return result.count;
  }

  /**
   * Search tickets
   */
  search(searchTerm) {
    return this.query(
      'SELECT * FROM support_tickets WHERE subject LIKE ? OR message LIKE ? OR email LIKE ? ORDER BY createdAt DESC',
      [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
    );
  }

  /**
   * Find recent tickets
   */
  findRecent(limit = 50) {
    return this.query(
      'SELECT * FROM support_tickets ORDER BY createdAt DESC LIMIT ?',
      [limit]
    );
  }
}
