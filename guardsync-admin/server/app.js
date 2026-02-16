import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import caseConverterMiddleware from './middleware/caseConverter.js';
import requestLogger from './middleware/requestLogger.js';

// Import all route modules
import uploadsRoutes from './routes/uploads.routes.js';
import authRoutes from './routes/auth.routes.js';
import guardsRoutes from './routes/guards.routes.js';
import sitesRoutes from './routes/sites.routes.js';
import configRoutes from './routes/config.routes.js';
import ticketsRoutes from './routes/tickets.routes.js';
import sosRoutes from './routes/sos.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import scheduleRoutes from './routes/schedule.routes.js';
import patrolRoutes from './routes/patrol.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import leaveRoutes from './routes/leave.routes.js';
import conveyanceRoutes from './routes/conveyance.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import staffRoutes from './routes/staff.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import statsRoutes from './routes/stats.routes.js';

const app = express();

// Request logging - must be early in middleware chain
app.use(requestLogger);

// Security and middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Case converter middleware - automatically converts between camelCase and snake_case
app.use(caseConverterMiddleware);

// Mount routes
app.use('/uploads', uploadsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/guards', guardsRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/config', configRoutes);
app.use('/api/support-tickets', ticketsRoutes);
app.use('/api/sos-alerts', sosRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/patrol-logs', patrolRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/leave-requests', leaveRoutes);
app.use('/api/conveyance', conveyanceRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/stats', statsRoutes);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
