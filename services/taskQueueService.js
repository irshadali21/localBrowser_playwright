// services/taskQueueService.js
const db = require('../utils/db');
const crypto = require('crypto');

/**
 * Task Queue Service
 * 
 * Unified service for managing browser automation tasks.
 * Provides a database-backed queue for task management.
 * Integrates with both internal API (Laravel) and legacy job queue.
 */
class TaskQueueService {
  constructor(config = {}) {
    this.logger = config.logger || { info: () => {}, error: () => {}, warn: () => {} };
    this.maxConcurrentTasks = config.maxConcurrentTasks || 3;
    this.activeTasks = new Set();
  }

  /**
   * Add a new task to the queue
   * @param {Object} task - Task definition
   * @returns {string} Task ID
   */
  async enqueueTask(task) {
    try {
      if (!task.type || !task.url) {
        throw new Error('Task must have type and url');
      }

      const taskId = task.id || crypto.randomBytes(16).toString('hex');

      const stmt = db.prepare(`
        INSERT INTO browser_tasks (id, type, url, payload, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))
      `);

      stmt.run(taskId, task.type, task.url, task.payload ? JSON.stringify(task.payload) : null);

      this.logger.info({ taskId, type: task.type, url: task.url }, 'Task enqueued');
      return taskId;
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to enqueue task');
      throw error;
    }
  }

  /**
   * Add multiple tasks in batch
   * @param {Array} tasks - Array of task definitions
   * @returns {Array} Array of task IDs
   */
  async enqueueBatch(tasks) {
    const taskIds = [];

    try {
      const stmt = db.prepare(`
        INSERT INTO browser_tasks (id, type, url, payload, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))
      `);

      const insertMany = db.transaction((tasksToInsert) => {
        for (const task of tasksToInsert) {
          // Validate task before insertion (same validation as enqueueTask)
          if (!task.type || !task.url) {
            throw new Error('Task must have type and url');
          }
          const taskId = task.id || crypto.randomBytes(16).toString('hex');
          stmt.run(taskId, task.type, task.url, task.payload ? JSON.stringify(task.payload) : null);
          taskIds.push(taskId);
        }
      });

      insertMany(tasks);
      this.logger.info({ count: taskIds.length }, 'Batch enqueued');
      return taskIds;
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to enqueue batch');
      throw error;
    }
  }

  /**
   * Get pending tasks (ready to process)
   * @param {number} limit - Maximum number of tasks to retrieve
   * @returns {Array} Array of tasks
   */
  async getPendingTasks(limit = 10) {
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
        id: row.id, type: row.type, url: row.url,
        payload: row.payload ? JSON.parse(row.payload) : {},
        created_at: row.created_at,
      }));
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to get pending tasks');
      return [];
    }
  }

  /**
   * Get task by ID
   * @param {string} taskId - Task ID
   * @returns {Object|null} Task object or null
   */
  async getTask(taskId) {
    try {
      const stmt = db.prepare(`
        SELECT id, type, url, payload, status, result, error,
               worker_id, processing_by, created_at, started_at,
               completed_at, duration_ms
        FROM browser_tasks
        WHERE id = ?
      `);

      const row = stmt.get(taskId);
      if (!row) return null;

      return {
        id: row.id, type: row.type, url: row.url,
        payload: row.payload ? JSON.parse(row.payload) : {},
        status: row.status, result: row.result ? JSON.parse(row.result) : null,
        error: row.error, worker_id: row.worker_id, processing_by: row.processing_by,
        created_at: row.created_at, started_at: row.started_at,
        completed_at: row.completed_at, duration_ms: row.duration_ms,
      };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to get task');
      return null;
    }
  }

  /**
   * Update task status
   * @param {string} taskId - Task ID
   * @param {string} status - New status
   * @param {Object} metadata - Additional metadata
   */
  async updateTaskStatus(taskId, status, metadata = {}) {
    try {
      const updates = ['status = ?'];
      const values = [status];

      if (status === 'processing') {
        updates.push("started_at = datetime('now')");
        if (metadata.worker_id) { updates.push('worker_id = ?'); values.push(metadata.worker_id); }
        if (metadata.processing_by) { updates.push('processing_by = ?'); values.push(metadata.processing_by); }
      }

      if (status === 'completed' || status === 'failed') {
        updates.push("completed_at = datetime('now')");
        if (metadata.result) { updates.push('result = ?'); values.push(JSON.stringify(metadata.result)); }
        if (metadata.error) { updates.push('error = ?'); values.push(metadata.error); }
        if (metadata.duration_ms) { updates.push('duration_ms = ?'); values.push(metadata.duration_ms); }
      }

      values.push(taskId);
      const stmt = db.prepare(`UPDATE browser_tasks SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      this.logger.info({ taskId, status }, 'Task status updated');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to update task status');
      throw error;
    }
  }

  /**
   * Get queue statistics
   * @returns {Object} Queue statistics
   */
  async getStatistics() {
    const stats = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
    try {
      const stmt = db.prepare(`
        SELECT status, COUNT(*) as count FROM browser_tasks GROUP BY status
      `);

      const rows = stmt.all();
      rows.forEach(row => { stats[row.status] = row.count; stats.total += row.count; });
      return stats;
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to get statistics');
      return stats;
    }
  }

  /**
   * Clean up old completed/failed tasks
   * @param {number} olderThanDays - Delete tasks older than this many days
   * @returns {number} Number of tasks deleted
   */
  async cleanupOldTasks(olderThanDays = 7) {
    try {
      const stmt = db.prepare(`
        DELETE FROM browser_tasks
        WHERE status IN ('completed', 'failed')
          AND created_at < datetime('now', '-' || ? || ' days')
      `);

      const result = stmt.run(olderThanDays);
      this.logger.info({ deleted: result.changes, olderThanDays }, 'Cleaned up old tasks');
      return result.changes;
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to cleanup old tasks');
      return 0;
    }
  }

  /**
   * Reset stuck tasks (processing for too long)
   * @param {number} stuckAfterMinutes - Reset tasks stuck for this many minutes
   * @returns {number} Number of tasks reset
   */
  async resetStuckTasks(stuckAfterMinutes = 30) {
    try {
      const stmt = db.prepare(`
        UPDATE browser_tasks
        SET status = 'pending', worker_id = NULL, processing_by = NULL, started_at = NULL
        WHERE status = 'processing'
          AND started_at < datetime('now', '-' || ? || ' minutes')
      `);

      const result = stmt.run(stuckAfterMinutes);
      if (result.changes > 0) {
        this.logger.warn({ count: result.changes, stuckAfterMinutes }, 'Reset stuck tasks');
      }
      return result.changes;
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to reset stuck tasks');
      return 0;
    }
  }
}

module.exports = TaskQueueService;
