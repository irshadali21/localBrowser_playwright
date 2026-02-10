/**
 * Error Controller - TypeScript migration
 */

import type { Request, Response } from 'express';
import { logErrorToDB } from '../utils/errorLogger';
import axios from 'axios';

/**
 * Error report payload
 */
interface ErrorReportPayload {
  type: string;
  message: string;
  stack?: string;
  route?: string;
  input?: unknown;
}

/**
 * Report and forward error
 */
export const reportError = async (req: Request<{}, {}, ErrorReportPayload>, res: Response): Promise<void> => {
  const { type, message, stack, route, input } = req.body;

  logErrorToDB({ type, message, stack, route, input });

  try {
    await axios.post(process.env.WHATSAPP_API || '', null, {
      params: {
        appkey: process.env.WHATSAPP_APPKEY,
        authkey: process.env.WHATSAPP_AUTHKEY,
        to: process.env.WHATSAPP_TO,
        message: `[${type}] ${message}`
      }
    });
  } catch (err) {
    console.error('WhatsApp forward failed:', (err as Error).message);
  }

  res.json({ status: 'logged_and_forwarded' });
};

export default { reportError };
