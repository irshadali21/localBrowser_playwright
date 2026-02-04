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

  console.log('[HMAC] Incoming request', {
    path: req.path,
    method: req.method,
    signature: signature ? signature.substring(0, 16) + '...' : 'MISSING',
    timestamp: timestamp,
    allHeaders: Object.keys(req.headers).sort(),
  });

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

  console.log('[HMAC] Secret info', {
    secretLength: secret.length,
    secretPreview: secret.substring(0, 16) + '...',
  });

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(timestamp.toString())
    .digest('hex');

  // Simple string comparison (signatures should always be same length hex strings)
  const signaturesMatch = expectedSignature === signature;

  console.log('[HMAC] Signature verification', {
    path: req.path,
    timestamp: timestamp,
    provided: signature.substring(0, 16) + '...',
    expected: expectedSignature.substring(0, 16) + '...',
    match: signaturesMatch,
    providedLength: signature.length,
    expectedLength: expectedSignature.length,
  });

  if (!signaturesMatch) {
    console.warn('[HMAC] Invalid signature', {
      path: req.path,
      provided: signature.substring(0, 8) + '...',
      expected: expectedSignature.substring(0, 8) + '...',
      timestamp: timestamp,
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
