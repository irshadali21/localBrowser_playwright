// routes/cleanupRoutes.js
const express = require('express');
const router = express.Router();
const cleanupController = require('../controllers/cleanupController');

// POST /cleanup?maxAge=24
router.post('/', cleanupController.cleanup);

// GET /cleanup/stats
router.get('/stats', cleanupController.stats);

module.exports = router;
