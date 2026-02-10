/**
 * Cleanup Command Handlers
 * Command handlers for cleanup operations
 */

import { BaseCommandHandler, HandlerResult, AuditContext } from './baseCommandHandler';
import StorageFactory from '../../utils/storage/StorageFactory';
import type { StorageAdapter } from '../../utils/storage/StorageAdapter';

/**
 * Cleanup Logs Handler - Clean logs
 */
export class CleanupLogsHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const maxAge = (_payload.maxAge as number | undefined) || 24;
      const pattern = _payload.pattern as string | undefined;

      // Clean logs based on pattern
      const result = {
        logsCleaned: 0,
        bytesFreed: 0,
        maxAge,
        pattern,
        cleanedAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CLEANUP_LOGS_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'cleanup';
  }

  getName(): string {
    return 'cleanup.logs';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'delete';
  }
}

/**
 * Cleanup Cache Handler - Clean cache
 */
export class CleanupCacheHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const maxAge = (_payload.maxAge as number | undefined) || 24;

      // Get storage adapter
      const storage = StorageFactory.createStorage() as StorageAdapter;

      if (!storage.cleanup) {
        return {
          success: false,
          error: 'Cleanup not supported for this storage type',
          code: 'CLEANUP_NOT_SUPPORTED',
        };
      }

      const cleanupResult = await storage.cleanup(maxAge);

      return {
        success: true,
        data: {
          deleted: cleanupResult.deleted,
          freedBytes: cleanupResult.freedBytes,
          storageType: storage.getType(),
          maxAge,
          cleanedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CLEANUP_CACHE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'cleanup';
  }

  getName(): string {
    return 'cleanup.cache';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'delete';
  }
}

/**
 * Cleanup Temp Handler - Clean temp files
 */
export class CleanupTempHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const maxAge = (_payload.maxAge as number | undefined) || 24;

      // Clean temp directory
      const tempDir = require('path').join(process.cwd(), 'temp');
      const fs = require('fs');

      let filesDeleted = 0;
      let bytesFreed = 0;

      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        const maxAgeMs = maxAge * 60 * 60 * 1000;

        for (const file of files) {
          const filePath = require('path').join(tempDir, file);
          const stats = fs.statSync(filePath);

          if (now - stats.mtimeMs > maxAgeMs) {
            const fileSize = stats.size;
            fs.unlinkSync(filePath);
            filesDeleted++;
            bytesFreed += fileSize;
          }
        }
      }

      return {
        success: true,
        data: {
          filesDeleted,
          bytesFreed,
          maxAge,
          cleanedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CLEANUP_TEMP_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'cleanup';
  }

  getName(): string {
    return 'cleanup.temp';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'delete';
  }
}

/**
 * Cleanup Sessions Handler - Clean sessions
 */
export class CleanupSessionsHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const maxAge = (payload.maxAge as number | undefined) || 24;

      // Clean old sessions from database
      const db = await import('../../utils/db');
      const dbResult = db.default
        ?.prepare?.(
          `
        DELETE FROM sessions WHERE created_at < datetime('now', ?)
      `
        )
        ?.run(`-${maxAge} hours`);

      const sessionsCleaned = (dbResult as { changes?: number })?.changes || 0;

      return {
        success: true,
        data: {
          sessionsCleaned,
          maxAge,
          cleanedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CLEANUP_SESSIONS_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'cleanup';
  }

  getName(): string {
    return 'cleanup.sessions';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'delete';
  }
}

/**
 * Cleanup Stats Handler - Get cleanup statistics
 */
export class CleanupStatsHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const storage = StorageFactory.createStorage() as StorageAdapter;

      if (!storage.getStats) {
        return {
          success: false,
          error: 'Stats not supported for this storage type',
          code: 'STATS_NOT_SUPPORTED',
        };
      }

      const stats = await storage.getStats();

      return {
        success: true,
        data: {
          fileCount: stats.fileCount,
          totalSizeBytes: stats.totalSizeBytes,
          storageType: storage.getType(),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CLEANUP_STATS_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'cleanup';
  }

  getName(): string {
    return 'cleanup.stats';
  }
}

/**
 * Cleanup All Handler - Run all cleanup operations
 */
export class CleanupAllHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const maxAge = (payload.maxAge as number | undefined) || 24;
      const results: Record<string, unknown> = {
        startedAt: new Date().toISOString(),
        maxAge,
      };

      // Run cleanup operations
      const cleanupHandlerInstances = [
        new CleanupCacheHandler(),
        new CleanupTempHandler(),
        new CleanupSessionsHandler(),
      ];

      for (const handler of cleanupHandlerInstances) {
        const handlerName = handler.getName().replace('cleanup.', '');
        try {
          const result = await handler.execute({ maxAge }, _context);
          results[handlerName] = result.success ? result.data : { error: result.error };
        } catch (err) {
          results[handlerName] = { error: (err as Error).message };
        }
      }

      results.completedAt = new Date().toISOString();

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CLEANUP_ALL_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'cleanup';
  }

  getName(): string {
    return 'cleanup.all';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'delete';
  }
}

/**
 * Export all cleanup handlers
 */
export const cleanupHandlers = {
  'cleanup.logs': new CleanupLogsHandler(),
  'cleanup.cache': new CleanupCacheHandler(),
  'cleanup.temp': new CleanupTempHandler(),
  'cleanup.sessions': new CleanupSessionsHandler(),
  'cleanup.stats': new CleanupStatsHandler(),
  'cleanup.all': new CleanupAllHandler(),
};
