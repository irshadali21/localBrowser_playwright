// index.js
// Entry point - separates HTTP layer from worker lifecycle

const { createApp } = require('./bootstrap/app');
const { startWorker } = require('./bootstrap/worker');
const { logger } = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// Create and start Express app
const app = createApp();
const server = app.listen(PORT, async () => {
  logger.info({ port: PORT }, 'Server started');
  
  try {
    await startWorker();
    logger.info({ port: PORT }, 'Server ready');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to start worker');
  }
});

// Server error handling
server.on('error', (error) => {
  logger.error({ error: error.message, code: error.code }, 'Server error');
  if (error.code === 'EADDRINUSE') {
    logger.error({ port: PORT }, 'Port already in use');
    process.exit(1);
  }
});

// Prevent process crashes
process.on('uncaughtException', (error) => logger.error({ error: error.message, stack: error.stack }, 'Uncaught exception'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled rejection'));
