/**
 * Chat Controller - TypeScript migration
 */

import type { Request, Response, NextFunction } from 'express';
import { prepareChat, sendChat, closeChat, sendChatGPT } from '../helpers/chatManager';
import { logErrorToDB } from '../utils/errorLogger';

/**
 * Prepare Gemini session
 */
export const prepare = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await prepareChat();
    res.json(result);
  } catch (err) {
    const error = err as Error;
    console.error('[ChatController] Prepare error:', error);
    logErrorToDB({
      type: 'CHAT_PREPARE_FAILED',
      message: error.message,
      stack: error.stack,
      route: '/chat/prepare',
      input: req.body
    });
    next(error);
  }
};

/**
 * Send message to Gemini
 */
export const message = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reply = await sendChat(req.body.prompt);
    res.json({ reply });
  } catch (err) {
    const error = err as Error;
    console.error('[ChatController] Message error:', error);
    logErrorToDB({
      type: 'CHAT_SEND_FAILED',
      message: error.message,
      stack: error.stack,
      route: '/chat/message',
      input: req.body
    });
    next(error);
  }
};

/**
 * Send message to ChatGPT
 */
export const messageGPT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reply = await sendChatGPT(req.body.prompt);
    res.json({ reply });
  } catch (err) {
    const error = err as Error;
    console.error('[ChatGPTController] Message error:', error);
    logErrorToDB({
      type: 'CHATGPT_SEND_FAILED',
      message: error.message,
      stack: error.stack,
      route: '/chatgpt/message',
      input: req.body
    });
    next(error);
  }
};

export default { prepare, message, messageGPT };
