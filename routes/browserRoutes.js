// routes/browserRoutes.js
const express = require('express');
const router = express.Router();
const browserController = require('../controllers/browserController');

// POST /browser/execute
router.post('/execute', browserController.execute);

// GET /browser/search?q=...
router.get('/search', browserController.search);

// GET /browser/visit?url=...
router.get('/visit', browserController.visit);

// GET /browser/scrape?url=...&vendor=...
router.get('/scrape', browserController.scrape);

module.exports = router;
