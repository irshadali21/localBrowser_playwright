/**
 * Internal Controller - TypeScript migration
 * Handles communication with Laravel via private HMAC-secured endpoints
 */

import type { Request, Response } from 'express';
import type { Task, TaskStatus } from '../types/common';
import type { AppError } from '../types/errors';

/**
 * Task interface matching Laravel task structure
 */
interface LaravelTask {
  id: string;
  type: string;
  url: string;
  payload?: Record<string, unknown>;
  created_at?: string;
}

/**
 * Task result payload
 */
interface TaskResultPayload {
  task_id: string;
  success: boolean;
  result?: unknown;
  error?: string;
  executed_at?: string;
  duration_ms?: number;
  worker_id?: string;
}

/**
 * Logger interface
 */
interface LoggerInterface {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default logger implementation
 */
const defaultLogger: LoggerInterface = {
  info: (message, meta) => console.log(message, meta || ''),
  warn: (message, meta) => console.warn(message, meta || ''),
  error: (message, meta) => console.error(message, meta || ''),
};

/**
 * Dependencies interface
 */
interface InternalControllerDependencies {
  taskExecutor?: {
    execute(task: LaravelTask): Promise<{ success: boolean; result?: unknown; error?: string }>;
  };
  resultSubmitter?: {
    submit(result: { task_id: string; success: boolean; result?: unknown; error?: string }): Promise<void>;
  };
  taskQueueService?: {
    getPendingTasks(limit: number): Promise<LaravelTask[]>;
  };
  logger?: LoggerInterface;
}

/**
 * Internal API Controller
 */
export class InternalController {
  private taskExecutor?: InternalControllerDependencies['taskExecutor'];
  private resultSubmitter?: InternalControllerDependencies['resultSubmitter'];
  private taskQueueService?: InternalControllerDependencies['taskQueueService'];
  private logger: LoggerInterface;
  private workerId: string;
  private isFetchingTasks: boolean = false;
  private isProcessingTasks: boolean = false;

  constructor(dependencies: InternalControllerDependencies = {}) {
    this.taskExecutor = dependencies.taskExecutor;
    this.resultSubmitter = dependencies.resultSubmitter;
    this.taskQueueService = dependencies.taskQueueService;
    this.logger = dependencies.logger || defaultLogger;
    this.workerId = process.env.WORKER_ID || `worker-${process.pid}`;
  }

