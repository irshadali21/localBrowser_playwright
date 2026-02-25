// bootstrap/worker.js
// Worker lifecycle - handles background tasks and cleanup

const TaskExecutor = require('../services/taskExecutor');
const ResultSubmitter = require('../services/resultSubmitter');
const TaskProcessor = require('../services/taskProcessor');
const TaskQueueService = require('../services/taskQueueService');
const TaskMaintenanceWorker = require('../services/taskMaintenanceWorker');
const StartupWorkerHandshake = require('./startupWorkerHandshake');
const browserHelper = require('../helpers/browserHelper');
const { scheduleCleanup } = require('../utils/fileCleanup');
const { createLogger } = require('../utils/logger');

const log = createLogger('worker');

async function startWorker() {
  const workerId = process.env.WORKER_ID || `worker-${process.pid}`;
  
  log.info({ workerId }, 'Starting worker');

  // Initialize shared services
  const taskExecutor = new TaskExecutor(browserHelper);
  const resultSubmitter = process.env.LARAVEL_INTERNAL_URL && process.env.LOCALBROWSER_SECRET
    ? new ResultSubmitter({ laravelUrl: process.env.LARAVEL_INTERNAL_URL, secret: process.env.LOCALBROWSER_SECRET })
    : null;

  // Storage cleanup
  const storageType = process.env.STORAGE_TYPE || 'local';
  const enableCleanup = process.env.ENABLE_LOCAL_CLEANUP !== 'false';
  
  if (storageType === 'local' && enableCleanup) {
    const intervalHours = parseInt(process.env.CLEANUP_INTERVAL_HOURS) || 6;
    const maxAgeHours = parseInt(process.env.CLEANUP_MAX_AGE_HOURS) || 24;
    scheduleCleanup(intervalHours, maxAgeHours);
    log.info({ storageType, intervalHours, maxAgeHours }, 'Storage cleanup configured');
  } else {
    log.info({ storageType, enableCleanup }, 'Storage configured');
  }

  // Task processor
  let taskProcessor = null;
  let taskMaintenanceWorker = null;

  if (process.env.ENABLE_TASK_PROCESSOR !== 'false') {
    const taskQueueService = new TaskQueueService({ logger: log });

    taskProcessor = new TaskProcessor({
      taskQueueService,
      taskExecutor,
      resultSubmitter,
      logger: log,
      intervalMs: parseInt(process.env.TASK_PROCESSOR_INTERVAL_MS) || 5000,
      maxConcurrent: parseInt(process.env.MAX_CONCURRENT_TASKS) || 3,
    });

    taskMaintenanceWorker = new TaskMaintenanceWorker({
      taskQueueService,
      logger: log,
      stuckTaskIntervalMs: parseInt(process.env.STUCK_TASK_CHECK_INTERVAL_MS) || 300000,
      stuckTaskThresholdMinutes: parseInt(process.env.STUCK_TASK_THRESHOLD_MINUTES) || 30,
      cleanupIntervalMs: parseInt(process.env.TASK_CLEANUP_INTERVAL_MS) || 3600000,
      cleanupOlderThanDays: parseInt(process.env.TASK_CLEANUP_DAYS) || 7,
    });

    taskProcessor.start();
    taskMaintenanceWorker.start();
    log.info('Background workers started');
  }

  // Startup handshake
  if (process.env.LARAVEL_INTERNAL_URL && process.env.LOCALBROWSER_SECRET) {
    const handshake = new StartupWorkerHandshake({
      laravelUrl: process.env.LARAVEL_INTERNAL_URL,
      secret: process.env.LOCALBROWSER_SECRET,
      workerId,
      logger: log,
    });

    try {
      const initialTasks = await handshake.execute();
      log.info({ taskCount: initialTasks.length }, 'Handshake complete');

      if (initialTasks.length > 0) {
        setImmediate(() => {
          (async () => {
            log.info('Processing initial tasks');
            for (const task of initialTasks) {
              try {
                const result = await taskExecutor.execute(task);
                await resultSubmitter?.submit(result);
                log.info({ taskId: task.id }, 'Task completed');
              } catch (error) {
                log.error({ taskId: task.id, error: error.message }, 'Task failed');
              }
            }
          })().catch((error) => {
            log.error({ error }, 'Unexpected error processing initial tasks');
          });
        });
      }
    } catch (error) {
      log.error({ error: error.message }, 'Handshake failed');
    }
  }

  // Graceful shutdown
  const shutdown = () => {
    log.info('Shutting down workers');
    taskProcessor?.stop();
    taskMaintenanceWorker?.stop();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', () => { shutdown(); process.exit(0); });

  return { taskProcessor, taskMaintenanceWorker };
}

module.exports = { startWorker };
