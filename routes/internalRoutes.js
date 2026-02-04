// routes/internalRoutes.js
const express = require('express');
const router = express.Router();
const InternalController = require('../controllers/internalController');
const TaskExecutor = require('../services/taskExecutor');
const ResultSubmitter = require('../services/resultSubmitter');
const { getConfiguredPage } = require('../utils/pageFactory');
const hmacSignature = require('../middleware/hmacSignature');

// Create a simple browser helper that TaskExecutor expects
const browserHelper = {
  launchBrowser: async () => {
    // Return an object that mimics a browser with newPage() method
    const page = await getConfiguredPage();
    return {
      newPage: async () => page,
      close: async () => {
        // Pages are managed by pageManager, so we don't close them here
        // Just ensure cleanup happens through the page's own cleanup
      }
    };
  }
};

// Initialize dependencies
const taskExecutor = new TaskExecutor(browserHelper);
const resultSubmitter = new ResultSubmitter({
  laravelUrl: process.env.LARAVEL_INTERNAL_URL,
  secret: process.env.LOCALBROWSER_SECRET,
});

// Instantiate controller with dependencies
const internalController = new InternalController({
  taskExecutor,
  resultSubmitter,
  logger: console,
});

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
