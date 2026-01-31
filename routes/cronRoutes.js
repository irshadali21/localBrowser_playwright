// routes/cronRoutes.js
const express = require('express');
const router = express.Router();
const { cleanupPages, getPageStats } = require('../controllers/cronController');

// POST /cron/cleanup-pages - Main cleanup endpoint
router.post('/cleanup-pages', cleanupPages);

// GET /cron/stats - Get current page statistics
router.get('/stats', getPageStats);

module.exports = router;
