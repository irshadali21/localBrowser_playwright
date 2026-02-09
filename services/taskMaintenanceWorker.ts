// services/taskMaintenanceWorker.ts
import { TaskQueueService } from './taskQueueService';
import { Logger } from '../types/services';

/**
 * Task Maintenance Worker
 *
 * Periodic maintenance tasks for the task queue:
 * - Reset stuck tasks
 * - Clean up old completed/failed tasks
 */
export class TaskMaintenanceWorker {
  private taskQueueService: TaskQueueService;
  private logger: Logger;
  private stuckTaskIntervalMs: number;
  private stuckTaskThresholdMinutes: number;
  private cleanupIntervalMs: number;
  private cleanupOlderThanDays: number;
  private isRunning: boolean;
  private stuckTaskIntervalId: ReturnType<typeof setInterval> | null;
  private cleanupIntervalId: ReturnType<typeof setInterval> | null;

  constructor(
    config: {
      taskQueueService?: TaskQueueService;
      logger?: Logger;
      stuckTaskIntervalMs?: number;
      stuckTaskThresholdMinutes?: number;
      cleanupIntervalMs?: number;
      cleanupOlderThanDays?: number;
    } = {}
  ) {
    this.taskQueueService = config.taskQueueService || new TaskQueueService();
    this.logger = config.logger || console;

    this.stuckTaskIntervalMs = config.stuckTaskIntervalMs || 300000;
    this.stuckTaskThresholdMinutes = config.stuckTaskThresholdMinutes || 30;

    this.cleanupIntervalMs = config.cleanupIntervalMs || 3600000;
    this.cleanupOlderThanDays = config.cleanupOlderThanDays || 7;

    this.isRunning = false;
    this.stuckTaskIntervalId = null;
    this.cleanupIntervalId = null;
  }

  /**
   * Start maintenance worker
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('[TaskMaintenance] Already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('[TaskMaintenance] Starting task maintenance worker');

    // Reset stuck tasks periodically
    this.stuckTaskIntervalId = setInterval(async () => {
      try {
        const reset = await this.taskQueueService.resetStuckTasks(this.stuckTaskThresholdMinutes);
        if (reset > 0) {
          this.logger.warn('[TaskMaintenance] Reset stuck tasks', { count: reset });
        }
      } catch (error) {
        const err = error as Error;
        this.logger.error('[TaskMaintenance] Failed to reset stuck tasks:', { error: err.message });
      }
    }, this.stuckTaskIntervalMs);

    // Clean up old tasks periodically
    this.cleanupIntervalId = setInterval(async () => {
      try {
        const deleted = await this.taskQueueService.cleanupOldTasks(this.cleanupOlderThanDays);
        if (deleted > 0) {
          this.logger.info('[TaskMaintenance] Cleaned up old tasks', { count: deleted });
        }
      } catch (error) {
        const err = error as Error;
        this.logger.error('[TaskMaintenance] Failed to clean up old tasks:', {
          error: err.message,
        });
      }
    }, this.cleanupIntervalMs);

    this.logger.info('[TaskMaintenance] Maintenance schedules configured', {
      stuckTaskCheck: `every ${this.stuckTaskIntervalMs / 1000}s`,
      cleanup: `every ${this.cleanupIntervalMs / 1000}s`,
    });
  }

  /**
   * Stop maintenance worker
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.stuckTaskIntervalId) {
      clearInterval(this.stuckTaskIntervalId);
      this.stuckTaskIntervalId = null;
    }

    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    this.logger.info('[TaskMaintenance] Stopped task maintenance worker');
  }
}

export default TaskMaintenanceWorker;
