/**
 * Cron Controller - TypeScript migration
 */

import type { Request, Response, NextFunction } from 'express';
import db from '../utils/db';
import { getBrowserContext } from '../utils/pageFactory';
import { getPageById } from '../utils/pageManager';
import { logErrorToDB } from '../utils/errorLogger';

/**
 * Cleanup result interface
 */
interface CleanupResult {
  totalPages: number;
  activePagesInDB: number;
  threshold: number;
  action: string;
  closedPages: Array<{
    id: string | number;
    type: string;
    reason: string;
    idleTimeMs?: number;
  }>;
  keptPages: Array<{
    id: string | number;
    type: string;
    reason: string;
    idleTimeMs?: number;
    error?: string;
  }>;
  message?: string;
  finalPageCount?: number;
}

/**
 * Page stats interface
 */
interface PageStats {
  totalBrowserPages: number;
  activePagesInDB: number;
  pages: Array<{
    id: string | number;
    type: string;
    status: string;
    last_used: string;
    created_at: string;
    idleTimeMs: number;
    ageMs: number;
  }>;
  urls: string[];
}

/**
 * Cron endpoint to cleanup idle browser pages
 * Checks if there are more than 3 pages open
 * Closes pages that are idle (not being used)
 */
export const cleanupPages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = await getBrowserContext();
    const browserPages = context.pages();
    const browserPageCount = browserPages.length;

    // Get active pages from database
    const activePagesInDB = db.prepare(
      "SELECT id, type, last_used FROM active_pages WHERE status = 'active' ORDER BY last_used ASC"
    ).all() as Array<{ id: number; type: string; last_used: string }>;

    const result: CleanupResult = {
      totalPages: browserPageCount,
      activePagesInDB: activePagesInDB.length,
      threshold: 3,
      action: 'none',
      closedPages: [],
      keptPages: [],
    };

    // Only proceed if there are more than 3 pages
    if (browserPageCount <= 3) {
      result.action = 'none';
      result.message = `Only ${browserPageCount} pages open, no cleanup needed`;
      res.json(result);
      return;
    }

    // Check each page to see if it's idle
    const now = Date.now();
    const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

    for (const dbPage of activePagesInDB) {
      const lastUsed = new Date(dbPage.last_used).getTime();
      const idleTime = now - lastUsed;

      // Get the actual browser page by DB ID
      const browserPage = getPageById(dbPage.id);

      if (!browserPage || browserPage.isClosed?.()) {
        // Page already closed, update DB
        db.prepare("UPDATE active_pages SET status = 'closed' WHERE id = ?").run(dbPage.id);
        result.closedPages.push({
          id: dbPage.id,
          type: dbPage.type,
          reason: 'already_closed',
        });
        continue;
      }

      // Check if page is busy (navigating or has pending requests)
      let isBusy = false;
      try {
        // Check if page is currently navigating
        const isLoading = await browserPage.evaluate(() => document.readyState !== 'complete');
        
        // Check if page has pending network activity (Rough check)
        const hasActiveConnections = await browserPage.evaluate(() => {
          const entries = performance.getEntriesByType('resource');
          return entries.some((r) => (r as PerformanceResourceTiming).responseEnd === 0);
        });

        isBusy = isLoading || hasActiveConnections;
      } catch (err) {
        // Page might be closed or in error state
        isBusy = false;
      }

      // Decide whether to close the page
      if (isBusy) {
        result.keptPages.push({
          id: dbPage.id,
          type: dbPage.type,
          reason: 'busy',
          idleTimeMs: idleTime,
        });
      } else if (idleTime < IDLE_THRESHOLD_MS) {
        result.keptPages.push({
          id: dbPage.id,
          type: dbPage.type,
          reason: 'recently_used',
          idleTimeMs: idleTime,
        });
      } else {
        // Close idle page
        try {
          await browserPage.close();
          db.prepare("UPDATE active_pages SET status = 'closed' WHERE id = ?").run(dbPage.id);
          result.closedPages.push({
            id: dbPage.id,
            type: dbPage.type,
            reason: 'idle',
            idleTimeMs: idleTime,
          });
        } catch (err) {
          logErrorToDB({
            type: 'CRON_CLEANUP_CLOSE_FAILED',
            message: (err as Error).message,
            stack: (err as Error).stack,
            route: '/cron/cleanup-pages',
            input: { pageId: dbPage.id }
          });
          result.keptPages.push({
            id: dbPage.id,
            type: dbPage.type,
            reason: 'close_failed',
            idleTimeMs: idleTime,
            error: (err as Error).message,
          });
        }
      }

      // Stop closing if we're back to 3 or fewer pages
      const remainingPages = context.pages().length;
      if (remainingPages <= 3) {
        result.action = 'cleanup_completed';
        result.message = `Cleaned up to ${remainingPages} pages`;
        break;
      }
    }

    result.action = 'cleanup_attempted';
    result.finalPageCount = context.pages().length;
    res.json(result);
  } catch (err) {
    logErrorToDB({
      type: 'CRON_CLEANUP_FAILED',
      message: (err as Error).message,
      stack: (err as Error).stack,
      route: '/cron/cleanup-pages',
      input: {}
    });
    next(err);
  }
};

/**
 * Health check endpoint to get current page statistics
 */
export const getPageStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = await getBrowserContext();
    const browserPages = context.pages();

    const activePagesInDB = db.prepare(
      "SELECT id, type, status, last_used, created_at FROM active_pages WHERE status = 'active' ORDER BY last_used DESC"
    ).all() as Array<{ id: number; type: string; status: string; last_used: string; created_at: string }>;

    const now = Date.now();
    const pagesWithStats = activePagesInDB.map((p) => ({
      ...p,
      idleTimeMs: now - new Date(p.last_used).getTime(),
      ageMs: now - new Date(p.created_at).getTime(),
    }));

    const result: PageStats = {
      totalBrowserPages: browserPages.length,
      activePagesInDB: activePagesInDB.length,
      pages: pagesWithStats,
      urls: browserPages.map((p) => p.url()),
    };

    res.json(result);
  } catch (err) {
    logErrorToDB({
      type: 'CRON_STATS_FAILED',
      message: (err as Error).message,
      stack: (err as Error).stack,
      route: '/cron/stats',
      input: {}
    });
    next(err);
  }
};

export default { cleanupPages, getPageStats };
