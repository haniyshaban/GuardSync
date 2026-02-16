import { randomUUID } from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class ReportRepository extends BaseRepository {
  constructor(db) {
    super(db, 'field_reports');
  }

  /**
   * Find reports by staff ID
   */
  findByStaffId(staffId) {
    return this.query(
      'SELECT * FROM field_reports WHERE staffId = ? ORDER BY createdAt DESC',
      [staffId]
    );
  }

  /**
   * Find reports by site ID
   */
  findBySiteId(siteId) {
    return this.query(
      'SELECT * FROM field_reports WHERE siteId = ? ORDER BY createdAt DESC',
      [siteId]
    );
  }

  /**
   * Find reports by type
   */
  findByType(reportType) {
    return this.query(
      'SELECT * FROM field_reports WHERE reportType = ? ORDER BY createdAt DESC',
      [reportType]
    );
  }

  /**
   * Create field report
   */
  createReport(reportData) {
    const id = randomUUID();
    return this.create({
      id,
      staffId: reportData.staffId,
      staffName: reportData.staffName || null,
      reportType: reportData.reportType,
      title: reportData.title,
      description: reportData.description || null,
      mediaUrl: reportData.mediaUrl || null,
      mediaType: reportData.mediaType || null,
      siteId: reportData.siteId || null,
      siteName: reportData.siteName || null,
      lat: reportData.lat || null,
      lng: reportData.lng || null,
      createdAt: new Date().toISOString(),
      tags: reportData.tags || null
    });
  }

  /**
   * Find reports by date range
   */
  findByDateRange(startDate, endDate) {
    return this.query(
      'SELECT * FROM field_reports WHERE createdAt >= ? AND createdAt <= ? ORDER BY createdAt DESC',
      [startDate, endDate]
    );
  }

  /**
   * Find reports with media
   */
  findWithMedia() {
    return this.query(
      'SELECT * FROM field_reports WHERE mediaUrl IS NOT NULL ORDER BY createdAt DESC',
      []
    );
  }

  /**
   * Search reports by tags
   */
  findByTags(tags) {
    return this.query(
      'SELECT * FROM field_reports WHERE tags LIKE ? ORDER BY createdAt DESC',
      [`%${tags}%`]
    );
  }

  /**
   * Find recent reports
   */
  findRecent(limit = 50) {
    return this.query(
      'SELECT * FROM field_reports ORDER BY createdAt DESC LIMIT ?',
      [limit]
    );
  }

  /**
   * Count reports by staff ID
   */
  countByStaffId(staffId) {
    const result = this.queryOne(
      'SELECT COUNT(*) as count FROM field_reports WHERE staffId = ?',
      [staffId]
    );
    return result.count;
  }

  /**
   * Count reports by type
   */
  countByType(reportType) {
    const result = this.queryOne(
      'SELECT COUNT(*) as count FROM field_reports WHERE reportType = ?',
      [reportType]
    );
    return result.count;
  }
}
