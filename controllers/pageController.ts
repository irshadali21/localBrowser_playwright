/**
 * Page Controller - TypeScript migration
 */

import type { Request, Response, NextFunction } from 'express';
import { listPages, requestPage, closeChat } from '../utils/pageManager';
import type { SessionType } from '../types/browser';

/**
 * List all active pages
 */
export const list = (req: Request, res: Response): void => {
  const pages = listPages();
  res.json({ pages });
};

/**
 * Request a new page
 */
export const request = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const type = req.query.type as SessionType;
  if (!type) {
    res.status(400).json({ error: 'type query required' });
    return;
  }
  try {
    const { id } = await requestPage(type);
    res.json({ pageId: id });
  } catch (err) {
    next(err);
  }
};

/**
 * Close pages/chat
 */
export const close = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await closeChat();
    res.json({ status: 'pages closed' });
  } catch (err) {
    console.error('[ChatController] Close error:', err);
    next(err);
  }
};

export default { list, request, close };
