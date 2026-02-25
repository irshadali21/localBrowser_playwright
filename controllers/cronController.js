// controllers/cronController.js
const db = require('../utils/db');
const { getBrowserContext } = require('../utils/pageFactory');
const { getPageById } = require('../utils/pageManager');
const { logErrorToDB } = require('../utils/errorLogger');

/**
 * Cron endpoint to cleanup idle browser pages
 * Checks if there are more than 3 pages open
 * Closes pages that are idle (not being used)
 */
async function cleanupPages(req, res, next) {
  try {
    const context = await getBrowserContext();
    const browserPages = context.pages();
    const browserPageCount = browserPages.length;

    // Get active pages from database
    const activePagesInDB = db.prepare(
      'SELECT id, type, last_used FROM active_pages WHERE status = \'active\' ORDER BY last_used ASC'
    ).all();

    const result = {
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
      return res.json(result);
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
        db.prepare('UPDATE active_pages SET status = \'closed\' WHERE id = ?').run(dbPage.id);
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
        
        // Check if page has pending network activity (rough check)
        const hasActiveConnections = await browserPage.evaluate(() => {
          return performance.getEntriesByType('resource').some((r) => {
            return r.responseEnd === 0; // Response not completed yet
          });
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
          db.prepare('UPDATE active_pages SET status = \'closed\' WHERE id = ?').run(dbPage.id);
          result.closedPages.push({
            id: dbPage.id,
            type: dbPage.type,
            reason: 'idle',
            idleTimeMs: idleTime,
          });
        } catch (err) {
          logErrorToDB('CRON_CLEANUP_CLOSE_FAILED', err, '/cron/cleanup-pages', { pageId: dbPage.id });
          result.keptPages.push({
            id: dbPage.id,
            type: dbPage.type,
            reason: 'close_failed',
            error: err.message,
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

    if (result.action !== 'cleanup_completed') {
      result.action = 'cleanup_attempted';
    }
    result.finalPageCount = context.pages().length;
    res.json(result);
  } catch (err) {
    logErrorToDB('CRON_CLEANUP_FAILED', err, '/cron/cleanup-pages', {});
    next(err);
  }
}

/**
 * Health check endpoint to get current page statistics
 */
async function getPageStats(req, res, next) {
  try {
    const context = await getBrowserContext();
    const browserPages = context.pages();

    const activePagesInDB = db.prepare(
      'SELECT id, type, status, last_used, created_at FROM active_pages WHERE status = \'active\' ORDER BY last_used DESC'
    ).all();

    const now = Date.now();
    const pagesWithStats = activePagesInDB.map((p) => ({
      ...p,
      idleTimeMs: now - new Date(p.last_used).getTime(),
      ageMs: now - new Date(p.created_at).getTime(),
    }));

    res.json({
      totalBrowserPages: browserPages.length,
      activePagesInDB: activePagesInDB.length,
      pages: pagesWithStats,
      urls: browserPages.map((p) => p.url()),
    });
  } catch (err) {
    logErrorToDB('CRON_STATS_FAILED', err, '/cron/stats', {});
    next(err);
  }
}

module.exports = {
  cleanupPages,
  getPageStats,
};
