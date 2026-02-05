// services/resultSubmitter.js
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const os = require('os');

/**
 * Result Submitter Service
 * 
 * Submits completed task results back to Laravel via internal API.
 * Handles signing, retries, and error handling.
 */
class ResultSubmitter {
  constructor(config = {}) {
    this.laravelUrl = config.laravelUrl || process.env.LARAVEL_INTERNAL_URL;
    this.secret = config.secret || process.env.LOCALBROWSER_SECRET;
    this.workerId = config.workerId || process.env.WORKER_ID || `${os.hostname()}:${process.pid}`;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelayMs = config.retryDelayMs || 2000;
    this.requestTimeout = config.requestTimeout || 30000; // 30 second timeout

    if (!this.laravelUrl || !this.secret) {
      throw new Error('LARAVEL_INTERNAL_URL and LOCALBROWSER_SECRET must be configured');
    }
  }

  /**
   * Submit a task result to Laravel
   * @param {Object} result - Result object from TaskExecutor
   * @returns {Promise<Object>} Response from Laravel
   */
  async submit(result) {
    console.log(`[ResultSubmitter] Submitting result for task ${result.task_id}`, {
      type: result.type,
      status: result.success ? 'completed' : 'failed',
      error: result.error || null,
      result: result
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
        console.warn(`[ResultSubmitter] Submission attempt ${attempt}/${this.maxRetries} failed:`, {
          taskId: result.task_id,
          error: error.message,
        });

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff: 2s, 4s, 8s
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw new Error(`Failed to submit task result after ${this.maxRetries} attempts: ${error.message}`);
        }
      }
    }
  }

  /**
   * Submit result with HMAC signature
   * @private
   */
  async _submitWithSignature(result) {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      task_id: result.task_id,
      type: result.type,
      status: result.success ? 'completed' : 'failed',
      result: result.result || null,
      error: result.error || null,
      executed_at: result.executed_at,
      duration_ms: result.duration_ms || 0,
      worker_id: this.workerId.split(':')[0], // Just the simple worker ID
      processing_by: this.workerId, // Full hostname:pid for detailed tracking
    };

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(timestamp.toString())
      .digest('hex');

    return new Promise((resolve, reject) => {
      const url = new URL('/internal/task-result', this.laravelUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Timestamp': timestamp.toString(),
        },
        timeout: this.requestTimeout, // Request timeout
        // Disable SSL verification in development
        ...(process.env.NODE_ENV === 'development' && { rejectUnauthorized: false }),
      };

      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: res.statusCode,
              body: data ? JSON.parse(data) : null,
            });
          } else {
            reject(new Error(`Laravel returned ${res.statusCode}: ${data}`));
          }
        });
      });

      // Set socket timeout
      req.setTimeout(this.requestTimeout, () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.requestTimeout}ms`));
      });

      req.on('error', reject);
      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  /**
   * Batch submit multiple results
   * @param {Array} results - Array of result objects
   * @returns {Promise<Array>} Array of submission responses
   */
  async submitBatch(results) {
    console.log(`[ResultSubmitter] Submitting batch of ${results.length} results`);

    const responses = [];

    for (const result of results) {
      try {
        const response = await this.submit(result);
        responses.push({ taskId: result.task_id, success: true, response });
      } catch (error) {
        responses.push({ taskId: result.task_id, success: false, error: error.message });
      }
    }

    return responses;
  }
}

module.exports = ResultSubmitter;
