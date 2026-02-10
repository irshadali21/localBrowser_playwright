// services/resultSubmitter.ts
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import os from 'os';
import { TaskExecutionResult } from '../types/services';

/**
 * Result Submitter Service
 *
 * Submits completed task results back to Laravel via internal API.
 * Handles signing, retries, and error handling.
 */
export class ResultSubmitter {
  private readonly laravelUrl: string;
  private readonly secret: string;
  private readonly workerId: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly requestTimeout: number;

  constructor(
    config: {
      laravelUrl?: string;
      secret?: string;
      workerId?: string;
      maxRetries?: number;
      retryDelayMs?: number;
      requestTimeout?: number;
    } = {}
  ) {
    this.laravelUrl = config.laravelUrl || process.env.LARAVEL_INTERNAL_URL || '';
    this.secret = config.secret || process.env.LOCALBROWSER_SECRET || '';
    this.workerId = config.workerId || process.env.WORKER_ID || `${os.hostname()}:${process.pid}`;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelayMs = config.retryDelayMs || 2000;
    this.requestTimeout = config.requestTimeout || 30000;

    if (!this.laravelUrl || !this.secret) {
      throw new Error('LARAVEL_INTERNAL_URL and LOCALBROWSER_SECRET must be configured');
    }
  }

  /**
   * Submit a task result to Laravel
   */
  async submit(result: TaskExecutionResult): Promise<{ statusCode: number; body?: unknown }> {
    console.log(`[ResultSubmitter] Submitting result for task ${result.task_id}`, {
      type: result.type,
      status: result.success ? 'completed' : 'failed',
      error: result.error || null,
      result,
    });

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this._submitWithSignature(result);
        console.log(`[ResultSubmitter] Task ${result.task_id} submitted successfully`, {
          status: response.statusCode,
          attempt,
        });

        return response;
      } catch (error) {
        const err = error as Error;
        console.warn(`[ResultSubmitter] Submission attempt ${attempt}/${this.maxRetries} failed:`, {
          taskId: result.task_id,
          error: err.message,
        });

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw new Error(
            `Failed to submit task result after ${this.maxRetries} attempts: ${err.message}`
          );
        }
      }
    }

    throw new Error('Unexpected error in submit loop');
  }

  /**
   * Submit result with HMAC signature
   */
  private async _submitWithSignature(
    result: TaskExecutionResult
  ): Promise<{ statusCode: number; body?: unknown }> {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload: Record<string, unknown> = {
      task_id: result.task_id,
      type: result.type,
      status: result.success ? 'completed' : 'failed',
      executed_at: result.executed_at,
      duration_ms: result.duration_ms || 0,
      worker_id: this.workerId.split(':')[0],
      processing_by: this.workerId,
    };

    if (result.result !== null) {
      payload.result = result.result;
    }

    if (result.error !== null) {
      payload.error = result.error;
    }

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(timestamp.toString())
      .digest('hex');

    return new Promise((resolve, reject) => {
      const url = new URL('/internal/task-result', this.laravelUrl);

      console.log(`[ResultSubmitter] Submitting to: ${url.href}`);

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port ? parseInt(url.port, 10) : url.protocol === 'https:' ? 443 : 80,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Timestamp': timestamp.toString(),
          Accept: 'application/json',
        },
        timeout: this.requestTimeout,
      };

      if (process.env.NODE_ENV === 'development') {
        (options as https.RequestOptions & { rejectUnauthorized?: boolean }).rejectUnauthorized =
          false;
      }

      const handleResponse = (res: http.IncomingMessage) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
            const redirectUrl = res.headers.location;
            console.error(
              `[ResultSubmitter] Unexpected redirect (${res.statusCode}) to: ${redirectUrl}`
            );
            console.error('[ResultSubmitter] This usually means:');
            console.error('  1. The Laravel endpoint /internal/task-result does not exist');
            console.error('  2. CSRF middleware is interfering');
            console.error('  3. Authentication middleware is blocking the request');
            console.error('  4. LARAVEL_INTERNAL_URL in .env is incorrect');
            console.error(`[ResultSubmitter] Current LARAVEL_INTERNAL_URL: ${this.laravelUrl}`);

            reject(
              new Error(
                `Laravel returned redirect ${res.statusCode} to ${redirectUrl}. Check Laravel routes and middleware.`
              )
            );
            return;
          }

          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: res.statusCode,
              body: data ? JSON.parse(data) : null,
            });
          } else {
            reject(new Error(`Laravel returned ${res.statusCode}: ${data}`));
          }
        });
      };

      const handleError = (error: Error) => {
        reject(error);
      };

      const req = https.request(options, handleResponse);
      req.on('error', handleError);
      req.write(JSON.stringify(payload));
      req.end();
    });
  }
}

export default ResultSubmitter;
