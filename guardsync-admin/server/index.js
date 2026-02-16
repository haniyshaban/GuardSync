import app from './app.js';
import { seedDatabase } from './seed.js';
import logger from './logger.js';

// Seed database and start server
(async () => {
  await seedDatabase();
  
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    logger.info({ port }, 'GuardSync API Server Started');
    logger.info(`Running at http://localhost:${port}/api`);
    logger.info('Database initialized and seeded');
    logger.info('Security middleware active (Helmet, CORS, Rate Limiting)');
  });
})();
