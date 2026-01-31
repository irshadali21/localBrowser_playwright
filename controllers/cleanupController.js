// controllers/cleanupController.js
const { cleanupOldFiles, getStorageStats } = require('../utils/fileCleanup');
const { logErrorToDB } = require('../utils/errorLogger');

// POST /cleanup?maxAge=24
exports.cleanup = async (req, res, next) => {
  try {
    const maxAge = parseInt(req.query.maxAge) || 24;
    const result = cleanupOldFiles(maxAge);
    res.json(result);
  } catch (err) {
    console.error('[CleanupController] Cleanup error:', err);
    logErrorToDB({
      type: 'CLEANUP_FAILED',
      message: err.message,
      stack: err.stack,
      route: '/cleanup',
      input: req.query
    });
    next(err);
  }
};

// GET /cleanup/stats
exports.stats = async (req, res, next) => {
  try {
    const stats = getStorageStats();
    res.json(stats);
  } catch (err) {
    console.error('[CleanupController] Stats error:', err);
    logErrorToDB({
      type: 'STATS_FAILED',
      message: err.message,
      stack: err.stack,
      route: '/cleanup/stats',
      input: req.query
    });
    next(err);
  }
};
