const crypto = require('crypto');
const { enqueueJob } = require('../services/jobQueue');

exports.create = async (req, res, next) => {
  try {
    const { jobId: providedJobId, target, parser, callbackUrl } = req.body || {};

    if (!target || typeof target.url !== 'string') {
      return res.status(400).json({ error: 'Missing target.url' });
    }

    if (!parser || typeof parser.mode !== 'string') {
      return res.status(400).json({ error: 'Missing parser definition' });
    }

    if (!callbackUrl) {
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

    await enqueueJob(job);

    res.status(202).json({ jobId: job.jobId, status: 'queued' });
  } catch (error) {
    next(error);
  }
};