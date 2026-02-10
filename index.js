// index.js
// Application Entry Point - Migrated to Unified API Gateway
// All routes are now accessed through the gateway command system

require('ts-node/register/transpile-only');

const express = require('express');
const app = express();
const dotenv = require('dotenv');
dotenv.config();

// ============================================================================
// Gateway Middleware Initialization
// ============================================================================

// Initialize gateway middleware (API keys, rate limits, etc.)
const { initializeMiddleware } = require('./middleware/gatewayMiddleware');
initializeMiddleware();

// ============================================================================
// Core Middleware
// ============================================================================

app.use(express.json());

// ============================================================================
// Unified Routes (Gateway)
// ============================================================================

// Mount all routes through unified routes
const unifiedRoutes = require('./routes/unifiedRoutes');
app.use(unifiedRoutes);

// ============================================================================
// Root Endpoint
// ============================================================================

app.get('/', (req, res) => {
  res.json({
    status: 'LocalBrowser API (Playwright) is running',
    version: '2.0.0',
    gateway: '/api/v1',
    health: '/health',
    docs: '/api-docs',
  });
});

// ============================================================================
// Background Services
// ============================================================================

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`Playwright server running on port ${PORT}`);
  console.log(`Unified API Gateway mounted at /api/v1`);

  // Start automatic cleanup only for local storage (cloud storage doesn't need cleanup)
  const storageType = process.env.STORAGE_TYPE || 'local';
  const enableCleanup = process.env.ENABLE_LOCAL_CLEANUP !== 'false';

  if (storageType === 'local' && enableCleanup) {
    const { scheduleCleanup } = require('./utils/fileCleanup');
    const intervalHours = parseInt(process.env.CLEANUP_INTERVAL_HOURS) || 6;
    const maxAgeHours = parseInt(process.env.CLEANUP_MAX_AGE_HOURS) || 24;

    scheduleCleanup(intervalHours, maxAgeHours);
    console.log(
      `[Storage] Local file cleanup scheduled: Every ${intervalHours}h, delete files older than ${maxAgeHours}h`
    );
  } else {
    console.log(
      `[Storage] Using ${storageType} storage - automatic cleanup is ${enableCleanup ? 'disabled (cloud mode)' : 'disabled'}`
    );
  }

  // Start background task processor for database-backed task queue
  if (process.env.ENABLE_TASK_PROCESSOR !== 'false') {
    const TaskProcessor = require('./services/taskProcessor').default;
    const TaskQueueService = require('./services/taskQueueService').default;
    const TaskExecutor = require('./services/taskExecutor').default;
    const ResultSubmitter = require('./services/resultSubmitter').default;
    const browserHelper = require('./helpers/browserHelper').default;

    const taskQueueService = new TaskQueueService({ logger: console });
    const taskExecutor = new TaskExecutor(browserHelper);

    let resultSubmitter = null;
    if (process.env.LARAVEL_INTERNAL_URL && process.env.LOCALBROWSER_SECRET) {
      resultSubmitter = new ResultSubmitter({
        laravelUrl: process.env.LARAVEL_INTERNAL_URL,
        secret: process.env.LOCALBROWSER_SECRET,
      });
    }

    const taskProcessor = new TaskProcessor({
      taskQueueService,
      taskExecutor,
      resultSubmitter,
      logger: console,
      intervalMs: parseInt(process.env.TASK_PROCESSOR_INTERVAL_MS) || 5000,
      maxConcurrent: parseInt(process.env.MAX_CONCURRENT_TASKS) || 3,
    });

    taskProcessor.start();
    console.log('[TaskProcessor] Background task processor started');

    // Start task maintenance worker (stuck task reset, cleanup)
    const TaskMaintenanceWorker = require('./services/taskMaintenanceWorker').default;
    const taskMaintenanceWorker = new TaskMaintenanceWorker({
      taskQueueService,
      logger: console,
      stuckTaskIntervalMs: parseInt(process.env.STUCK_TASK_CHECK_INTERVAL_MS) || 300000, // 5 min
      stuckTaskThresholdMinutes: parseInt(process.env.STUCK_TASK_THRESHOLD_MINUTES) || 30,
      cleanupIntervalMs: parseInt(process.env.TASK_CLEANUP_INTERVAL_MS) || 3600000, // 1 hour
      cleanupOlderThanDays: parseInt(process.env.TASK_CLEANUP_DAYS) || 7,
    });

    taskMaintenanceWorker.start();
    console.log('[TaskMaintenance] Task maintenance worker started');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('[TaskProcessor] Received SIGTERM, stopping...');
      taskProcessor.stop();
      taskMaintenanceWorker.stop();
    });

    process.on('SIGINT', () => {
      console.log('[TaskProcessor] Received SIGINT, stopping...');
      taskProcessor.stop();
      taskMaintenanceWorker.stop();
      process.exit(0);
    });
  } else {
    console.log('[TaskProcessor] Background task processor disabled');
  }

  // Execute startup worker handshake with Laravel
  // This signals that the worker is ready and fetches any pending tasks
  if (process.env.LARAVEL_INTERNAL_URL && process.env.LOCALBROWSER_SECRET) {
    try {
      const TaskExecutor = require('./services/taskExecutor').default;
      const ResultSubmitter = require('./services/resultSubmitter').default;
      const browserHelper = require('./helpers/browserHelper').default;

      const taskExecutor = new TaskExecutor(browserHelper);
      const resultSubmitter = new ResultSubmitter({
        laravelUrl: process.env.LARAVEL_INTERNAL_URL,
        secret: process.env.LOCALBROWSER_SECRET,
      });

      const StartupWorkerHandshake = require('./bootstrap/startupWorkerHandshake');
      const workerHandshake = new StartupWorkerHandshake({
        laravelUrl: process.env.LARAVEL_INTERNAL_URL,
        secret: process.env.LOCALBROWSER_SECRET,
        workerId: process.env.WORKER_ID,
        logger: console,
      });

      await workerHandshake.execute();
      console.log('[Startup] Worker handshake completed successfully');
    } catch (error) {
      console.error('[Startup] Worker handshake failed:', error.message);
    }
  }
});

module.exports = app;
