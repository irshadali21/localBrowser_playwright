// middleware/hmacSignature.js
const crypto = require('crypto');
const SIGNATURE_WINDOW_SECONDS = 300; // ±5 minutes

/**
 * HMAC Signature Verification Middleware
 * 
 * Verifies that incoming requests from Laravel are authentic.
 * Also signs outgoing responses.
 */
function verifySignature(req, res, next) {
  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];

  if (!signature || !timestamp) {
    console.warn('[HMAC] Missing signature headers', {
      path: req.path,
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
    });

    return res.status(401).json({ error: 'Missing HMAC headers' });
  }

  // Verify timestamp is fresh
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > SIGNATURE_WINDOW_SECONDS) {
    console.warn('[HMAC] Stale timestamp', {
      path: req.path,
      timestamp,
      now,
      diff: Math.abs(now - ts),
    });

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

  if (!crypto.timingsSafeEqual(expectedSignature, signature)) {
    console.warn('[HMAC] Invalid signature', {
      path: req.path,
      provided: signature.substring(0, 8) + '...',
    });

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
