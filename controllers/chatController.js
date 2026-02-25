// controllers/chatController.js
const { prepareChat, sendChat, sendChatGPT } = require('../helpers/chatManager');
const { logErrorToDB } = require('../utils/errorLogger');

// Helper for consistent error handling
const withErrorHandler = (controllerName, route, type) => (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error(`[${controllerName}] ${type.toLowerCase().replace('_', ' ')} error:`, err);
    logErrorToDB({ type, message: err.message, stack: err.stack, route, input: req.body });
    next(err);
  }
};

// Prepare Gemini session
exports.prepare = withErrorHandler('ChatController', '/chat/prepare', 'CHAT_PREPARE_FAILED')(async (req, res) => {
  const result = await prepareChat();
  res.json(result);
});

// Send message to Gemini
exports.message = withErrorHandler('ChatController', '/chat/message', 'CHAT_SEND_FAILED')(async (req, res) => {
  const reply = await sendChat(req.body.prompt);
  res.json({ reply });
});

// Send message to ChatGPT
exports.messageGPT = withErrorHandler('ChatGPTController', '/chatgpt/message', 'CHATGPT_SEND_FAILED')(async (req, res) => {
  const reply = await sendChatGPT(req.body.prompt);
  res.json({ reply });
});
