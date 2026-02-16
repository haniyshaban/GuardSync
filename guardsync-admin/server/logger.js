import pino from 'pino';

/**
 * Structured logger using Pino
 * 
 * Features:
 * - JSON output in production for log aggregation systems
 * - Pretty-printed colorized output in development
 * - Configurable log levels via LOG_LEVEL env var
 * - High performance, low overhead
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' 
    ? { 
        target: 'pino-pretty', 
        options: { 
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        } 
      }
    : undefined,
  // In production, output JSON for log aggregation (e.g., ELK, Datadog)
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
});

export default logger;
