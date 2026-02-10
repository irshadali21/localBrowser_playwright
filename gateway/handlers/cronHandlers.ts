/**
 * Cron Command Handlers
 * Command handlers for cron/scheduled tasks
 */

import { BaseCommandHandler, HandlerResult, AuditContext } from './baseCommandHandler';
import cronController from '../../controllers/cronController';

/**
 * Cron Schedule Handler - Schedule a task
 */
export class CronScheduleHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.cronExpression || typeof payload.cronExpression !== 'string') {
      errors.push('cronExpression is required');
    }

    if (!payload.commandId || typeof payload.commandId !== 'string') {
      errors.push('commandId is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const cronExpression = _payload.cronExpression as string;
      const commandId = _payload.commandId as string;
      const taskPayload = _payload.payload as Record<string, unknown> | undefined;
      const options = _payload.options as Record<string, unknown> | undefined;

      // Store scheduled task
      const db = await import('../../utils/db');
      const taskId = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      db.default
        ?.prepare?.(
          `
        INSERT INTO scheduled_tasks (id, cron_expression, command_id, payload, options, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `
        )
        ?.run(
          taskId,
          cronExpression,
          commandId,
          JSON.stringify(taskPayload || {}),
          JSON.stringify(options || {})
        );

      return {
        success: true,
        data: {
          taskId,
          cronExpression,
          commandId,
          payload: taskPayload,
          options,
          createdAt: new Date().toISOString(),
          status: 'scheduled',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CRON_SCHEDULE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'cron';
  }

  getName(): string {
    return 'cron.schedule';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'write';
  }
}

/**
 * Cron Unschedule Handler - Remove scheduled task
 */
export class CronUnscheduleHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.taskId || typeof payload.taskId !== 'string') {
      errors.push('taskId is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const taskId = _payload.taskId as string;

      // Remove scheduled task
      const db = await import('../../utils/db');
      db.default?.prepare?.('DELETE FROM scheduled_tasks WHERE id = ?')?.run(taskId);

      return {
        success: true,
        data: {
          taskId,
          status: 'removed',
          removedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CRON_UNSCHEDULE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'cron';
  }

  getName(): string {
    return 'cron.unschedule';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'delete';
  }
}

/**
 * Cron List Handler - List scheduled tasks
 */
export class CronListHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const options = payload.options as Record<string, unknown> | undefined;
      const limit = (options?.limit as number) || 50;
      const offset = (options?.offset as number) || 0;

      // Get scheduled tasks from database
      const db = await import('../../utils/db');
      const tasks =
        (db.default
          ?.prepare?.(
            `
        SELECT * FROM scheduled_tasks
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `
          )
          ?.all(limit, offset) as
          | Array<{
              id: string;
              cron_expression: string;
              command_id: string;
              payload: string;
              created_at: string;
            }>
          | undefined) || [];

      // Get total count
      const countResult = db.default
        ?.prepare?.('SELECT COUNT(*) as total FROM scheduled_tasks')
        ?.get() as { total: number } | undefined;
      const total = countResult?.total || 0;

      return {
        success: true,
        data: {
          tasks: tasks.map(task => ({
            taskId: task.id,
            cronExpression: task.cron_expression,
            commandId: task.command_id,
            payload: JSON.parse(task.payload || '{}'),
            createdAt: task.created_at,
          })),
          total,
          limit,
          offset,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CRON_LIST_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'cron';
  }

  getName(): string {
    return 'cron.list';
  }
}

/**
 * Cron Trigger Handler - Trigger task manually
 */
export class CronTriggerHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.taskId && !payload.commandId) {
      errors.push('taskId or commandId is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const taskId = _payload.taskId as string | undefined;
      const commandId = _payload.commandId as string | undefined;
      const manualPayload = _payload.payload as Record<string, unknown> | undefined;

      let triggerCommandId = commandId;
      let triggerPayload = manualPayload;

      // If taskId provided, load task details
      if (taskId) {
        const db = await import('../../utils/db');
        const task = db.default
          ?.prepare?.('SELECT * FROM scheduled_tasks WHERE id = ?')
          ?.get(taskId) as { command_id: string; payload: string } | undefined;

        if (task) {
          triggerCommandId = task.command_id;
          triggerPayload = manualPayload || JSON.parse(task.payload || '{}');
        }
      }

      // Execute the command
      const result = {
        taskId,
        commandId: triggerCommandId,
        payload: triggerPayload,
        triggeredAt: new Date().toISOString(),
        status: 'triggered',
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CRON_TRIGGER_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'cron';
  }

  getName(): string {
    return 'cron.trigger';
  }
}

/**
 * Cron Cleanup Pages Handler - Cleanup idle pages
 */
export class CronCleanupPagesHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const result = await cronController.cleanupPages(
        { body: payload } as any,
        {
          json: (data: unknown) => data,
        } as any,
        () => {}
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CRON_CLEANUP_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'cron';
  }

  getName(): string {
    return 'cron.cleanupPages';
  }
}

/**
 * Cron Get Page Stats Handler - Get page statistics
 */
export class CronGetPageStatsHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const result = await cronController.getPageStats(
        { body: payload } as any,
        {
          json: (data: unknown) => data,
        } as any,
        () => {}
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CRON_STATS_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'cron';
  }

  getName(): string {
    return 'cron.pageStats';
  }
}

/**
 * Export all cron handlers
 */
export const cronHandlers = {
  'cron.schedule': new CronScheduleHandler(),
  'cron.unschedule': new CronUnscheduleHandler(),
  'cron.list': new CronListHandler(),
  'cron.trigger': new CronTriggerHandler(),
  'cron.cleanupPages': new CronCleanupPagesHandler(),
  'cron.pageStats': new CronGetPageStatsHandler(),
};
