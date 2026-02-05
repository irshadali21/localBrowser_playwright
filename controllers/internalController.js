// controllers/internalController.js
const crypto = require('crypto');
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
    this.taskExecutor = dependencies.taskExecutor; // Task executor
    this.resultSubmitter = dependencies.resultSubmitter; // Result submitter
    this.taskQueueService = dependencies.taskQueueService; // Task queue service
    this.logger = dependencies.logger || console; // Logger
    this.workerId = process.env.WORKER_ID || `worker-${process.pid}`;
    this.isFetchingTasks = false; // Mutex for preventing concurrent task fetches
    this.isProcessingTasks = false; // Mutex for preventing concurrent task processing
  }

  /**
   * POST /internal/ping
   * Laravel notifies Node that work is available
   * Node responds and immediately fetches pending tasks
   */
  ping = async (req, res) => {
    console.log('[InternalController] Ping received - START', {
      workerId: this.workerId,
      timestamp: req.headers['x-timestamp'],
      time: new Date().toISOString(),
    });

    try {
      // Send immediate response
      res.json({
        status: 'ok',
        worker_id: this.workerId,
        timestamp: Math.floor(Date.now() / 1000),
        uptime: process.uptime(),
      });

      console.log('[InternalController] Ping response sent');

      // Asynchronously fetch tasks from Laravel (with concurrency control)
      setImmediate(async () => {
        console.log('[InternalController] Starting async task fetch after ping');
        try {
          await this._fetchTasksFromLaravel();
          console.log('[InternalController] Async task fetch completed');
        } catch (error) {
          console.error('[InternalController] Async task fetch failed', {
            error: error.message,
            stack: error.stack,
          });
        }
      });
    } catch (error) {
      console.error('[InternalController] Error in ping handler', {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * Fetch tasks from Laravel's /internal/request-work endpoint
   * @private
   */
  async _fetchTasksFromLaravel() {
    console.log('[InternalController] _fetchTasksFromLaravel START');
    
    // Concurrency control: prevent multiple simultaneous fetches
    if (this.isFetchingTasks) {
      console.log('[InternalController] Already fetching tasks, skipping duplicate request');
      return;
    }
    
    this.isFetchingTasks = true;

      if (!process.env.LARAVEL_INTERNAL_URL || !process.env.LOCALBROWSER_SECRET) {
        console.warn('[InternalController] Laravel integration not configured');
        return;
      }

    try {
      console.log('[InternalController] Creating handshake instance', {
        laravelUrl: process.env.LARAVEL_INTERNAL_URL,
      });

      const handshake = new StartupWorkerHandshake({
        laravelUrl: process.env.LARAVEL_INTERNAL_URL,
        secret: process.env.LOCALBROWSER_SECRET,
        workerId: this.workerId,
        logger: console,
        maxRetries: 3,
      });

      console.log('[InternalController] Executing handshake');
      const tasks = await handshake.execute();

      console.log('[InternalController] Handshake completed', {
        taskCount: tasks.length,
      });

      if (tasks.length > 0) {
        console.log('[InternalController] Processing tasks', {
          count: tasks.length,
        });

        // Process tasks asynchronously without blocking (with concurrency control)
        await this._processTasks(tasks);
      } else {
        console.log('[InternalController] No tasks returned from Laravel');
      }
    } catch (error) {
      console.error('[InternalController] Error fetching tasks', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isFetchingTasks = false;
      console.log('[InternalController] _fetchTasksFromLaravel END');
    }
  }

  /**
   * Process tasks with concurrency control
   * @private
   */
  async _processTasks(tasks) {
    // Check if already processing to prevent concurrent operations
    if (this.isProcessingTasks) {
      console.warn('[InternalController] Already processing tasks, queueing new batch');
      // In future, could queue these tasks instead of dropping
      return;
    }

    this.isProcessingTasks = true;

    try {
      for (const laravelTask of tasks) {
        try {
          // Validate task structure before processing
          if (!this._validateTask(laravelTask)) {
            console.error('[InternalController] Invalid task structure', {
              task: laravelTask,
            });
            continue;
          }

          console.log('[InternalController] Processing Laravel task', {
            laravelTaskId: laravelTask.id,
            type: laravelTask.type,
          });

          // Execute task using TaskExecutor
          const result = await this.taskExecutor.execute(laravelTask);

          console.log('[InternalController] Task execution completed', {
            taskId: laravelTask.id,
            success: result.success,
          });

          // Submit result back to Laravel
          if (this.resultSubmitter) {
            await this.resultSubmitter.submit(result);
          }
        } catch (error) {
          console.error('[InternalController] Failed to process task', {
            taskId: laravelTask.id,
            error: error.message,
            stack: error.stack,
          });
        }
      }

      console.log('[InternalController] All tasks processed', {
        count: tasks.length,
      });
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
      console.error('[InternalController] Task is not an object');
      return false;
    }

    if (!task.id) {
      console.error('[InternalController] Task missing required field: id');
      return false;
    }

    if (!task.type) {
      console.error('[InternalController] Task missing required field: type');
      return false;
    }

    if (!task.url) {
      console.error('[InternalController] Task missing required field: url');
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

      this.logger.info('[InternalController] Returning tasks to worker', {
        workerId: this.workerId,
        taskCount: tasks.length,
      });

      return res.json({
        status: 'ok',
        tasks,
        timestamp: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      this.logger.error('[InternalController] requestWork failed:', error);

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
      this.logger.info('[InternalController] Task result received', {
        taskId: task_id,
        success,
        duration: duration_ms,
      });

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

      this.logger.info('[InternalController] Task result processed', {
        taskId: task_id,
      });

      return res.json({
        status: 'accepted',
        task_id,
        timestamp: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      this.logger.error('[InternalController] submitResult failed:', error);

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
      this.logger.warn('[InternalController] TaskQueueService not available, using database directly');
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
        this.logger.error('[InternalController] Failed to get queued tasks:', error);
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
      
      const processingBy = `${require('os').hostname()}:${process.pid}`;
      stmt.run(this.workerId, processingBy, ...taskIds);
      
      this.logger.info('[InternalController] Marked tasks as processing', {
        count: taskIds.length,
        workerId: this.workerId,
      });
    } catch (error) {
      this.logger.error('[InternalController] Failed to mark tasks as processing:', error);
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
        taskResult.processing_by || `${require('os').hostname()}:${process.pid}`,
        taskResult.task_id
      );
      
      this.logger.info('[InternalController] Updated task result', {
        taskId: taskResult.task_id,
        status,
      });
    } catch (error) {
      this.logger.error('[InternalController] Failed to update task result:', error);
      throw error;
    }
  }

  /**
   * Notify Laravel of task result completion
   * @private
   */
  async _notifyLaravelOfResult(taskId) {
    // Only notify Laravel if we have the configuration
    if (!process.env.LARAVEL_INTERNAL_URL || !process.env.LOCALBROWSER_SECRET) {
      this.logger.warn('[InternalController] Cannot notify Laravel - not configured');
      return;
    }

    try {
      const crypto = require('crypto');
      const http = require('http');
      const https = require('https');
      
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', process.env.LOCALBROWSER_SECRET)
        .update(timestamp.toString())
        .digest('hex');

      const url = new URL('/internal/task-complete', process.env.LARAVEL_INTERNAL_URL);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const payload = JSON.stringify({
        task_id: taskId,
        worker_id: this.workerId,
        timestamp,
      });

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
              this.logger.info('[InternalController] Laravel notified successfully', { taskId });
              resolve();
            } else {
              reject(new Error(`Laravel returned ${res.statusCode}: ${data}`));
            }
          });
        });

        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
      });
    } catch (error) {
      this.logger.error('[InternalController] Failed to notify Laravel:', {
        taskId,
        error: error.message,
      });
      // Don't throw - notification failure shouldn't break task processing
    }
  }
}

module.exports = InternalController;
