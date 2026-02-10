// services/taskQueueService.ts
import db from '../utils/db';
import * as crypto from 'crypto';
import { Logger, Task, TaskInput, TaskStatus, TaskStatistics } from '../types/services';

/**
 * Task Queue Service
 *
 * Unified service for managing browser automation tasks.
 * Provides a database-backed queue for task management.
 * Integrates with both internal API (Laravel) and legacy job queue.
 */
export class TaskQueueService {
  private readonly logger: Logger;
  private readonly maxConcurrentTasks: number;
  private activeTasks: Set<string>;

  constructor(config: { logger?: Logger; maxConcurrentTasks?: number } = {}) {
    this.logger = config.logger || console;
    this.maxConcurrentTasks = config.maxConcurrentTasks || 3;
    this.activeTasks = new Set<string>();
  }

  /**
   * Add a new task to the queue
   */
  async enqueueTask(task: TaskInput): Promise<string> {
    try {
      // Validate task
      if (!task.type || !task.url) {
        throw new Error('Task must have type and url');
      }

      // Generate unique task ID if not provided
      const taskId = task.id || crypto.randomBytes(16).toString('hex');

      const stmt = db.prepare(`
        INSERT INTO browser_tasks (id, type, url, payload, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))
      `);

      stmt.run(taskId, task.type, task.url, task.payload ? JSON.stringify(task.payload) : null);

      this.logger.info('[TaskQueueService] Task enqueued', {
        taskId,
        type: task.type,
        url: task.url,
      });

      return taskId;
    } catch (error) {
      const err = error as Error;
      this.logger.error('[TaskQueueService] Failed to enqueue task:', { error: err.message });
      throw error;
    }
  }

  /**
   * Add multiple tasks in batch
   */
  async enqueueBatch(tasks: TaskInput[]): Promise<string[]> {
    const taskIds: string[] = [];

    try {
      const stmt = db.prepare(`
        INSERT INTO browser_tasks (id, type, url, payload, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))
      `);

      const insertMany = db.transaction((tasksToInsert: TaskInput[]) => {
        for (const task of tasksToInsert) {
          const taskId = task.id || crypto.randomBytes(16).toString('hex');
          stmt.run(taskId, task.type, task.url, task.payload ? JSON.stringify(task.payload) : null);
          taskIds.push(taskId);
        }
      });

      insertMany(tasks);

      this.logger.info('[TaskQueueService] Batch enqueued', {
        count: taskIds.length,
      });

      return taskIds;
    } catch (error) {
      const err = error as Error;
      this.logger.error('[TaskQueueService] Failed to enqueue batch:', { error: err.message });
      throw error;
    }
  }

