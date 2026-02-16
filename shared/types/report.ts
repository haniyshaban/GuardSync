/**
 * Field report type definitions
 */

import type { Location, ReportType, MediaType } from './common';

export interface FieldReport {
  id: string;
  staffId: string;
  staffName: string;
  reportType: ReportType;
  title: string;
  description?: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  siteId?: string;
  siteName?: string;
  location?: Location;
  createdAt: string;
  tags?: string[];
}
