/**
 * Error Logger - Error logging to database and WhatsApp alerts
 */

import axios from 'axios';
import db from './db';

/**
 * Error log input structure
 */
export interface ErrorLogInput {
  type: string;
  message: string;
  stack?: string;
  route?: string;
  input?: Record<string, unknown> | unknown;
}

/**
 * Log error to database and send WhatsApp alert
 */
export async function logErrorToDB(input: ErrorLogInput): Promise<void> {
  const { type, message, stack, route, input: errorInput } = input;

  try {
    // 1. Save to SQLite
    db.prepare(
      `
      INSERT INTO error_logs (type, message, stack, route, input)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(type, message, stack || null, route || null, JSON.stringify(errorInput || {}));

    // 2. Send WhatsApp alert
    await axios.post(process.env.WHATSAPP_API || '', null, {
      params: {
        appkey: process.env.WHATSAPP_APPKEY,
        authkey: process.env.WHATSAPP_AUTHKEY,
        to: process.env.WHATSAPP_TO,
        message: `type: [${type}], message: ${message}, stack: ${stack || 'N/A'}, route: ${route || 'N/A'}`,
      },
    });
  } catch (e) {
    console.error('[logError] Failed:', (e as Error).message);
  }
}

export default {
  logErrorToDB,
};
