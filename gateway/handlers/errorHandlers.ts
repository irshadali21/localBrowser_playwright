/**
 * Error Command Handlers
 * Command handlers for error handling operations
 */

import { BaseCommandHandler, HandlerResult, AuditContext } from './baseCommandHandler';
import errorController from '../../controllers/errorController';
import { logErrorToDB } from '../../utils/errorLogger';

/**
 * Error Report Handler - Report an error
 */
export class ErrorReportHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.type || typeof payload.type !== 'string') {
      errors.push('type is required');
    }

    if (!payload.message || typeof payload.message !== 'string') {
      errors.push('message is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      await errorController.reportError(
        { body: _payload } as any,
        {
          json: (data: unknown) => data,
        } as any
      );

      return {
        success: true,
        data: {
          status: 'logged_and_forwarded',
          type: _payload.type,
          message: _payload.message,
          reportedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'ERROR_REPORT_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'error';
  }

  getName(): string {
    return 'error.report';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'write';
  }
}

/**
 * Error Status Handler - Get error status
 */
export class ErrorStatusHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const errorId = payload.errorId as string | undefined;

      // Query error logs from database
      const db = await import('../../utils/db');

      if (errorId) {
        const errorLog = db.default
          ?.prepare?.('SELECT * FROM error_logs WHERE id = ?')
          ?.get(errorId) as Record<string, unknown> | undefined;

        if (!errorLog) {
          return {
            success: false,
            error: 'Error not found',
            code: 'ERROR_NOT_FOUND',
          };
        }

        return {
          success: true,
          data: {
            errorId: errorLog.id,
            type: errorLog.type,
            message: errorLog.message,
            status: errorLog.resolved ? 'resolved' : 'unresolved',
            resolvedAt: errorLog.resolved_at,
            createdAt: errorLog.created_at,
          },
        };
      }

      // Return overall error status
      const unresolvedCount = db.default
        ?.prepare?.('SELECT COUNT(*) as count FROM error_logs WHERE resolved = 0')
        ?.get() as { count: number } | undefined;
      const recentErrors =
        (db.default
          ?.prepare?.(
            `
        SELECT * FROM error_logs 
        ORDER BY created_at DESC 
        LIMIT 10
      `
          )
          ?.all() as
          | Array<{ id: string; type: string; message: string; created_at: string }>
          | undefined) || [];

      return {
        success: true,
        data: {
          unresolvedErrors: unresolvedCount?.count || 0,
          recentErrors: recentErrors.map(e => ({
            errorId: e.id,
            type: e.type,
            message: e.message,
            createdAt: e.created_at,
          })),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'ERROR_STATUS_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'error';
  }

  getName(): string {
    return 'error.status';
  }
}

/**
 * Error History Handler - Get error history
 */
export class ErrorHistoryHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const options = payload.options as Record<string, unknown> | undefined;
      const limit = (options?.limit as number) || 100;
      const offset = (options?.offset as number) || 0;
      const typeFilter = options?.type as string | undefined;

      // Query error logs from database
      const db = await import('../../utils/db');

      let query = 'SELECT * FROM error_logs';
      const params: string[] = [];

      if (typeFilter) {
        query += ' WHERE type = ?';
        params.push(typeFilter);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit.toString(), offset.toString());

      const errors =
        (db.default?.prepare?.(query)?.all(...params) as
          | Array<{
              id: string;
              type: string;
              message: string;
              stack: string;
              route: string;
              created_at: string;
            }>
          | undefined) || [];

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM error_logs';
      if (typeFilter) {
        countQuery += ' WHERE type = ?';
      }
      const countResult = db.default?.prepare?.(countQuery)?.get(typeFilter) as
        | { total: number }
        | undefined;
      const total = countResult?.total || 0;

      return {
        success: true,
        data: {
          errors: errors.map(e => ({
            errorId: e.id,
            type: e.type,
            message: e.message,
            stack: e.stack,
            route: e.route,
            createdAt: e.created_at,
          })),
          total,
          limit,
          offset,
          typeFilter,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'ERROR_HISTORY_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'error';
  }

  getName(): string {
    return 'error.history';
  }
}

/**
 * Error Resolve Handler - Resolve an error
 */
export class ErrorResolveHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.errorId || typeof payload.errorId !== 'string') {
      errors.push('errorId is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const errorId = _payload.errorId as string;
      const resolution = _payload.resolution as string | undefined;
      const resolvedBy = _payload.resolvedBy as string | undefined;

      // Update error log
      const db = await import('../../utils/db');
      db.default
        ?.prepare?.(
          `
        UPDATE error_logs 
        SET resolved = 1, 
            resolved_at = datetime('now'),
            resolution = ?,
            resolved_by = ?
        WHERE id = ?
      `
        )
        ?.run(resolution || '', resolvedBy || 'system', errorId);

      return {
        success: true,
        data: {
          errorId,
          status: 'resolved',
          resolution,
          resolvedBy,
          resolvedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'ERROR_RESOLVE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'error';
  }

  getName(): string {
    return 'error.resolve';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'write';
  }
}

/**
 * Error Log Handler - Log error directly
 */
export class ErrorLogHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.message || typeof payload.message !== 'string') {
      errors.push('message is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      await logErrorToDB({
        type: (_payload.type as string) || 'GATEWAY_ERROR',
        message: _payload.message as string,
        stack: _payload.stack as string | undefined,
        route: _payload.route as string | undefined,
        input: _payload.input as unknown,
      });

      return {
        success: true,
        data: {
          status: 'logged',
          message: _payload.message,
          type: _payload.type || 'GATEWAY_ERROR',
          loggedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'ERROR_LOG_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'error';
  }

  getName(): string {
    return 'error.log';
  }
}

/**
 * Export all error handlers
 */
export const errorHandlers = {
  'error.report': new ErrorReportHandler(),
  'error.status': new ErrorStatusHandler(),
  'error.history': new ErrorHistoryHandler(),
  'error.resolve': new ErrorResolveHandler(),
  'error.log': new ErrorLogHandler(),
};
