/**
 * Internal Routes - TypeScript migration
 */

import { Router } from 'express';
import InternalController from '../controllers/internalController';
import TaskExecutor from '../services/taskExecutor';
import ResultSubmitter from '../services/resultSubmitter';
import TaskQueueService from '../services/taskQueueService';
import browserHelper from '../helpers/browserHelper';
import hmacSignature from '../middleware/hmacSignature';

const router = Router();

// Initialize dependencies
const taskExecutor = new TaskExecutor(browserHelper);
const resultSubmitter = new ResultSubmitter({
  laravelUrl: process.env.LARAVEL_INTERNAL_URL,
  secret: process.env.LOCALBROWSER_SECRET,
});
const taskQueueService = new TaskQueueService({
  logger: console,
  maxConcurrentTasks: parseInt(process.env.MAX_CONCURRENT_TASKS || '3'),
});

// Instantiate controller with dependencies (cast to avoid type mismatches with JS modules)
const internalController = new InternalController({
  taskExecutor: taskExecutor as unknown as InternalController['taskExecutor'],
  resultSubmitter: resultSubmitter as unknown as InternalController['resultSubmitter'],
  taskQueueService: taskQueueService as unknown as InternalController['taskQueueService'],
  logger: console,
});

// All routes require HMAC signature verification
router.use(hmacSignature);

// POST /internal/ping
router.post('/ping', internalController.ping);

// POST /internal/request-work
router.post('/request-work', internalController.requestWork);

// POST /internal/task-result
router.post('/task-result', internalController.submitResult);

// GET /internal/queue/stats
router.get('/queue/stats', async (req: any, res: any) => {
  try {
    const stats = await taskQueueService.getStatistics();
    res.json({
      status: 'ok',
      stats,
      worker_id: process.env.WORKER_ID || `worker-${process.pid}`,
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /internal/queue/enqueue
router.post('/queue/enqueue', async (req: any, res: any) => {
  try {
    const { tasks } = req.body;
    
    if (!tasks) {
      res.status(400).json({ error: 'tasks array required' });
      return;
    }
    
    const taskArray = Array.isArray(tasks) ? tasks : [tasks];
    const taskIds = await taskQueueService.enqueueBatch(taskArray);
    
    res.json({
      status: 'ok',
      task_ids: taskIds,
      count: taskIds.length,
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /internal/queue/cleanup
router.post('/queue/cleanup', async (req: any, res: any) => {
  try {
    const { older_than_days = 7 } = req.body;
    const deleted = await taskQueueService.cleanupOldTasks(older_than_days);
    
    res.json({
      status: 'ok',
      deleted,
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /internal/queue/reset-stuck
router.post('/queue/reset-stuck', async (req: any, res: any) => {
  try {
    const { stuck_after_minutes = 30 } = req.body;
    const reset = await taskQueueService.resetStuckTasks(stuck_after_minutes);
    
    res.json({
      status: 'ok',
      reset,
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export = router;
