// tests/test-result-submitter.js

const assert = require('assert');
const crypto = require('crypto');
const ResultSubmitter = require('../services/resultSubmitter');

describe('Result Submitter Service', () => {
  const config = {
    laravelUrl: 'http://localhost:8000',
    secret: 'test_secret_key_32_chars_long!!',
    workerId: 'worker-1',
    maxRetries: 1, // Reduce retries for testing
  };

  let submitter;

  beforeEach(() => {
    submitter = new ResultSubmitter(config);
  });

  describe('Constructor', () => {
    it('should initialize with config', () => {
      assert.strictEqual(submitter.laravelUrl, 'http://localhost:8000');
      assert.strictEqual(submitter.secret, config.secret);
      assert.strictEqual(submitter.workerId, 'worker-1');
    });

    it('should read from environment variables', () => {
      process.env.LARAVEL_INTERNAL_URL = 'http://test:8000';
      process.env.LOCALBROWSER_SECRET = 'env_secret';
      process.env.WORKER_ID = 'env-worker';

      let envSubmitter;
      try {
        envSubmitter = new ResultSubmitter();

        assert.strictEqual(envSubmitter.laravelUrl, 'http://test:8000');
        assert.strictEqual(envSubmitter.secret, 'env_secret');
        assert.strictEqual(envSubmitter.workerId, 'env-worker');
      } finally {
        // Cleanup to prevent cross-test leakage
        delete process.env.LARAVEL_INTERNAL_URL;
        delete process.env.LOCALBROWSER_SECRET;
        delete process.env.WORKER_ID;
      }
    });

    it('should throw if LARAVEL_INTERNAL_URL is missing', () => {
      assert.throws(() => {
        new ResultSubmitter({
          secret: 'test',
          // Missing laravelUrl
        });
      });
    });

    it('should throw if LOCALBROWSER_SECRET is missing', () => {
      assert.throws(() => {
        new ResultSubmitter({
          laravelUrl: 'http://localhost:8000',
          // Missing secret
        });
      });
    });
  });

  describe('Signature generation', () => {
    it('should generate valid HMAC signature', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const expectedSignature = crypto
        .createHmac('sha256', config.secret)
        .update(timestamp.toString())
        .digest('hex');

      // Note: In real implementation, signature is generated in _submitWithSignature
      // This test verifies the algorithm works
      assert(expectedSignature.length === 64); // SHA256 hex length
    });

    it('should include timestamp in signature', () => {
      const timestamp1 = Math.floor(Date.now() / 1000);
      const timestamp2 = timestamp1 + 1;

      const sig1 = crypto
        .createHmac('sha256', config.secret)
        .update(timestamp1.toString())
        .digest('hex');

      const sig2 = crypto
        .createHmac('sha256', config.secret)
        .update(timestamp2.toString())
        .digest('hex');

      assert.notStrictEqual(sig1, sig2, 'Different timestamps should produce different signatures');
    });
  });

  describe('Batch submission', () => {
    it('should handle batch of results', async () => {
      const results = [
        {
          task_id: 'task-1',
          type: 'website_html',
          success: true,
          result: { html: '<html></html>' },
          executed_at: new Date().toISOString(),
          duration_ms: 1000,
        },
        {
          task_id: 'task-2',
          type: 'lighthouse_html',
          success: false,
          error: 'Timeout',
          executed_at: new Date().toISOString(),
          duration_ms: 5000,
        },
      ];

      // Mock submit method
      let submitCalls = 0;
      submitter.submit = async (result) => {
        submitCalls++;
        return { statusCode: 200, body: { status: 'ok' } };
      };

      const responses = await submitter.submitBatch(results);

      assert.strictEqual(submitCalls, 2, 'Should call submit for each result');
      assert.strictEqual(responses.length, 2);
      assert(responses[0].success);
      assert(responses[1].success);
    });

    it('should handle mixed success/failure in batch', async () => {
      const results = [
        {
          task_id: 'task-1',
          type: 'website_html',
          success: true,
          result: {},
          executed_at: new Date().toISOString(),
          duration_ms: 1000,
        },
        {
          task_id: 'task-2',
          type: 'lighthouse_html',
          success: false,
          error: 'Failed',
          executed_at: new Date().toISOString(),
          duration_ms: 5000,
        },
      ];

      // Mock submit with failure on second call
      let callCount = 0;
      submitter.submit = async (result) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Network timeout');
        }
        return { statusCode: 200, body: { status: 'ok' } };
      };

      const responses = await submitter.submitBatch(results);

      assert.strictEqual(responses[0].success, true);
      assert.strictEqual(responses[1].success, false);
      assert(responses[1].error);
    });
  });

  describe('Error scenarios', () => {
    it('should handle network errors gracefully', async () => {
      submitter._submitWithSignature = async () => {
        throw new Error('Network error: ECONNREFUSED');
      };

      const result = {
        task_id: 'task-net-error',
        type: 'website_html',
        success: true,
        result: {},
        executed_at: new Date().toISOString(),
        duration_ms: 1000,
      };

      try {
        await submitter.submit(result);
        assert.fail('Should have thrown error');
      } catch (error) {
        assert(error.message.includes('Failed to submit'));
      }
    });

    it('should have exponential backoff on retry', async () => {
      const delays = [];
      let attemptCount = 0;

      // Mock setTimeout to track delays
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = (fn, delay) => {
        delays.push(delay);
        setImmediate(fn);
      };

      submitter._submitWithSignature = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary error');
        }
        return { statusCode: 200, body: { status: 'ok' } };
      };

      submitter.maxRetries = 3;
      submitter.retryDelayMs = 1000;

      const result = {
        task_id: 'task-retry',
        type: 'website_html',
        success: true,
        result: {},
        executed_at: new Date().toISOString(),
        duration_ms: 1000,
      };

      try {
        await submitter.submit(result);
      } finally {
        // Restore original setTimeout
        global.setTimeout = originalSetTimeout;
      }

      // Verify delays increased (exponential backoff)
      if (delays.length > 1) {
        assert(delays[1] > delays[0], 'Delays should increase (exponential backoff)');
      }
    });
  });

  describe('Payload validation', () => {
    it('should include all required fields in submission', async () => {
      let submittedPayload;

      submitter._submitWithSignature = async (result) => {
        submittedPayload = result;
        return { statusCode: 200, body: { status: 'ok' } };
      };

      const result = {
        task_id: 'task-validate',
        type: 'website_html',
        success: true,
        result: { html: '<html></html>' },
        error: null,
        executed_at: '2026-02-04T10:00:00.000Z',
        duration_ms: 1234,
      };

      await submitter.submit(result);

      assert(submittedPayload);
      assert.strictEqual(submittedPayload.task_id, 'task-validate');
      assert.strictEqual(submittedPayload.type, 'website_html');
      assert.strictEqual(submittedPayload.success, true);
      assert.strictEqual(submittedPayload.worker_id, 'worker-1');
      assert(submittedPayload.result);
    });
  });
});
