// index.js
// Load TypeScript files using ts-node/register for development
require('ts-node/register/transpile-only');

const express = require('express');
const app = express();
const dotenv = require('dotenv');
dotenv.config();
const errorHandler = require('./middleware/errorHandler').default;
const hmacSignature = require('./middleware/hmacSignature').default;
const internalRoutes = require('./routes/internalRoutes');
const StartupWorkerHandshake = require('./bootstrap/startupWorkerHandshake');

app.use(express.json());

// API Key Auth Middleware (skip for internal routes)
app.use((req, res, next) => {
  if (req.path.startsWith('/internal')) return next();
  if (req.path.startsWith('/iaapa')) return next();
  if (req.headers['x-api-key'] !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Invalid API Key' });
  }
  next();
});

// Internal API Routes (HMAC-secured)
app.use('/internal', internalRoutes);

// Public Routes
app.use('/chat', require('./routes/chatRoutes'));
app.use('/browser', require('./routes/browserRoutes'));
app.use('/error', require('./routes/errorRoutes'));
app.use('/pages', require('./routes/pageRoutes'));
app.use('/jobs', require('./routes/jobRoutes'));
app.use('/cron', require('./routes/cronRoutes'));
app.use('/cleanup', require('./routes/cleanupRoutes'));

app.use('/iaapa', require('./routes/iaapaRoutes'));

app.get('/', (req, res) => {
  res.json({ status: 'LocalBrowser API (Playwright) is running' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`Playwright server running on port ${PORT}`);

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

      const handshake = new StartupWorkerHandshake({
        laravelUrl: process.env.LARAVEL_INTERNAL_URL,
        secret: process.env.LOCALBROWSER_SECRET,
        workerId: process.env.WORKER_ID,
        logger: console,
      });

      const initialTasks = await handshake.execute();
      console.log(`[Startup] Worker handshake complete. ${initialTasks.length} task(s) assigned.`);

      // Process initial tasks asynchronously without blocking startup
      if (initialTasks.length > 0) {
        setImmediate(async () => {
          console.log('[Startup] Processing initial tasks...');
          for (const task of initialTasks) {
            try {
              const result = await taskExecutor.execute(task);
              await resultSubmitter.submit(result);
              console.log(`[Startup] Task ${task.id} completed successfully`);
            } catch (error) {
              console.error(`[Startup] Failed to process task ${task.id}:`, error.message);
            }
          }
          console.log('[Startup] All initial tasks processed');
        });
      }
    } catch (error) {
      console.error('[Startup] Worker handshake failed:', error.message);
      // Continue anyway — allow worker to start
    }
  } else {
    console.warn(
      '[Startup] LARAVEL_INTERNAL_URL or LOCALBROWSER_SECRET not configured. Skipping handshake.'
    );
  }

  console.log(`[Startup] Server is ready to receive requests on port ${PORT}`);
});

// Handle server errors
server.on('error', error => {
  console.error('[Server] Error:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Prevent process from exiting - keep the event loop active
process.on('uncaughtException', error => {
  console.error('[Process] Uncaught Exception:', error.message);
  console.error(error.stack);
  // Don't exit - allow the server to continue running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - allow the server to continue running
});
