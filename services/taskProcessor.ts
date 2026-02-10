// services/taskProcessor.ts
import os from 'os';
import { TaskQueueService } from './taskQueueService';
import { TaskExecutor } from './taskExecutor';
import { ResultSubmitter } from './resultSubmitter';
import { Task, TaskProcessorStatus, Logger } from '../types/services';
import type { VisitResult } from '../types/browser';

/**
 * Task Processor
 *
 * Background worker that periodically checks for pending tasks
 * and processes them using the TaskExecutor.
 */
export class TaskProcessor {
  private taskQueueService: TaskQueueService;
  private taskExecutor: TaskExecutor;
  private resultSubmitter?: ResultSubmitter;
  private logger: Logger;
  private isRunning: boolean;
  private intervalMs: number;
  private maxConcurrent: number;
  private activeTasks: Set<string>;
  private intervalId: ReturnType<typeof setInterval> | null;

  constructor(
    dependencies: {
      taskQueueService?: TaskQueueService;
      taskExecutor?: TaskExecutor;
      resultSubmitter?: ResultSubmitter;
      logger?: Logger;
      intervalMs?: number;
      maxConcurrent?: number;
    } = {}
  ) {
    this.taskQueueService = dependencies.taskQueueService || new TaskQueueService();
    this.taskExecutor =
      dependencies.taskExecutor ||
      new TaskExecutor({
        visitUrl: async () => ({ url: '' }) as unknown as VisitResult,
      });
    this.resultSubmitter = dependencies.resultSubmitter;
    this.logger = dependencies.logger || console;

    this.isRunning = false;
    this.intervalMs = dependencies.intervalMs || 5000;
    this.maxConcurrent = dependencies.maxConcurrent || 3;
    this.activeTasks = new Set<string>();
    this.intervalId = null;
  }

  /**
   * Start the background processor
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('[TaskProcessor] Already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('[TaskProcessor] Starting background task processor', {
      intervalMs: this.intervalMs,
      maxConcurrent: this.maxConcurrent,
    });

    // Initial run
    this._processLoop();

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this._processLoop();
    }, this.intervalMs);
  }

  /**
   * Stop the background processor
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.logger.info('[TaskProcessor] Stopped background task processor');
  }

  /**
   * Process loop - checks for pending tasks and processes them
   */
  private async _processLoop(): Promise<void> {
    try {
      // Don't fetch new tasks if we're at capacity
      if (this.activeTasks.size >= this.maxConcurrent) {
        return;
      }

      // Calculate how many tasks we can take
      const availableSlots = this.maxConcurrent - this.activeTasks.size;

      // Get pending tasks
      const tasks = await this.taskQueueService.getPendingTasks(availableSlots);

      if (tasks.length === 0) {
        return;
      }

      this.logger.info('[TaskProcessor] Found pending tasks', {
        count: tasks.length,
        activeCount: this.activeTasks.size,
      });

      // Process each task
      for (const task of tasks) {
        this._processTask(task);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error('[TaskProcessor] Error in process loop:', { error: err.message });
    }
  }

  /**
   * Process a single task (async, non-blocking)
   */
  private async _processTask(task: Task): Promise<void> {
    // Add to active tasks
    this.activeTasks.add(task.id);

    try {
      this.logger.info('[TaskProcessor] Processing task', {
        taskId: task.id,
        type: task.type,
        url: task.url,
      });

      // Mark as processing
      await this.taskQueueService.updateTaskStatus(task.id, 'processing', {
        worker_id: process.env.WORKER_ID || `worker-${process.pid}`,
        processing_by: `${os.hostname()}:${process.pid}`,
      });

      // Execute task
      const startTime = Date.now();
      const result = await this.taskExecutor.execute(task);
      const duration = Date.now() - startTime;

      // Update task with result
      const status = result.success ? 'completed' : 'failed';
      await this.taskQueueService.updateTaskStatus(task.id, status, {
        result: result.result,
        error: result.error,
        duration_ms: duration,
      });

      this.logger.info('[TaskProcessor] Task completed', {
        taskId: task.id,
        success: result.success,
        duration: `${duration}ms`,
      });

      // Submit result to Laravel if configured
      if (this.resultSubmitter) {
        try {
          await this.resultSubmitter.submit(result);
        } catch (error) {
          const err = error as Error;
          this.logger.error('[TaskProcessor] Failed to submit result:', { error: err.message });
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error('[TaskProcessor] Task processing failed', {
        taskId: task.id,
        error: err.message,
      });

      // Update task as failed
      try {
        await this.taskQueueService.updateTaskStatus(task.id, 'failed', {
          error: err.message,
        });
      } catch (updateError) {
        const updErr = updateError as Error;
        this.logger.error('[TaskProcessor] Failed to update task status:', {
          error: updErr.message,
        });
      }
    } finally {
      // Remove from active tasks
      this.activeTasks.delete(task.id);
    }
  }

  /**
   * Get processor status
   */
  getStatus(): TaskProcessorStatus {
    return {
      running: this.isRunning,
      activeTasks: this.activeTasks.size,
      maxConcurrent: this.maxConcurrent,
      intervalMs: this.intervalMs,
    };
  }
}

export default TaskProcessor;
