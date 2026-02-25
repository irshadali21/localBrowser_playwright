// services/taskProcessor.js
const TaskQueueService = require('./taskQueueService');
const os = require('os');

/**
 * Task Processor
 * 
 * Background worker that periodically checks for pending tasks
 * and processes them using the TaskExecutor.
 */
class TaskProcessor {
  constructor(dependencies = {}) {
    this.taskQueueService = dependencies.taskQueueService || new TaskQueueService();
    this.taskExecutor = dependencies.taskExecutor;
    this.resultSubmitter = dependencies.resultSubmitter;
    this.logger = dependencies.logger || { info: () => {}, warn: () => {}, error: () => {} };
    
    this.isRunning = false;
    this.intervalMs = dependencies.intervalMs || 5000;
    this.maxConcurrent = dependencies.maxConcurrent || 3;
    this.activeTasks = new Set();
    this.intervalId = null;
  }

  start() {
    if (this.isRunning) {
      this.logger.warn('TaskProcessor already running');
      return;
    }

    this.isRunning = true;
    this.logger.info({ intervalMs: this.intervalMs, maxConcurrent: this.maxConcurrent }, 'Starting task processor');

    this._processLoop();
    this.intervalId = setInterval(() => this._processLoop(), this.intervalMs);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.info('Task processor stopped');
  }

  async _processLoop() {
    try {
      if (this.activeTasks.size >= this.maxConcurrent) return;

      const availableSlots = this.maxConcurrent - this.activeTasks.size;
      const tasks = await this.taskQueueService.getPendingTasks(availableSlots);

      if (tasks.length === 0) return;

      this.logger.info({ count: tasks.length, activeCount: this.activeTasks.size }, 'Found pending tasks');

      for (const task of tasks) {
        this._processTask(task);
      }
    } catch (error) {
      this.logger.error({ error: error.message }, 'Process loop error');
    }
  }

  async _processTask(task) {
    this.activeTasks.add(task.id);

    try {
      this.logger.info({ taskId: task.id, type: task.type, url: task.url }, 'Processing task');

      await this.taskQueueService.updateTaskStatus(task.id, 'processing', {
        worker_id: process.env.WORKER_ID || `worker-${process.pid}`,
        processing_by: `${os.hostname()}:${process.pid}`,
      });

      const startTime = Date.now();
      const result = await this.taskExecutor.execute(task);
      const duration = Date.now() - startTime;

      const status = result.success ? 'completed' : 'failed';
      await this.taskQueueService.updateTaskStatus(task.id, status, {
        result: result.result,
        error: result.error,
        duration_ms: duration,
      });

      this.logger.info({ taskId: task.id, success: result.success, duration: `${duration}ms` }, 'Task completed');

      if (this.resultSubmitter) {
        try {
          await this.resultSubmitter.submit(result);
        } catch (error) {
          this.logger.error({ error: error.message }, 'Failed to submit result');
        }
      }
    } catch (error) {
      this.logger.error({ taskId: task.id, error: error.message }, 'Task processing failed');

      try {
        await this.taskQueueService.updateTaskStatus(task.id, 'failed', { error: error.message });
      } catch (updateError) {
        this.logger.error({ error: updateError.message }, 'Failed to update task status');
      }
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  getStatus() {
    return {
      running: this.isRunning,
      activeTasks: this.activeTasks.size,
      maxConcurrent: this.maxConcurrent,
      intervalMs: this.intervalMs,
    };
  }
}

module.exports = TaskProcessor;
