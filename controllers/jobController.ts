/**
 * Job Controller - TypeScript migration
 */

import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { enqueueJob } from '../services/jobQueue';

/**
 * Target configuration
 */
interface JobTarget {
  url: string;
  metadata?: Record<string, unknown>;
  lead?: Record<string, unknown>;
}

/**
 * Parser configuration
 */
interface JobParser {
  id?: string;
  slug?: string;
  mode: 'single' | 'batch' | 'vendor' | 'script';
  definition?: Record<string, unknown>;
}

/**
 * Job creation payload
 */
interface CreateJobPayload {
  jobId?: string;
  target: JobTarget;
  parser: JobParser;
  callbackUrl: string;
}

/**
 * Create a new job
 */
export const create = async (
  req: Request<{}, {}, CreateJobPayload>,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
      res.status(400).json({ error: 'Missing target.url' });
      return;
    }

    if (!parser || typeof parser.mode !== 'string') {
      console.warn('[JobController] Invalid request: missing parser');
      res.status(400).json({ error: 'Missing parser definition' });
      return;
    }

    if (!parser.slug || typeof parser.slug !== 'string') {
      console.warn('[JobController] Invalid request: missing parser.slug');
      res.status(400).json({ error: 'Missing parser.slug' });
      return;
    }

    if (!callbackUrl) {
      console.warn('[JobController] Invalid request: missing callbackUrl');
      res.status(400).json({ error: 'Missing callbackUrl' });
      return;
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
      callbackUrl,
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
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    next(error);
  }
};

export default { create };
