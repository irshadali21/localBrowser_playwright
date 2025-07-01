// utils/logger.js
const fs = require('fs');
const path = require('path');

const logDir = path.resolve(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `log-${new Date().toISOString().split('T')[0]}.txt`);

function logger(message) {
  const timestamp = new Date().toISOString();
  const fullMsg = `[${timestamp}] ${message}\n`;
  fs.appendFile(logFile, fullMsg, err => {
    if (err) console.error('[logger] Failed to write log:', err.message);
  });
  console.log(fullMsg.trim());
}

module.exports = { logger };