  /**
   * Get pending tasks (ready to process)
   */
  async getPendingTasks(limit: number = 10): Promise<Task[]> {
    try {
      const stmt = db.prepare(`
        SELECT id, type, url, payload, created_at
        FROM browser_tasks
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT ?
      `);

      interface DbRow {
        id: string;
        type: string;
        url: string;
        payload: string | null;
        created_at: string;
      }

      const rows = stmt.all(limit) as DbRow[];

      return rows.map(row => ({
        id: row.id,
        type: row.type as TaskType,
        url: row.url,
        payload: row.payload ? JSON.parse(row.payload) : undefined,
        created_at: row.created_at,
      }));
    } catch (error) {
      const err = error as Error;
      this.logger.error('[TaskQueueService] Failed to get pending tasks:', { error: err.message });
      return [];
    }
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    try {
      const stmt = db.prepare(`
        SELECT id, type, url, payload, status, result, error,
               worker_id, processing_by, created_at, started_at,
               completed_at, duration_ms
        FROM browser_tasks
        WHERE id = ?
      `);

      interface DbRow {
        id: string;
        type: string;
        url: string;
        payload: string | null;
        status: string;
        result: string | null;
        error: string | null;
        worker_id: string | null;
        processing_by: string | null;
        created_at: string;
        started_at: string | null;
        completed_at: string | null;
        duration_ms: number | null;
      }

      const row = stmt.get(taskId) as DbRow | undefined;

      if (!row) return null;

      return {
        id: row.id,
        type: row.type as TaskType,
        url: row.url,
        payload: row.payload ? JSON.parse(row.payload) : undefined,
        status: row.status as TaskStatus,
        result: row.result ? JSON.parse(row.result) : undefined,
        error: row.error,
        worker_id: row.worker_id,
        processing_by: row.processing_by,
        created_at: row.created_at,
        started_at: row.started_at,
        completed_at: row.completed_at,
        duration_ms: row.duration_ms,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error('[TaskQueueService] Failed to get task:', { error: err.message });
      return null;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    metadata: Partial<Task> = {}
  ): Promise<void> {
    try {
      const updates: string[] = ['status = ?'];
      const values: (string | number)[] = [status];

      if (status === 'processing') {
        updates.push("started_at = datetime('now')");
        if (metadata.worker_id) {
          updates.push('worker_id = ?');
          values.push(metadata.worker_id);
        }
        if (metadata.processing_by) {
          updates.push('processing_by = ?');
          values.push(metadata.processing_by);
        }
      }

      if (status === 'completed' || status === 'failed') {
        updates.push("completed_at = datetime('now')");
        if (metadata.result !== undefined) {
          updates.push('result = ?');
          values.push(JSON.stringify(metadata.result));
        }
        if (metadata.error) {
          updates.push('error = ?');
          values.push(metadata.error);
        }
        if (metadata.duration_ms) {
          updates.push('duration_ms = ?');
          values.push(metadata.duration_ms);
        }
      }

      values.push(taskId);

      const stmt = db.prepare(`
        UPDATE browser_tasks
        SET ${updates.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...values);

      this.logger.info('[TaskQueueService] Task status updated', {
        taskId,
        status,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error('[TaskQueueService] Failed to update task status:', { error: err.message });
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getStatistics(): Promise<TaskStatistics> {
    try {
      const stmt = db.prepare(`
        SELECT
          status,
          COUNT(*) as count
        FROM browser_tasks
        GROUP BY status
      `);

      interface StatRow {
        status: string;
        count: number;
      }

      const rows = stmt.all() as StatRow[];
      const stats: TaskStatistics = {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };

      rows.forEach(row => {
        const count = row.count as number;
        const statusKey = row.status as 'pending' | 'processing' | 'completed' | 'failed';
        if (statusKey in stats) {
          stats[statusKey] = count;
        }
        stats.total += count;
      });

      return stats;
    } catch (error) {
      const err = error as Error;
      this.logger.error('[TaskQueueService] Failed to get statistics:', { error: err.message });
      return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * Clean up old completed/failed tasks
   */
  async cleanupOldTasks(olderThanDays: number = 7): Promise<number> {
    try {
      const stmt = db.prepare(`
        DELETE FROM browser_tasks
        WHERE status IN ('completed', 'failed')
          AND created_at < datetime('now', '-' || ? || ' days')
      `);

      interface RunResult {
        changes: number;
      }

      const result = stmt.run(olderThanDays) as RunResult;

      this.logger.info('[TaskQueueService] Cleaned up old tasks', {
        deleted: result.changes,
        olderThanDays,
      });

      return result.changes;
    } catch (error) {
      const err = error as Error;
      this.logger.error('[TaskQueueService] Failed to cleanup old tasks:', { error: err.message });
      return 0;
    }
  }

  /**
   * Reset stuck tasks (processing for too long)
   */
  async resetStuckTasks(stuckAfterMinutes: number = 30): Promise<number> {
    try {
      const stmt = db.prepare(`
        UPDATE browser_tasks
        SET status = 'pending',
            worker_id = NULL,
            processing_by = NULL,
            started_at = NULL
        WHERE status = 'processing'
          AND started_at < datetime('now', '-' || ? || ' minutes')
      `);

      interface RunResult {
        changes: number;
      }

      const result = stmt.run(stuckAfterMinutes) as RunResult;

      if (result.changes > 0) {
        this.logger.warn('[TaskQueueService] Reset stuck tasks', {
          count: result.changes,
          stuckAfterMinutes,
        });
      }

      return result.changes;
    } catch (error) {
      const err = error as Error;
      this.logger.error('[TaskQueueService] Failed to reset stuck tasks:', { error: err.message });
      return 0;
    }
  }
}

// Type helper for TaskType
type TaskType = 'website_html' | 'lighthouse_html';

export default TaskQueueService;
