// controllers/internalController.js
const crypto = require('crypto');
const os = require('os');
const http = require('http');
const https = require('https');
const StartupWorkerHandshake = require('../bootstrap/startupWorkerHandshake');
const db = require('../utils/db');

/**
 * Internal API Controller
 * 
 * Handles communication with Laravel via private HMAC-secured endpoints.
 * Methods: ping, requestWork, submitResult
 */
class InternalController {
  constructor(dependencies = {}) {
    this.taskExecutor = dependencies.taskExecutor;
    this.resultSubmitter = dependencies.resultSubmitter;
    this.taskQueueService = dependencies.taskQueueService;
    this.logger = dependencies.logger || { info: () => {}, warn: () => {}, error: () => {} };
    this.workerId = process.env.WORKER_ID || `worker-${process.pid}`;
    this.isFetchingTasks = false;
    this.isProcessingTasks = false;
  }

  /**
   * POST /internal/ping
   * Laravel notifies Node that work is available
   * Node responds and immediately fetches pending tasks
   */
  ping = async (req, res) => {
    this.logger.info({ workerId: this.workerId, timestamp: req.headers['x-timestamp'] }, 'Ping received');

    try {
      res.json({
        status: 'ok',
        worker_id: this.workerId,
        timestamp: Math.floor(Date.now() / 1000),
        uptime: process.uptime(),
      });

      this.logger.info('Ping response sent');

      // Asynchronously fetch tasks from Laravel (with concurrency control)
      setImmediate(async () => {
        console.log('[InternalController] Starting async task fetch after ping');
        try {
          await this._fetchTasksFromLaravel();
          console.log('[InternalController] Async task fetch completed');
        } catch (error) {
          this.logger.error({ error: error.message, stack: error.stack }, 'Async task fetch failed');
        }
      });
    } catch (error) {
      this.logger.error({ error: error.message, stack: error.stack }, 'Error in ping handler');
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * Fetch tasks from Laravel's /internal/request-work endpoint
   * @private
   */
  async _fetchTasksFromLaravel() {
    this.logger.info('_fetchTasksFromLaravel START');
    
    if (this.isFetchingTasks) {
      this.logger.info('Already fetching tasks, skipping duplicate request');
      return;
    }
    
    this.isFetchingTasks = true;

    if (!process.env.LARAVEL_INTERNAL_URL || !process.env.LOCALBROWSER_SECRET) {
      this.logger.warn('Laravel integration not configured');
      this.isFetchingTasks = false;
      return;
    }

    try {
      this.logger.info({ laravelUrl: process.env.LARAVEL_INTERNAL_URL }, 'Creating handshake instance');

      const handshake = new StartupWorkerHandshake({
        laravelUrl: process.env.LARAVEL_INTERNAL_URL,
        secret: process.env.LOCALBROWSER_SECRET,
        workerId: this.workerId,
        logger: this.logger,
        maxRetries: 3,
      });

      this.logger.info('Executing handshake');
      const tasks = await handshake.execute();

      this.logger.info({ taskCount: tasks.length }, 'Handshake completed');

      if (tasks.length > 0) {
        this.logger.info({ count: tasks.length }, 'Processing tasks');
        await this._processTasks(tasks);
      } else {
        this.logger.info('No tasks returned from Laravel');
      }
    } catch (error) {
      this.logger.error({ error: error.message, stack: error.stack }, 'Error fetching tasks');
    } finally {
      this.isFetchingTasks = false;
      this.logger.info('_fetchTasksFromLaravel END');
    }
  }

  /**
   * Process tasks with concurrency control
   * @private
   */
  async _processTasks(tasks) {
    if (this.isProcessingTasks) {
      this.logger.warn('Already processing tasks, queueing new batch');
      return;
    }

    this.isProcessingTasks = true;

    try {
      for (const laravelTask of tasks) {
        try {
          if (!this._validateTask(laravelTask)) {
            this.logger.error({ task: laravelTask }, 'Invalid task structure');
            continue;
          }

          this.logger.info({ laravelTaskId: laravelTask.id, type: laravelTask.type }, 'Processing Laravel task');

          const result = await this.taskExecutor.execute(laravelTask);

          this.logger.info({ taskId: laravelTask.id, success: result.success }, 'Task execution completed');

          if (this.resultSubmitter) {
            await this.resultSubmitter.submit(result);
          }
        } catch (error) {
          this.logger.error({ taskId: laravelTask.id, error: error.message, stack: error.stack }, 'Failed to process task');
        }
      }

      this.logger.info({ count: tasks.length }, 'All tasks processed');
    } finally {
      this.isProcessingTasks = false;
    }
  }

  /**
   * Validate task structure
   * @private
   */
  _validateTask(task) {
    if (!task || typeof task !== 'object') {
      this.logger.error('Task is not an object');
      return false;
    }

    if (!task.id) {
      this.logger.error('Task missing required field: id');
      return false;
    }

    if (!task.type) {
      this.logger.error('Task missing required field: type');
      return false;
    }

    if (!task.url) {
      this.logger.error('Task missing required field: url');
      return false;
    }

    return true;
  }

  /**
   * POST /internal/request-work
   * Laravel requests tasks for this worker
   * Returns up to N queued tasks
   */
  requestWork = async (req, res) => {
    const MAX_TASKS = req.body?.max_tasks || 5;

    try {
      this.logger.info('[InternalController] Work request received', {
        workerId: this.workerId,
        maxTasks: MAX_TASKS,
      });

      // Use TaskQueueService to fetch queued tasks
      const tasks = await this.taskQueueService.getPendingTasks(MAX_TASKS);

      if (tasks.length === 0) {
        this.logger.info('[InternalController] No tasks available', {
          workerId: this.workerId,
        });

        return res.json({
          status: 'no_work',
          tasks: [],
          timestamp: Math.floor(Date.now() / 1000),
        });
      }

      // Mark tasks as processing in database
      await this._markTasksProcessing(tasks);

      this.logger.info({ workerId: this.workerId, taskCount: tasks.length }, 'Returning tasks to worker');

      return res.json({
        status: 'ok',
        tasks,
        timestamp: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      this.logger.error({ error: error.message }, 'requestWork failed');

      return res.status(500).json({
        error: error.message,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
  };

  /**
   * POST /internal/task-result
   * Worker submits completed task result
   */
  submitResult = async (req, res) => {
    const { task_id, success, result, error, executed_at, duration_ms } = req.body;

    try {
      this.logger.info({ taskId: task_id, success, duration: duration_ms }, 'Task result received');

      // Validate result payload
      if (!task_id) {
        return res.status(400).json({ error: 'task_id required' });
      }

      // Update task in database with result
      await this._updateTaskResult({
        task_id,
        success,
        result,
        error,
        executed_at,
        duration_ms,
        worker_id: this.workerId,
      });

      // Dispatch ProcessBrowserResult job in Laravel (via HTTP callback)
      // Laravel will handle aggregation and analysis
      await this._notifyLaravelOfResult(task_id);

      this.logger.info({ taskId: task_id }, 'Task result processed');

      return res.json({
        status: 'accepted',
        task_id,
        timestamp: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      this.logger.error({ error: error.message }, 'submitResult failed');

      return res.status(500).json({
        error: error.message,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
  };

  /**
   * Get queued tasks from database (using TaskQueueService)
   * @private
   */
  async _getQueuedTasks(limit) {
    if (!this.taskQueueService) {
      this.logger.warn('TaskQueueService not available, using database directly');
      try {
        const stmt = db.prepare(`
          SELECT id, type, url, payload, created_at
          FROM browser_tasks
          WHERE status = 'pending'
          ORDER BY created_at ASC
          LIMIT ?
        `);
        
        const rows = stmt.all(limit);
        
        return rows.map(row => ({
          id: row.id,
          type: row.type,
          url: row.url,
          payload: row.payload ? JSON.parse(row.payload) : {},
          created_at: row.created_at,
        }));
      } catch (error) {
        this.logger.error({ error: error.message }, 'Failed to get queued tasks');
        return [];
      }
    }
    
    return await this.taskQueueService.getPendingTasks(limit);
  }

  /**
   * Mark tasks as processing in database
   * @private
   */
  async _markTasksProcessing(tasks) {
    try {
      const taskIds = tasks.map(t => t.id);
      const placeholders = taskIds.map(() => '?').join(',');
      
      const stmt = db.prepare(`
        UPDATE browser_tasks
        SET status = 'processing',
            started_at = datetime('now'),
            worker_id = ?,
            processing_by = ?
        WHERE id IN (${placeholders})
      `);
      
      const processingBy = `${os.hostname()}:${process.pid}`;
      stmt.run(this.workerId, processingBy, ...taskIds);
      
      this.logger.info({ count: taskIds.length, workerId: this.workerId }, 'Marked tasks as processing');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to mark tasks as processing');
      throw error;
    }
  }

  /**
   * Update task result in database
   * @private
   */
  async _updateTaskResult(taskResult) {
    try {
      const stmt = db.prepare(`
        UPDATE browser_tasks
        SET status = ?,
            result = ?,
            error = ?,
            completed_at = ?,
            duration_ms = ?,
            worker_id = ?,
            processing_by = ?
        WHERE id = ?
      `);
      
      const status = taskResult.success ? 'completed' : 'failed';
      const result = taskResult.result ? JSON.stringify(taskResult.result) : null;
      const error = taskResult.error || null;
      
      stmt.run(
        status,
        result,
        error,
        taskResult.executed_at,
        taskResult.duration_ms || 0,
        taskResult.worker_id || this.workerId,
        taskResult.processing_by || `${os.hostname()}:${process.pid}`,
        taskResult.task_id
      );
      
      this.logger.info({ taskId: taskResult.task_id, status }, 'Updated task result');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to update task result');
      throw error;
    }
  }

  /**
   * Notify Laravel of task result completion
   * @private
   */
  async _notifyLaravelOfResult(taskId) {
    if (!process.env.LARAVEL_INTERNAL_URL || !process.env.LOCALBROWSER_SECRET) {
      this.logger.warn('Cannot notify Laravel - not configured');
      return;
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', process.env.LOCALBROWSER_SECRET)
        .update(timestamp.toString())
        .digest('hex');

      const url = new URL('/internal/task-complete', process.env.LARAVEL_INTERNAL_URL);
      const client = url.protocol === 'https:' ? https : http;

      const payload = JSON.stringify({ task_id: taskId, worker_id: this.workerId, timestamp });

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Timestamp': timestamp.toString(),
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 10000,
        ...(process.env.NODE_ENV === 'development' && { rejectUnauthorized: false }),
      };

      await new Promise((resolve, reject) => {
        const req = client.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              this.logger.info({ taskId }, 'Laravel notified successfully');
              resolve();
            } else {
              reject(new Error(`Laravel returned ${res.statusCode}: ${data}`));
            }
          });
        });

        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')); });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });
    } catch (error) {
      this.logger.error({ taskId, error: error.message }, 'Failed to notify Laravel');
    }
  }
}

module.exports = InternalController;
