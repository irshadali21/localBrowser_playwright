// routes/iaapaRoutes.js
const express = require('express');
const router = express.Router();
const c = require('../controllers/iaapaController');

// purely background workflow
router.get('/run-all', c.runAll);
router.get('/status', c.status);
router.get('/download-csv', c.downloadCsv);

module.exports = router;
