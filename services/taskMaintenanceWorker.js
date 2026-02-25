// services/taskMaintenanceWorker.js
const TaskQueueService = require('./taskQueueService');

/**
 * Task Maintenance Worker
 * 
 * Periodic maintenance tasks for the task queue:
 * - Reset stuck tasks
 * - Clean up old completed/failed tasks
 */
class TaskMaintenanceWorker {
  constructor(config = {}) {
    this.taskQueueService = config.taskQueueService || new TaskQueueService();
    this.logger = config.logger || { info: () => {}, warn: () => {}, error: () => {} };
    
    this.stuckTaskIntervalMs = config.stuckTaskIntervalMs || 300000;
    this.stuckTaskThresholdMinutes = config.stuckTaskThresholdMinutes || 30;
    
    this.cleanupIntervalMs = config.cleanupIntervalMs || 3600000;
    this.cleanupOlderThanDays = config.cleanupOlderThanDays || 7;
    
    this.isRunning = false;
    this.stuckTaskIntervalId = null;
    this.cleanupIntervalId = null;
  }

  start() {
    if (this.isRunning) {
      this.logger.warn('TaskMaintenance already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting task maintenance worker');

    // Reset stuck tasks periodically
    this.stuckTaskIntervalId = setInterval(async () => {
      try {
        const reset = await this.taskQueueService.resetStuckTasks(this.stuckTaskThresholdMinutes);
        if (reset > 0) {
          this.logger.warn({ count: reset }, 'Reset stuck tasks');
        }
      } catch (error) {
        this.logger.error({ error: error.message }, 'Failed to reset stuck tasks');
      }
    }, this.stuckTaskIntervalMs);

    // Clean up old tasks periodically
    this.cleanupIntervalId = setInterval(async () => {
      try {
        const deleted = await this.taskQueueService.cleanupOldTasks(this.cleanupOlderThanDays);
        if (deleted > 0) {
          this.logger.info({ count: deleted }, 'Cleaned up old tasks');
        }
      } catch (error) {
        this.logger.error({ error: error.message }, 'Failed to clean up old tasks');
      }
    }, this.cleanupIntervalMs);

    this.logger.info({
      stuckTaskCheckMs: this.stuckTaskIntervalMs,
      cleanupIntervalMs: this.cleanupIntervalMs
    }, 'Maintenance schedules configured');
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.stuckTaskIntervalId) {
      clearInterval(this.stuckTaskIntervalId);
      this.stuckTaskIntervalId = null;
    }

    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    this.logger.info('Task maintenance worker stopped');
  }
}

module.exports = TaskMaintenanceWorker;
