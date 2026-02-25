const crypto = require('crypto');
const { enqueueJob } = require('../services/jobQueue');

exports.create = async (req, res, next) => {
  try {
    console.log('[JobController] Received job creation request', {
      path: req.path,
      method: req.method,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      contentType: req.headers['content-type'],
    });

    const { jobId: providedJobId, target, parser, callbackUrl } = req.body || {};

    if (!target || typeof target.url !== 'string') {
      console.warn('[JobController] Invalid request: missing target.url');
      return res.status(400).json({ error: 'Missing target.url' });
    }

    if (!parser || typeof parser.mode !== 'string') {
      console.warn('[JobController] Invalid request: missing parser');
      return res.status(400).json({ error: 'Missing parser definition' });
    }

    const validModes = ['vendor', 'script'];
    if (!validModes.includes(parser.mode)) {
      console.warn(`[JobController] Invalid request: parser.mode must be "vendor" or "script", got: "${parser.mode}"`);
      return res.status(400).json({ error: 'Invalid parser.mode: must be "vendor" or "script"' });
    }

    if (!callbackUrl) {
      console.warn('[JobController] Invalid request: missing callbackUrl');
      return res.status(400).json({ error: 'Missing callbackUrl' });
    }

    const job = {
      jobId: providedJobId || crypto.randomUUID(),
      target: {
        url: target.url,
        metadata: target.metadata || {},
      },
      parser: {
        id: parser.id,
        slug: parser.slug,
        mode: parser.mode,
        definition: parser.definition || {},
      },
      lead: target.lead || {},
      callbackUrl
    };

    console.log('[JobController] Job created', {
      jobId: job.jobId,
      url: job.target.url,
      parserMode: job.parser.mode,
      callbackUrl: job.callbackUrl,
    });

    await enqueueJob(job);

    console.log('[JobController] Job enqueued successfully', {
      jobId: job.jobId,
    });

    res.status(202).json({ jobId: job.jobId, status: 'queued' });
  } catch (error) {
    console.error('[JobController] Error creating job', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};