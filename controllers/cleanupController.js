// controllers/cleanupController.js
const StorageFactory = require('../utils/storage/StorageFactory');
const { logErrorToDB } = require('../utils/errorLogger');

// POST /cleanup?maxAge=24
exports.cleanup = async (req, res, next) => {
  try {
    const storage = StorageFactory.createStorage();
    const maxAge = parseInt(req.query.maxAge) || process.env.CLEANUP_MAX_AGE_HOURS || 24;
    
    const result = await storage.cleanup(maxAge);
    
    res.json({
      ...result,
      storageType: storage.getType()
    });
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
    const storage = StorageFactory.createStorage();
    const stats = await storage.getStats();
    
    res.json({
      ...stats,
      storageType: storage.getType()
    });
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
