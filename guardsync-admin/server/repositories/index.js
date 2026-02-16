/**
 * Repository Factory - Central export for all repositories
 * 
 * This file creates singleton instances of all repositories and exports them.
 * Route handlers should import repositories from this file.
 * 
 * Example usage in route handlers:
 * ```js
 * import { guardRepo, siteRepo, attendanceRepo } from '../repositories/index.js';
 * 
 * // Instead of: db.prepare('SELECT * FROM guards').all()
 * // Use: guardRepo.findAll()
 * ```
 */

import db from '../db.js';
import { GuardRepository } from './GuardRepository.js';
import { SiteRepository } from './SiteRepository.js';
import { AttendanceRepository } from './AttendanceRepository.js';
import { LeaveRepository } from './LeaveRepository.js';
import { ConveyanceRepository } from './ConveyanceRepository.js';
import { StaffRepository } from './StaffRepository.js';
import { PayrollRepository } from './PayrollRepository.js';
import { PatrolRepository } from './PatrolRepository.js';
import { NotificationRepository } from './NotificationRepository.js';
import { ScheduleRepository } from './ScheduleRepository.js';
import { TicketRepository } from './TicketRepository.js';
import { SOSRepository } from './SOSRepository.js';
import { ReportRepository } from './ReportRepository.js';
import { ConfigRepository } from './ConfigRepository.js';

// Create singleton instances
export const guardRepo = new GuardRepository(db);
export const siteRepo = new SiteRepository(db);
export const attendanceRepo = new AttendanceRepository(db);
export const leaveRepo = new LeaveRepository(db);
export const conveyanceRepo = new ConveyanceRepository(db);
export const staffRepo = new StaffRepository(db);
export const payrollRepo = new PayrollRepository(db);
export const patrolRepo = new PatrolRepository(db);
export const notificationRepo = new NotificationRepository(db);
export const scheduleRepo = new ScheduleRepository(db);
export const ticketRepo = new TicketRepository(db);
export const sosRepo = new SOSRepository(db);
export const reportRepo = new ReportRepository(db);
export const configRepo = new ConfigRepository(db);

// Export classes for testing or custom instantiation
export {
  GuardRepository,
  SiteRepository,
  AttendanceRepository,
  LeaveRepository,
  ConveyanceRepository,
  StaffRepository,
  PayrollRepository,
  PatrolRepository,
  NotificationRepository,
  ScheduleRepository,
  TicketRepository,
  SOSRepository,
  ReportRepository,
  ConfigRepository
};
