// controllers/cleanupController.js
const StorageFactory = require('../utils/storage/StorageFactory');
const { logErrorToDB } = require('../utils/errorLogger');

// Helper for consistent error handling
const withErrorHandler = (route, type) => (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error(`[CleanupController] ${type.toLowerCase().replace('_', ' ')} error:`, err);
    logErrorToDB({ type, message: err.message, stack: err.stack, route, input: req.query || req.body });
    next(err);
  }
};

// POST /cleanup?maxAge=24
exports.cleanup = withErrorHandler('/cleanup', 'CLEANUP_FAILED')(async (req, res) => {
  const storage = StorageFactory.createStorage();
  const parsedMaxAge = Number(req.query.maxAge);
  const parsedEnvMaxAge = Number(process.env.CLEANUP_MAX_AGE_HOURS);
  const maxAge = isNaN(parsedMaxAge) && isNaN(parsedEnvMaxAge) ? 24 : (isNaN(parsedMaxAge) ? parsedEnvMaxAge : parsedMaxAge);
  const result = await storage.cleanup(maxAge);
  res.json({ ...result, storageType: storage.getType() });
});

// GET /cleanup/stats
exports.stats = withErrorHandler('/cleanup/stats', 'STATS_FAILED')(async (req, res) => {
  const storage = StorageFactory.createStorage();
  const stats = await storage.getStats();
  res.json({ ...stats, storageType: storage.getType() });
});
