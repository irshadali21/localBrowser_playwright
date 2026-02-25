// bootstrap/app.js
// Application bootstrap - separates HTTP layer from worker lifecycle

const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const errorHandler = require('../middleware/errorHandler');
const internalRoutes = require('../routes/internalRoutes');

function createApp() {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/', (req, res) => res.json({ status: 'LocalBrowser API (Playwright) is running' }));

  // Internal API Routes (HMAC-secured)
  app.use('/internal', internalRoutes);
  app.use('/iaapa', require('../routes/iaapaRoutes'));

  // API Key Auth Middleware
  app.use((req, res, next) => {
    // First check if API_KEY is configured - fail closed if not set
    if (!process.env.API_KEY) {
      return res.status(500).json({ error: 'Internal Server Error - API_KEY not configured' });
    }
    // Require x-api-key header and validate it exactly equals process.env.API_KEY
    if (req.headers['x-api-key'] !== process.env.API_KEY) {
      return res.status(401).json({ error: 'Unauthorized - Invalid API Key' });
    }
    next();
  });

  // Public Routes
  app.use('/chat', require('../routes/chatRoutes'));
  app.use('/api/v1/browser', require('../routes/browserRoutes'));
  app.use('/error', require('../routes/errorRoutes'));
  app.use('/pages', require('../routes/pageRoutes'));
  app.use('/jobs', require('../routes/jobRoutes'));
  app.use('/cron', require('../routes/cronRoutes'));
  app.use('/cleanup', require('../routes/cleanupRoutes'));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
