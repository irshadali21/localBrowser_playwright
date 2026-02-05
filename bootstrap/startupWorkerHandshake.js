// bootstrap/startupWorkerHandshake.js
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const os = require('os');

/**
 * Startup Worker Handshake
 * 
 * On startup, the Node worker calls Laravel's /internal/request-work endpoint
 * to signal that it's ready and fetch any pending tasks.
 * This provides resilience: if the worker crashes, Laravel has already queued the work.
 */
class StartupWorkerHandshake {
  constructor(config = {}) {
    this.laravelUrl = config.laravelUrl || process.env.LARAVEL_INTERNAL_URL;
    this.secret = config.secret || process.env.LOCALBROWSER_SECRET;
    this.workerId = config.workerId || process.env.WORKER_ID || `worker-${process.pid}`;
    this.processingBy = `${os.hostname()}:${process.pid}`; // For detailed worker tracking
    this.logger = config.logger || console;
    this.maxRetries = config.maxRetries || 5;
    this.retryDelayMs = config.retryDelayMs || 3000;
    this.requestTimeout = config.requestTimeout || 30000; // 30 second timeout
  }

  /**
   * Execute startup handshake
   * @returns {Promise<Array>} Array of tasks assigned to this worker
   */
  async execute() {
    this.logger.info('[StartupWorkerHandshake] Starting worker handshake', {
      workerId: this.workerId,
      laravelUrl: this.laravelUrl,
    });

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        let response = await this._callRequestWork();
        
        // Parse JSON if response is a string
        if (typeof response === 'string') {
          response = JSON.parse(response);
        }
        
        this.logger.info('[StartupWorkerHandshake] response', response);

        if (response.tasks && response.tasks.length > 0) {
          this.logger.info('[StartupWorkerHandshake] Handshake successful', {
            workerId: this.workerId,
            taskCount: response.tasks.length,
            attempt,
          });

          return response.tasks;
        } else {
          this.logger.info('[StartupWorkerHandshake] Handshake successful, no tasks available', {
            workerId: this.workerId,
            attempt,
          });

          return [];
        }
      } catch (error) {
        this.logger.warn('[StartupWorkerHandshake] Handshake failed (attempt ' + attempt + '/' + this.maxRetries + '):', {
          workerId: this.workerId,
          error: error.message,
        });

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * attempt;
          this.logger.info('[StartupWorkerHandshake] Retrying in ' + delay + 'ms...');
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.logger.error('[StartupWorkerHandshake] Handshake failed after ' + this.maxRetries + ' attempts');
          // Don't throw — allow worker to start even if Laravel is temporarily unavailable
          return [];
        }
      }
    }
  }

  /**
   * Call Laravel's /internal/request-work endpoint
   * @private
   */
  async _callRequestWork() {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(timestamp.toString())
      .digest('hex');

    return new Promise((resolve, reject) => {
      const url = new URL('/internal/request-work', this.laravelUrl);
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
          try {
            const response = JSON.parse(data);

            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject(new Error(`Laravel returned ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse Laravel response: ${error.message}`));
          }
        });
      });

      // Set socket timeout
      req.setTimeout(this.requestTimeout, () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.requestTimeout}ms`));
      });

      req.on('error', reject);

      // Send request body with max_tasks parameter and worker identity
      const payload = JSON.stringify({
        max_tasks: 10,
        worker_id: this.workerId,
        processing_by: this.processingBy,
      });
      req.write(payload);
      req.end();
    });
  }
}

module.exports = StartupWorkerHandshake;
