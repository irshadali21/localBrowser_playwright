/**
 * Job Command Handlers
 * Command handlers for job queue management
 */

import { BaseCommandHandler, HandlerResult, AuditContext } from './baseCommandHandler';
import { enqueueJob, type Job } from '../../services/jobQueue';

/**
 * Job Create Handler - Create a new job
 */
export class JobCreateHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    const target = payload.target as Record<string, unknown> | undefined;
    if (!target || typeof target !== 'object') {
      errors.push('target is required and must be an object');
    } else if (!target.url || typeof target.url !== 'string') {
      errors.push('target.url is required');
    }

    const parser = payload.parser as Record<string, unknown> | undefined;
    if (!parser || typeof parser !== 'object') {
      errors.push('parser is required and must be an object');
    } else if (!parser.slug || typeof parser.slug !== 'string') {
      errors.push('parser.slug is required');
    } else if (!parser.mode || typeof parser.mode !== 'string') {
      errors.push('parser.mode is required');
    }

    if (!payload.callbackUrl || typeof payload.callbackUrl !== 'string') {
      errors.push('callbackUrl is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const target = _payload.target as Record<string, unknown>;
      const parser = _payload.parser as Record<string, unknown>;

      const job: Job = {
        jobId:
          (_payload.jobId as string) ||
          `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        target: {
          url: target.url as string,
          metadata: target.metadata as Record<string, unknown>,
          lead: target.lead as Record<string, unknown>,
        },
        parser: {
          slug: parser.slug as string,
          mode: parser.mode as 'single' | 'batch' | 'vendor',
          definition: parser.definition as Record<string, unknown>,
        },
        callbackUrl: _payload.callbackUrl as string,
      };

      await enqueueJob(job);

      return {
        success: true,
        data: {
          jobId: job.jobId,
          status: 'queued',
          target: job.target,
          parser: job.parser,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'JOB_CREATE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'job';
  }

  getName(): string {
    return 'job.create';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'write';
  }
}

/**
 * Job Status Handler - Get job status
 */
export class JobStatusHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.jobId || typeof payload.jobId !== 'string') {
      errors.push('jobId is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const jobId = _payload.jobId as string;

      // Get job status from database
      const db = await import('../../utils/db');
      const job = db.default?.prepare?.('SELECT * FROM jobs WHERE id = ?')?.get(jobId) as
        | Record<string, unknown>
        | undefined;

      if (!job) {
        return {
          success: false,
          error: 'Job not found',
          code: 'JOB_NOT_FOUND',
        };
      }

      return {
        success: true,
        data: {
          jobId,
          status: job.status,
          createdAt: job.created_at,
          updatedAt: job.updated_at,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'JOB_STATUS_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'job';
  }

  getName(): string {
    return 'job.status';
  }
}

/**
 * Job Cancel Handler - Cancel a job
 */
export class JobCancelHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.jobId || typeof payload.jobId !== 'string') {
      errors.push('jobId is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const jobId = _payload.jobId as string;
      const reason = _payload.reason as string | undefined;

      // Cancel job in database
      const db = await import('../../utils/db');
      db.default
        ?.prepare?.("UPDATE jobs SET status = 'cancelled', reason = ? WHERE id = ?")
        ?.run(reason, jobId);

      return {
        success: true,
        data: {
          jobId,
          status: 'cancelled',
          reason,
          cancelledAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'JOB_CANCEL_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'job';
  }

  getName(): string {
    return 'job.cancel';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'delete';
  }
}

/**
 * Job List Handler - List jobs
 */
export class JobListHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const options = payload.options as Record<string, unknown> | undefined;
      const status = options?.status as string | undefined;
      const limit = (options?.limit as number) || 50;
      const offset = (options?.offset as number) || 0;

      // Get jobs from database
      const db = await import('../../utils/db');

      let query = 'SELECT * FROM jobs';
      const params: string[] = [];

      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit.toString(), offset.toString());

      const jobs =
        (db.default?.prepare?.(query)?.all(...params) as Record<string, unknown>[] | undefined) ||
        [];

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM jobs';
      if (status) {
        countQuery += ' WHERE status = ?';
      }
      const countResult = db.default?.prepare?.(countQuery)?.get(status) as
        | { total: number }
        | undefined;
      const total = countResult?.total || 0;

      return {
        success: true,
        data: {
          jobs: jobs.map(job => ({
            jobId: job.id,
            status: job.status,
            createdAt: job.created_at,
            updatedAt: job.updated_at,
          })),
          total,
          limit,
          offset,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'JOB_LIST_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'job';
  }

  getName(): string {
    return 'job.list';
  }
}

/**
 * Job Retry Handler - Retry a failed job
 */
export class JobRetryHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.jobId || typeof payload.jobId !== 'string') {
      errors.push('jobId is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const jobId = _payload.jobId as string;

      // Get original job
      const db = await import('../../utils/db');
      const originalJob = db.default?.prepare?.('SELECT * FROM jobs WHERE id = ?')?.get(jobId) as
        | Record<string, unknown>
        | undefined;

      if (!originalJob) {
        return {
          success: false,
          error: 'Job not found',
          code: 'JOB_NOT_FOUND',
        };
      }

      // Create new job with same parameters
      const newJob: Job = {
        jobId: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        target: {
          url: originalJob.target_url as string,
          metadata: JSON.parse((originalJob.metadata as string) || '{}'),
          lead: JSON.parse((originalJob.lead as string) || '{}'),
        },
        parser: {
          slug: originalJob.parser_slug as string,
          mode: originalJob.parser_mode as 'single' | 'batch' | 'vendor',
          definition: JSON.parse((originalJob.parser_definition as string) || '{}'),
        },
        callbackUrl: originalJob.callback_url as string,
      };

      await enqueueJob(newJob);

      return {
        success: true,
        data: {
          originalJobId: jobId,
          newJobId: newJob.jobId,
          status: 'queued',
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'JOB_RETRY_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'job';
  }

  getName(): string {
    return 'job.retry';
  }
}

/**
 * Export all job handlers
 */
export const jobHandlers = {
  'job.create': new JobCreateHandler(),
  'job.status': new JobStatusHandler(),
  'job.cancel': new JobCancelHandler(),
  'job.list': new JobListHandler(),
  'job.retry': new JobRetryHandler(),
};
