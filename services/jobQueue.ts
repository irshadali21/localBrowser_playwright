// services/jobQueue.ts
import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';

// Job types
interface JobTarget {
  url: string;
  [key: string]: unknown;
}

interface JobParserDefinition {
  vendor?: string;
  vendorSlug?: string;
  slug?: string;
  script?: string;
  [key: string]: unknown;
}

interface JobParser {
  slug: string;
  mode: 'single' | 'batch' | 'vendor' | 'script';
  definition?: JobParserDefinition;
  [key: string]: unknown;
}

interface Job {
  jobId: string;
  target: JobTarget;
  parser: JobParser;
  callbackUrl?: string;
  [key: string]: unknown;
}

interface JobResult {
  jobId: string;
  status: 'succeeded' | 'failed';
  startedAt: string;
  finishedAt: string;
  artifacts: Array<{
    type: string;
    format: string;
    payload: unknown;
  }>;
  error: {
    message: string;
    stack?: string;
  } | null;
  meta: {
    parser: string;
    mode: string;
  };
}

interface WebhookPayload {
  jobId: string;
  status: string;
  startedAt: string;
  finishedAt: string;
  artifacts: Array<{
    type: string;
    format: string;
    payload: unknown;
  }>;
  error: {
    message: string;
    stack?: string;
  } | null;
  meta: {
    parser: string;
    mode: string;
  };
}

// Module-level state (legacy pattern)
const queue: Job[] = [];
let processing = false;

// Browser helper interface
interface BrowserHelper {
  scrapeProduct: (url: string, vendorKey: string) => Promise<unknown>;
  runScript: (script: string, context: Record<string, unknown>) => Promise<unknown>;
  closeBrowser: () => Promise<void>;
}

// Error logger interface
interface ErrorLogger {
  logErrorToDB: (error: {
    type: string;
    message: string;
    stack?: string;
    route?: string;
    input?: unknown;
  }) => Promise<void>;
}

// Get browser helper and error logger (dynamically imported)
let browserHelper: BrowserHelper | null = null;
let errorLogger: ErrorLogger | null = null;

function getBrowserHelper(): BrowserHelper {
  if (!browserHelper) {
    const helper = require('../helpers/browserHelper');
    browserHelper = {
      scrapeProduct: helper.scrapeProduct,
      runScript: helper.runScript,
      closeBrowser: helper.closeBrowser,
    };
  }
  return browserHelper;
}

async function logErrorToDB(error: {
  type: string;
  message: string;
  stack?: string;
  route?: string;
  input?: unknown;
}): Promise<void> {
  if (!errorLogger) {
    const logger = require('../utils/errorLogger');
    errorLogger = { logErrorToDB: logger.logErrorToDB };
  }
  await errorLogger.logErrorToDB(error);
}

export async function enqueueJob(job: Job): Promise<{ jobId: string; position: number }> {
  queue.push(job);
  processQueue();
  return { jobId: job.jobId, position: queue.length - 1 };
}

async function processQueue(): Promise<void> {
  if (processing) {
    return;
  }

  processing = true;

  while (queue.length) {
    const job = queue.shift();
    if (job) {
      await runJob(job);
    }
  }

  processing = false;
}

async function runJob(job: Job): Promise<void> {
  const startedAt = new Date().toISOString();
  let status: 'succeeded' | 'failed' = 'succeeded';
  const artifacts: Array<{ type: string; format: string; payload: unknown }> = [];
  let errorPayload: { message: string; stack?: string } | null = null;

  const helper = getBrowserHelper();

  try {
    let payload: unknown;

    if (job.parser.mode === 'vendor') {
      const vendorKey =
        job.parser.definition?.vendor || job.parser.definition?.vendorSlug || job.parser.slug;
      if (!vendorKey) {
        throw new Error('Parser definition missing vendor key.');
      }
      payload = await helper.scrapeProduct(job.target.url, vendorKey);
    } else if (job.parser.mode === 'script') {
      const script = job.parser.definition?.script;
      if (!script) {
        throw new Error('Parser definition missing script code.');
      }
      payload = await helper.runScript(script, { target: job.target, parser: job.parser });
    } else {
      throw new Error(`Unsupported parser mode: ${job.parser.mode}`);
    }

    artifacts.push({
      type: 'raw',
      format: 'json',
      payload,
    });
  } catch (error) {
    status = 'failed';
    const err = error as Error;
    errorPayload = {
      message: err.message,
      stack: err.stack,
    };
    await logErrorToDB({
      type: 'SCRAPE_JOB_FAILED',
      message: err.message,
      stack: err.stack,
      route: '/jobs',
      input: job,
    });
  } finally {
    await helper.closeBrowser();
  }

  const finishedAt = new Date().toISOString();

  await dispatchWebhook(job, {
    jobId: job.jobId,
    status,
    startedAt,
    finishedAt,
    artifacts,
    error: errorPayload,
    meta: {
      parser: job.parser.slug,
      mode: job.parser.mode,
    },
  });
}

async function dispatchWebhook(job: Job, payload: WebhookPayload): Promise<void> {
  if (!job.callbackUrl) {
    return;
  }

  const secret = process.env.WEBHOOK_SECRET;
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (secret) {
    headers['X-Signature'] = crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  try {
    console.log(job.callbackUrl);
    console.log(job);
    console.log(body);

    await axios.post(job.callbackUrl, body, { headers });
  } catch (error) {
    const err = error as AxiosError;
    await logErrorToDB({
      type: 'WEBHOOK_FAILED',
      message: err.message,
      stack: err.stack,
      route: job.callbackUrl,
      input: payload,
    });
  }
}

// Re-export types for consumers
export type { Job, JobTarget, JobParser, JobParserDefinition, JobResult };

export default {
  enqueueJob,
};
