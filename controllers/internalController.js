// controllers/internalController.js
const crypto = require('crypto');
const StartupWorkerHandshake = require('../bootstrap/startupWorkerHandshake');

/**
 * Internal API Controller
 * 
 * Handles communication with Laravel via private HMAC-secured endpoints.
 * Methods: ping, requestWork, submitResult
 */
class InternalController {
  constructor(dependencies = {}) {
    this.taskQueue = dependencies.taskQueue; // Job queue
    this.taskExecutor = dependencies.taskExecutor; // Task executor
    this.resultSubmitter = dependencies.resultSubmitter; // Result submitter
    this.logger = dependencies.logger || console; // Logger
    this.workerId = process.env.WORKER_ID || `worker-${process.pid}`;
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

      // Asynchronously fetch tasks from Laravel
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

        // Process tasks asynchronously without blocking the response
        setImmediate(async () => {
          for (const laravelTask of tasks) {
            try {
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
        });
      } else {
        console.log('[InternalController] No tasks returned from Laravel');
      }
    } catch (error) {
      console.error('[InternalController] Error fetching tasks', {
        error: error.message,
        stack: error.stack,
      });
    }

    console.log('[InternalController] _fetchTasksFromLaravel END');
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

      // Fetch queued tasks from database
      // In Phase 2, this will be replaced with actual database queries
      // For now, we return placeholder logic
      const tasks = await this._getQueuedTasks(MAX_TASKS);

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

      // Mark tasks as "processing" in database
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
   * Get queued tasks from Laravel (via HTTP)
   * @private
   */
  async _getQueuedTasks(limit) {
    // Phase 1: Placeholder returning empty array
    // Phase 2: Call Laravel API or use job queue
    return [];
  }

  /**
   * Mark tasks as processing in database
   * @private
   */
  async _markTasksProcessing(tasks) {
    // Phase 1: Placeholder
    // Phase 2: Update leadcenter_browser_tasks SET status='processing' WHERE id IN (...)
    return;
  }

  /**
   * Update task result in database
   * @private
   */
  async _updateTaskResult(taskResult) {
    // Phase 1: Placeholder
    // Phase 2: Update leadcenter_browser_tasks SET result=..., status='browser_complete' WHERE id=...
    return;
  }

  /**
   * Notify Laravel of task result completion
   * @private
   */
  async _notifyLaravelOfResult(taskId) {
    // Phase 1: Placeholder
    // Phase 2: POST to Laravel /internal/task-complete endpoint to trigger ProcessBrowserResult job
    return;
  }
}

module.exports = InternalController;
