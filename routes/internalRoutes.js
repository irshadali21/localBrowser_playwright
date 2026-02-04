// routes/internalRoutes.js
const express = require('express');
const router = express.Router();
const InternalController = require('../controllers/internalController');
const hmacSignature = require('../middleware/hmacSignature');

// Instantiate controller
const internalController = new InternalController();

// All routes require HMAC signature verification
router.use(hmacSignature);

// POST /internal/ping
// Laravel notifies Node that work is available
router.post('/ping', internalController.ping);

// POST /internal/request-work
// Node requests available tasks
router.post('/request-work', internalController.requestWork);

// POST /internal/task-result
// Node submits task result
router.post('/task-result', internalController.submitResult);

module.exports = router;
