const axios = require('axios');
const crypto = require('crypto');
const { scrapeProduct, runScript, closeBrowser } = require('../helpers/browserHelper');
const { logErrorToDB } = require('../utils/errorLogger');

const queue = [];
let processing = false;

async function enqueueJob(job) {
  queue.push(job);
  processQueue();
  return { jobId: job.jobId, position: queue.length - 1 };
}

async function processQueue() {
  if (processing) {
    return;
  }

  processing = true;

  while (queue.length) {
    const job = queue.shift();
    await runJob(job);
  }

  processing = false;
}

async function runJob(job) {
  const startedAt = new Date().toISOString();
  let status = 'succeeded';
  let artifacts = [];
  let errorPayload = null;

  try {
    let payload;

    if (job.parser.mode === 'vendor') {
      const vendorKey = job.parser.definition?.vendor || job.parser.definition?.vendorSlug || job.parser.slug;
      if (!vendorKey) {
        throw new Error('Parser definition missing vendor key.');
      }
      payload = await scrapeProduct(job.target.url, vendorKey);
    } else if (job.parser.mode === 'script') {
      const script = job.parser.definition?.script;
      if (!script) {
        throw new Error('Parser definition missing script code.');
      }
      payload = await runScript(script, { target: job.target, parser: job.parser });
    } else {
      throw new Error(`Unsupported parser mode: ${job.parser.mode}`);
    }

    artifacts.push({
      type: 'raw',
      format: 'json',
      payload
    });
  } catch (error) {
    status = 'failed';
    errorPayload = {
      message: error.message,
      stack: error.stack,
    };
    await logErrorToDB({
      type: 'SCRAPE_JOB_FAILED',
      message: error.message,
      stack: error.stack,
      route: '/jobs',
      input: job,
    });
  } finally {
    await closeBrowser();
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
    }
  });
}

async function dispatchWebhook(job, payload) {
  if (!job.callbackUrl) {
    return;
  }

  const secret = process.env.WEBHOOK_SECRET;
  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json'
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
    await logErrorToDB({
      type: 'WEBHOOK_FAILED',
      message: error.message,
      stack: error.stack,
      route: job.callbackUrl,
      input: payload,
    });
  }
}

module.exports = {
  enqueueJob,
};