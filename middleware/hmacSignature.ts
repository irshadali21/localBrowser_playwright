import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// Time window for signature validation (±5 minutes)
const SIGNATURE_WINDOW_SECONDS = 300;

// Debug mode: only log sensitive data in development
const DEBUG_MODE = process.env.NODE_ENV === 'development' && process.env.HMAC_DEBUG === 'true';

// Extend Express Response to include our locals
interface HmacResponseLocals {
  timestamp?: number;
  secret?: string;
}

/**
 * HMAC Signature Verification Middleware
 *
 * Verifies that incoming requests from Laravel are authentic.
 * Also signs outgoing responses.
 */
export function verifySignature(req: Request, res: Response<unknown>, next: NextFunction): void {
  const signature = req.headers['x-signature'] as string | undefined;
  const timestamp = req.headers['x-timestamp'] as string | undefined;

  if (DEBUG_MODE) {
    console.log('[HMAC] Incoming request', {
      path: req.path,
      method: req.method,
      hasSignature: !!signature,
      timestamp: timestamp,
    });
  }

  if (!signature || !timestamp) {
    if (DEBUG_MODE) {
      console.warn('[HMAC] Missing signature headers', {
        path: req.path,
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
      });
    }
    res.status(401).json({ error: 'Missing HMAC headers' });
    return;
  }

  // Verify timestamp is fresh
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > SIGNATURE_WINDOW_SECONDS) {
    if (DEBUG_MODE) {
      console.warn('[HMAC] Stale timestamp', {
        path: req.path,
        diff: Math.abs(now - ts),
      });
    }
    res.status(401).json({ error: 'Timestamp expired' });
    return;
  }

  // Verify signature
  const secret = process.env.LOCALBROWSER_SECRET;
  if (!secret) {
    console.error('[HMAC] LOCALBROWSER_SECRET not configured');
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(timestamp.toString())
    .digest('hex');

  // Simple string comparison (signatures should always be same length hex strings)
  const signaturesMatch = expectedSignature === signature;

  if (DEBUG_MODE) {
    console.log('[HMAC] Signature verification', {
      path: req.path,
      match: signaturesMatch,
      signatureLength: signature.length,
    });
  }

  if (!signaturesMatch) {
    console.warn('[HMAC] Invalid signature for', req.path);
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Signature valid, store for response signing
  const responseTimestamp = Math.floor(Date.now() / 1000);
  (res as Response & { locals: HmacResponseLocals }).locals = {
    timestamp: responseTimestamp,
    secret: secret,
  };

  // Sign response before sending
  const originalJson = res.json.bind(res);
  res.json = function (data: unknown): Response {
    const locals = (res as Response & { locals: HmacResponseLocals }).locals;
    const sig = crypto
      .createHmac('sha256', locals.secret || '')
      .update(locals.timestamp?.toString() || '')
      .digest('hex');

    res.set('X-Signature', sig);
    res.set('X-Timestamp', locals.timestamp?.toString() || '');

    return originalJson(data);
  };

  next();
}

export default verifySignature;
