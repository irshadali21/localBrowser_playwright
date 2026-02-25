// utils/logger.js
// Structured logging with pino - production-ready logging

const pino = require('pino');
const path = require('path');

const logPath = path.join(__dirname, '../logs/app.log');

// Ensure logs directory exists
const fs = require('fs');
const logsDir = path.dirname(logPath);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino/file',
    options: { destination: 1 } // stdout in dev
  } : {
    target: 'pino/file',
    options: { destination: logPath }
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Create child loggers for different modules
const createLogger = (moduleName) => logger.child({ module: moduleName });

module.exports = { logger, createLogger };
