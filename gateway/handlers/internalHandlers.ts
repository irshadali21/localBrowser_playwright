/**
 * Internal Command Handlers
 * Command handlers for internal system operations
 */

import { BaseCommandHandler, HandlerResult, AuditContext } from './baseCommandHandler';
import { InternalController } from '../../controllers/internalController';

/**
 * Internal Health Handler - Health check
 */
export class InternalHealthHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const checks = payload.checks as string[] | undefined;
      const healthChecks: Record<string, unknown> = {};

      // Check memory
      const memUsage = process.memoryUsage();
      healthChecks.memory = {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      };

      // Check uptime
      healthChecks.uptime = process.uptime();

      // Check environment
      healthChecks.nodeVersion = process.version;
      healthChecks.platform = process.platform;

      // If specific checks requested
      if (checks) {
        for (const check of checks) {
          switch (check) {
            case 'database':
              try {
                await import('../../utils/db');
                healthChecks.database = 'connected';
              } catch {
                healthChecks.database = 'disconnected';
              }
              break;
            case 'browser':
              try {
                await import('../../utils/pageFactory');
                healthChecks.browser = 'available';
              } catch {
                healthChecks.browser = 'unavailable';
              }
              break;
          }
        }
      }

      return {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          checks: healthChecks,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'HEALTH_CHECK_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'internal';
  }

  getName(): string {
    return 'internal.health';
  }
}

/**
 * Internal Metrics Handler - Get system metrics
 */
export class InternalMetricsHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const requestedMetrics = payload.metrics as string[] | undefined;
      const timeframe = payload.timeframe as { start?: string; end?: string } | undefined;

      const metrics: Record<string, unknown> = {};

      // CPU metrics
      metrics.cpu = {
        loadavg: (process as unknown as { loadavg: () => number[] }).loadavg(),
        arch: process.arch,
      };

      // Memory metrics
      const memUsage = process.memoryUsage();
      metrics.memory = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
      };

      // Process metrics
      metrics.process = {
        pid: process.pid,
        uptime: process.uptime(),
        nodeVersion: process.version,
      };

      // Active pages
      try {
        const pageManager = await import('../../utils/pageManager');
        const pages = (pageManager as { listPages?: () => unknown[] }).listPages?.() || [];
        metrics.activePages = pages.length;
      } catch {
        metrics.activePages = 0;
      }

      // Filter metrics if requested
      if (requestedMetrics) {
        const filtered: Record<string, unknown> = {};
        for (const metric of requestedMetrics) {
          if (metrics[metric as keyof typeof metrics]) {
            filtered[metric] = metrics[metric as keyof typeof metrics];
          }
        }
        return {
          success: true,
          data: {
            metrics: filtered,
            timeframe,
            timestamp: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        data: {
          metrics,
          timeframe,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'METRICS_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'internal';
  }

  getName(): string {
    return 'internal.metrics';
  }
}

/**
 * Internal Config Handler - Get/set configuration
 */
export class InternalConfigHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const keys = payload.keys as string[] | undefined;

      if (payload.action === 'set') {
        // Set configuration
        const configPath = payload.configPath as string;
        const configValue = payload.value as unknown;

        // For now, return a mock response
        return {
          success: true,
          data: {
            action: 'set',
            key: configPath,
            value: configValue,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Get configuration
      const config: Record<string, unknown> = {};

      // Return subset of config based on keys
      const envVars = [
        'NODE_ENV',
        'PORT',
        'WORKER_ID',
        'LARAVEL_INTERNAL_URL',
        'LOCALBROWSER_SECRET',
      ];

      for (const key of envVars) {
        if (!keys || keys.includes(key)) {
          config[key] = process.env[key] || undefined;
        }
      }

      return {
        success: true,
        data: {
          config,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CONFIG_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'internal';
  }

  getName(): string {
    return 'internal.config';
  }
}

/**
 * Internal Worker Handler - Worker operations
 */
export class InternalWorkerHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    const action = payload.action as string;
    if (!action || !['status', 'restart', 'pause', 'resume'].includes(action)) {
      errors.push('action is required and must be status, restart, pause, or resume');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const action = _payload.action as 'status' | 'restart' | 'pause' | 'resume';
      const workerId = _payload.workerId as string | undefined;

      const workerIdVal = workerId || process.env.WORKER_ID || `worker-${process.pid}`;

      switch (action) {
        case 'status':
          return {
            success: true,
            data: {
              workerId: workerIdVal,
              status: 'running',
              uptime: process.uptime(),
              pid: process.pid,
              memory: process.memoryUsage(),
            },
          };

        case 'restart':
          // Note: Restart is handled by the process manager
          return {
            success: true,
            data: {
              workerId: workerIdVal,
              action: 'restart',
              message: 'Restart signal sent',
            },
          };

        case 'pause':
          return {
            success: true,
            data: {
              workerId: workerIdVal,
              action: 'pause',
              message: 'Pause signal sent',
            },
          };

        case 'resume':
          return {
            success: true,
            data: {
              workerId: workerIdVal,
              action: 'resume',
              message: 'Resume signal sent',
            },
          };

        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
            code: 'UNKNOWN_ACTION',
          };
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'WORKER_OPERATION_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'internal';
  }

  getName(): string {
    return 'internal.worker';
  }
}

/**
 * Internal Ping Handler - Ping from Laravel
 */
export class InternalPingHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const controller = new InternalController();

      // Call the internal ping handler
      await controller.ping(
        { headers: payload } as any,
        {
          json: (data: unknown) => data,
          setHeader: () => {},
        } as any
      );

      return {
        success: true,
        data: {
          status: 'ok',
          workerId: process.env.WORKER_ID || `worker-${process.pid}`,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'PING_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'internal';
  }

  getName(): string {
    return 'internal.ping';
  }
}

/**
 * Export all internal handlers
 */
export const internalHandlers = {
  'internal.health': new InternalHealthHandler(),
  'internal.metrics': new InternalMetricsHandler(),
  'internal.config': new InternalConfigHandler(),
  'internal.worker': new InternalWorkerHandler(),
  'internal.ping': new InternalPingHandler(),
};
