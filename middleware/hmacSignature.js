// middleware/hmacSignature.js
const crypto = require('crypto');
const SIGNATURE_WINDOW_SECONDS = 300; // ±5 minutes

// Debug mode: only log sensitive data in development
const DEBUG_MODE = process.env.NODE_ENV === 'development' && process.env.HMAC_DEBUG === 'true';

/**
 * HMAC Signature Verification Middleware
 * 
 * Verifies that incoming requests from Laravel are authentic.
 * Also signs outgoing responses.
 */
function verifySignature(req, res, next) {
  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];

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
    return res.status(401).json({ error: 'Missing HMAC headers' });
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
    return res.status(401).json({ error: 'Timestamp expired' });
  }

  // Verify signature
  const secret = process.env.LOCALBROWSER_SECRET;
  if (!secret) {
    console.error('[HMAC] LOCALBROWSER_SECRET not configured');
    return res.status(500).json({ error: 'Server misconfiguration' });
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
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Signature valid, store for response signing
  res.locals.timestamp = Math.floor(Date.now() / 1000);
  res.locals.secret = secret;

  // Sign response before sending
  const originalJson = res.json;
  res.json = function(data) {
    const responseTimestamp = res.locals.timestamp;
    const responseSignature = crypto
      .createHmac('sha256', res.locals.secret)
      .update(responseTimestamp.toString())
      .digest('hex');

    res.set('X-Signature', responseSignature);
    res.set('X-Timestamp', responseTimestamp.toString());

    return originalJson.call(this, data);
  };

  next();
}

module.exports = verifySignature;
