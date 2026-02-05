// routes/internalRoutes.js
const express = require('express');
const router = express.Router();
const InternalController = require('../controllers/internalController');
const TaskExecutor = require('../services/taskExecutor');
const ResultSubmitter = require('../services/resultSubmitter');
const TaskQueueService = require('../services/taskQueueService');
const browserHelper = require('../helpers/browserHelper');
const hmacSignature = require('../middleware/hmacSignature');

// Initialize dependencies
const taskExecutor = new TaskExecutor(browserHelper);
const resultSubmitter = new ResultSubmitter({
  laravelUrl: process.env.LARAVEL_INTERNAL_URL,
  secret: process.env.LOCALBROWSER_SECRET,
});
const taskQueueService = new TaskQueueService({
  logger: console,
  maxConcurrentTasks: parseInt(process.env.MAX_CONCURRENT_TASKS) || 3,
});

// Instantiate controller with dependencies
const internalController = new InternalController({
  taskExecutor,
  resultSubmitter,
  taskQueueService,
  logger: console,
});

// All routes require HMAC signature verification
router.use(hmacSignature);

// POST /internal/ping
// Laravel notifies Node that work is available
router.post('/ping', internalController.ping);

// POST /internal/request-work
// Node requests available tasks
router.post('/request-work', internalController.requestWork);

// POST /internal/task-result
// Node submits task result
router.post('/task-result', internalController.submitResult);

// GET /internal/queue/stats
// Get queue statistics
router.get('/queue/stats', async (req, res) => {
  try {
    const stats = await taskQueueService.getStatistics();
    res.json({
      status: 'ok',
      stats,
      worker_id: process.env.WORKER_ID || `worker-${process.pid}`,
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /internal/queue/enqueue
// Enqueue a new task
router.post('/queue/enqueue', async (req, res) => {
  try {
    const { tasks } = req.body;
    
    if (!tasks) {
      return res.status(400).json({ error: 'tasks array required' });
    }
    
    const taskArray = Array.isArray(tasks) ? tasks : [tasks];
    const taskIds = await taskQueueService.enqueueBatch(taskArray);
    
    res.json({
      status: 'ok',
      task_ids: taskIds,
      count: taskIds.length,
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /internal/queue/cleanup
// Clean up old tasks
router.post('/queue/cleanup', async (req, res) => {
  try {
    const { older_than_days = 7 } = req.body;
    const deleted = await taskQueueService.cleanupOldTasks(older_than_days);
    
    res.json({
      status: 'ok',
      deleted,
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /internal/queue/reset-stuck
// Reset stuck tasks
router.post('/queue/reset-stuck', async (req, res) => {
  try {
    const { stuck_after_minutes = 30 } = req.body;
    const reset = await taskQueueService.resetStuckTasks(stuck_after_minutes);
    
    res.json({
      status: 'ok',
      reset,
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
