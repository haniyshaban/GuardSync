import { BaseRepository } from './BaseRepository.js';

export class StaffRepository extends BaseRepository {
  constructor(db) {
    super(db, 'staff');
  }

  /**
   * Find staff by email
   */
  findByEmail(email) {
    return this.findOneBy('email', email);
  }

  /**
   * Find staff by employee ID
   */
  findByEmployeeId(employeeId) {
    return this.findOneBy('employeeId', employeeId);
  }

  /**
   * Find staff by role
   */
  findByRole(role) {
    return this.findBy('role', role);
  }

  /**
   * Find staff by status
   */
  findByStatus(status) {
    return this.findBy('status', status);
  }

  /**
   * Find active staff
   */
  findActive() {
    return this.query('SELECT * FROM staff WHERE status = ?', ['online']);
  }

  /**
   * Update staff status
   */
  updateStatus(id, status) {
    return this.update(id, { status });
  }

  /**
   * Find field officers
   */
  findFieldOfficers() {
    return this.findByRole('field_officer');
  }

  /**
   * Find staff by assigned area
   */
  findByAssignedArea(assignedArea) {
    return this.query('SELECT * FROM staff WHERE assignedArea = ?', [assignedArea]);
  }
}
