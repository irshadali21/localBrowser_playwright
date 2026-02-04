// controllers/internalController.js
const crypto = require('crypto');

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
   * Acknowledges receipt of ping from Laravel
   */
  ping = (req, res) => {
    this.logger.info('[InternalController] Ping received', {
      workerId: this.workerId,
      timestamp: req.headers['x-timestamp'],
    });

    return res.json({
      status: 'ok',
      worker_id: this.workerId,
      timestamp: Math.floor(Date.now() / 1000),
      uptime: process.uptime(),
    });
  };

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
