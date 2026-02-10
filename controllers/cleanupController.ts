/**
 * Cleanup Controller - TypeScript migration
 */

import type { Request, Response, NextFunction } from 'express';
import StorageFactory from '../utils/storage/StorageFactory';
import { logErrorToDB } from '../utils/errorLogger';
import type { StorageAdapter, CleanupResult, StorageStats } from '../utils/storage/StorageAdapter';

/**
 * Cleanup old files
 * POST /cleanup?maxAge=24
 */
export const cleanup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storage = StorageFactory.createStorage() as StorageAdapter;
    const maxAge =
      parseInt(req.query.maxAge as string) || parseInt(process.env.CLEANUP_MAX_AGE_HOURS || '24');

    if (!storage.cleanup) {
      throw new Error('Cleanup not supported for this storage type');
    }

    const result = await storage.cleanup(maxAge);

    res.json({
      deleted: result.deleted,
      freedBytes: result.freedBytes,
      storageType: storage.getType(),
    });
  } catch (err) {
    const error = err as Error;
    console.error('[CleanupController] Cleanup error:', error);
    logErrorToDB({
      type: 'CLEANUP_FAILED',
      message: error.message,
      stack: error.stack,
      route: '/cleanup',
      input: req.query,
    });
    next(error);
  }
};

/**
 * Get cleanup stats
 * GET /cleanup/stats
 */
export const stats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storage = StorageFactory.createStorage() as StorageAdapter;

    const stats = await storage.getStats();

    res.json({
      fileCount: stats.fileCount,
      totalSizeBytes: stats.totalSizeBytes,
      storageType: storage.getType(),
    });
  } catch (err) {
    const error = err as Error;
    console.error('[CleanupController] Stats error:', error);
    logErrorToDB({
      type: 'STATS_FAILED',
      message: error.message,
      stack: error.stack,
      route: '/cleanup/stats',
      input: req.query,
    });
    next(error);
  }
};

export default { cleanup, stats };