  /**
   * POST /internal/ping
   * Laravel notifies Node that work is available
   * Node responds and immediately fetches pending tasks
   */
  ping = async (req: Request, res: Response): Promise<void> => {
    this.logger.info('[InternalController] Ping received - START', {
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

      this.logger.info('[InternalController] Ping response sent');

      // Asynchronously fetch tasks from Laravel (with concurrency control)
      setImmediate(async () => {
        this.logger.info('[InternalController] Starting async task fetch after ping');
        try {
          await this._fetchTasksFromLaravel();
          this.logger.info('[InternalController] Async task fetch completed');
        } catch (error) {
          this.logger.error('[InternalController] Async task fetch failed', {
            error: (error as Error).message,
            stack: (error as Error).stack,
          });
        }
      });
    } catch (error) {
      this.logger.error('[InternalController] Error in ping handler', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      res.status(500).json({ error: (error as Error).message });
    }
  };

  /**
   * Fetch tasks from Laravel's /internal/request-work endpoint
   * @private
   */
  private async _fetchTasksFromLaravel(): Promise<void> {
    this.logger.info('[InternalController] _fetchTasksFromLaravel START');

    // Concurrency control: prevent multiple simultaneous fetches
    if (this.isFetchingTasks) {
      this.logger.info('[InternalController] Already fetching tasks, skipping duplicate request');
      return;
    }

    this.isFetchingTasks = true;

    if (!process.env.LARAVEL_INTERNAL_URL || !process.env.LOCALBROWSER_SECRET) {
      this.logger.warn('[InternalController] Laravel integration not configured');
      this.isFetchingTasks = false;
      return;
    }

    try {
      // Dynamic import to avoid circular dependencies
      const StartupWorkerHandshake = (await import('../bootstrap/startupWorkerHandshake')).default;

      this.logger.info('[InternalController] Creating handshake instance', {
        laravelUrl: process.env.LARAVEL_INTERNAL_URL,
      });

      const handshake = new StartupWorkerHandshake({
        laravelUrl: process.env.LARAVEL_INTERNAL_URL,
        secret: process.env.LOCALBROWSER_SECRET,
        workerId: this.workerId,
        logger: this.logger,
        maxRetries: 3,
      });

      this.logger.info('[InternalController] Executing handshake');
      const tasks = await handshake.execute();

      this.logger.info('[InternalController] Handshake completed', {
        taskCount: tasks.length,
      });

      if (tasks.length > 0) {
        this.logger.info('[InternalController] Processing tasks', {
          count: tasks.length,
        });

        // Process tasks asynchronously without blocking (with concurrency control)
        await this._processTasks(tasks);
      } else {
        this.logger.info('[InternalController] No tasks returned from Laravel');
      }
    } catch (error) {
      this.logger.error('[InternalController] Error fetching tasks', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
    } finally {
      this.isFetchingTasks = false;
      this.logger.info('[InternalController] _fetchTasksFromLaravel END');
    }
  }

  /**
   * Process tasks with concurrency control
   * @private
   */
  private async _processTasks(tasks: LaravelTask[]): Promise<void> {
    // Check if already processing to prevent concurrent operations
    if (this.isProcessingTasks) {
      this.logger.warn('[InternalController] Already processing tasks, queueing new batch');
      return;
    }

    this.isProcessingTasks = true;

    try {
      for (const laravelTask of tasks) {
        try {
          // Validate task structure before processing
          if (!this._validateTask(laravelTask)) {
            this.logger.error('[InternalController] Invalid task structure', {
              task: laravelTask,
            });
            continue;
          }

          this.logger.info('[InternalController] Processing Laravel task', {
            laravelTaskId: laravelTask.id,
            type: laravelTask.type,
          });

          // Execute task using TaskExecutor
          if (!this.taskExecutor) {
            throw new Error('TaskExecutor not configured');
          }

          const result = await this.taskExecutor.execute(laravelTask);

          this.logger.info('[InternalController] Task execution completed', {
            taskId: laravelTask.id,
            success: result.success,
          });

          // Submit result back to Laravel
          if (this.resultSubmitter) {
            await this.resultSubmitter.submit({
              task_id: laravelTask.id,
              success: result.success,
              result: result.result,
              error: result.error,
            });
          }
        } catch (error) {
          this.logger.error('[InternalController] Failed to process task', {
            taskId: laravelTask.id,
            error: (error as Error).message,
            stack: (error as Error).stack,
          });
        }
      }

      this.logger.info('[InternalController] All tasks processed', {
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
  private _validateTask(task: unknown): task is LaravelTask {
    if (!task || typeof task !== 'object') {
      this.logger.error('[InternalController] Task is not an object');
      return false;
    }

    const t = task as LaravelTask;

    if (!t.id) {
      this.logger.error('[InternalController] Task missing required field: id');
      return false;
    }

    if (!t.type) {
      this.logger.error('[InternalController] Task missing required field: type');
      return false;
    }

    if (!t.url) {
      this.logger.error('[InternalController] Task missing required field: url');
      return false;
    }

    return true;
  }

  /**
   * POST /internal/request-work
   * Laravel requests tasks for this worker
   * Returns up to N queued tasks
   */
  requestWork = async (req: Request<{}, {}, { max_tasks?: number }>, res: Response): Promise<void> => {
    const MAX_TASKS = req.body?.max_tasks || 5;

    try {
      this.logger.info('[InternalController] Work request received', {
        workerId: this.workerId,
        maxTasks: MAX_TASKS,
      });

      // Use TaskQueueService to fetch queued tasks
      const tasks = this.taskQueueService
        ? await this.taskQueueService.getPendingTasks(MAX_TASKS)
        : await this._getQueuedTasks(MAX_TASKS);

      if (tasks.length === 0) {
        this.logger.info('[InternalController] No tasks available', {
          workerId: this.workerId,
        });

        res.json({
          status: 'no_work',
          tasks: [],
          timestamp: Math.floor(Date.now() / 1000),
        });
        return;
      }

      // Mark tasks as processing in database
      await this._markTasksProcessing(tasks);

      this.logger.info('[InternalController] Returning tasks to worker', {
        workerId: this.workerId,
        taskCount: tasks.length,
      });

      res.json({
        status: 'ok',
        tasks,
        timestamp: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      this.logger.error('[InternalController] requestWork failed:', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      res.status(500).json({
        error: (error as Error).message,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
  };

  /**
   * POST /internal/task-result
   * Worker submits completed task result
   */
  submitResult = async (req: Request<{}, {}, TaskResultPayload>, res: Response): Promise<void> => {
    const { task_id, success, result, error, executed_at, duration_ms } = req.body;

    try {
      this.logger.info('[InternalController] Task result received', {
        taskId: task_id,
        success,
        duration: duration_ms,
      });

      // Validate result payload
      if (!task_id) {
        res.status(400).json({ error: 'task_id required' });
        return;
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
      await this._notifyLaravelOfResult(task_id);

      this.logger.info('[InternalController] Task result processed', {
        taskId: task_id,
      });

      res.json({
        status: 'accepted',
        task_id,
        timestamp: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      this.logger.error('[InternalController] submitResult failed:', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      res.status(500).json({
        error: (error as Error).message,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
  };

  /**
   * Get queued tasks from database (using TaskQueueService)
   * @private
   */
  private async _getQueuedTasks(limit: number): Promise<LaravelTask[]> {
    if (!this.taskQueueService) {
      this.logger.warn('[InternalController] TaskQueueService not available, using database directly');
      try {
        const db = require('../utils/db').default;

        const stmt = db.prepare(`
          SELECT id, type, url, payload, created_at
          FROM browser_tasks
          WHERE status = 'pending'
          ORDER BY created_at ASC
          LIMIT ?
        `);

        const rows = stmt.all(limit) as Array<{
          id: string;
          type: string;
          url: string;
          payload: string | null;
          created_at: string;
        }>;

        return rows.map((row) => ({
          id: row.id,
          type: row.type,
          url: row.url,
          payload: row.payload ? JSON.parse(row.payload) : {},
          created_at: row.created_at,
        }));
      } catch (error) {
        this.logger.error('[InternalController] Failed to get queued tasks:', {
          error: (error as Error).message,
        });
        return [];
      }
    }

    return await this.taskQueueService.getPendingTasks(limit);
  }

  /**
   * Mark tasks as processing in database
   * @private
   */
  private async _markTasksProcessing(tasks: LaravelTask[]): Promise<void> {
    try {
      const os = await import('os');
      const db = require('../utils/db.js').default;

      const taskIds = tasks.map((t) => t.id);
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

      this.logger.info('[InternalController] Marked tasks as processing', {
        count: taskIds.length,
        workerId: this.workerId,
      });
    } catch (error) {
      this.logger.error('[InternalController] Failed to mark tasks as processing:', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Update task result in database
   * @private
   */
  private async _updateTaskResult(taskResult: TaskResultPayload & { worker_id?: string; processing_by?: string }): Promise<void> {
    try {
      const os = await import('os');
      const db = require('../utils/db.js').default;

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

      this.logger.info('[InternalController] Updated task result', {
        taskId: taskResult.task_id,
        status,
      });
    } catch (error) {
      this.logger.error('[InternalController] Failed to update task result:', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Notify Laravel of task result completion
   * @private
   */
  private async _notifyLaravelOfResult(taskId: string): Promise<void> {
    // Only notify Laravel if we have the configuration
    if (!process.env.LARAVEL_INTERNAL_URL || !process.env.LOCALBROWSER_SECRET) {
      this.logger.warn('[InternalController] Cannot notify Laravel - not configured');
      return;
    }

    try {
      const crypto = await import('crypto');
      const http = await import('http');
      const https = await import('https');

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', process.env.LOCALBROWSER_SECRET!)
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
        port: url.port || (isHttps ? 443 : 80),
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

      await new Promise<void>((resolve, reject) => {
        const req = client.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
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
        error: (error as Error).message,
      });
      // Don't throw - notification failure shouldn't break task processing
    }
  }
}

export default InternalController;
