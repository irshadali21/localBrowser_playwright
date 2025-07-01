const { logErrorToDB } = require('../utils/errorLogger');
const axios = require('axios');

exports.reportError = async (req, res) => {
  const { type, message, stack, route, input } = req.body;

  logErrorToDB({ type, message, stack, route, input });

  try {
    await axios.post(process.env.WHATSAPP_API, null, {
      params: {
        appkey: process.env.WHATSAPP_APPKEY,
        authkey: process.env.WHATSAPP_AUTHKEY,
        to: process.env.WHATSAPP_TO,
        message: `[${type}] ${message}`
      }
    });
  } catch (err) {
    console.error('❌ WhatsApp forward failed:', err.message);
  }

  res.json({ status: 'logged_and_forwarded' });
};
