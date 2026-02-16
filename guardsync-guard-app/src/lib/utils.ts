// Re-export shared utilities from @guardsync/utils
export {
  cn,
  calculateDistance,
  isPointInPolygon,
  formatDate,
  formatTime,
  formatDateTime,
  getRelativeTime,
  formatCurrency,
  formatNumber,
  formatDistance,
  truncate,
  capitalize,
  generateId,
  generateUUID,
  generateShortId,
} from '@guardsync/utils';

// Import centralized config
import { config } from './config';

// Export for backward compatibility
export const API_BASE_URL = config.apiUrl;

// Re-export the config for direct access
export { config };
