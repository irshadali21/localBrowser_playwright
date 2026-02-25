const db = require('./db');
const axios = require('axios');

async function logErrorToDB({ type, message, stack, route, input }) {
  try {
    // 1. Save to SQLite
    db.prepare(`
      INSERT INTO error_logs (type, message, stack, route, input)
      VALUES (?, ?, ?, ?, ?)
    `).run(type, message, stack, route, JSON.stringify(input || {}));

    // 2. Send WhatsApp alert
    await axios.post(process.env.WHATSAPP_API, null, {
      params: {
        appkey: process.env.WHATSAPP_APPKEY,
        authkey: process.env.WHATSAPP_AUTHKEY,
        to: process.env.WHATSAPP_TO,
        message: `type: [${type}] , message: ${message}, stack: ${stack}, route: ${route}`
      }
    });
  } catch (e) {
    console.error('[logError] Failed:', e.message);
  }
}

module.exports = { logErrorToDB };
