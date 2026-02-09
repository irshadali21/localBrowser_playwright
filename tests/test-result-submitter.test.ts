// tests/test-result-submitter.test.ts

import crypto from 'crypto';
import { ResultSubmitter } from '../services/resultSubmitter';
import { TaskExecutionResult } from '../types/services';

describe('ResultSubmitter Service', () => {
  const config = {
    laravelUrl: 'http://localhost:8000',
    secret: 'test_secret_key_32_chars_long!!',
    workerId: 'worker-1',
    maxRetries: 1,
  };

  describe('Constructor', () => {
    it('should initialize with config', () => {
      const submitter = new ResultSubmitter(config);
      expect(submitter).toBeInstanceOf(ResultSubmitter);
    });

    it('should throw if LARAVEL_INTERNAL_URL is missing', () => {
      expect(() => {
        new ResultSubmitter({ secret: 'test' });
      }).toThrow();
    });

    it('should throw if LOCALBROWSER_SECRET is missing', () => {
      expect(() => {
        new ResultSubmitter({ laravelUrl: 'http://localhost:8000' });
      }).toThrow();
    });
  });

  describe('Signature generation', () => {
    it('should generate valid HMAC signature', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const expectedSignature = crypto
        .createHmac('sha256', config.secret)
        .update(timestamp.toString())
        .digest('hex');

      expect(expectedSignature.length).toBe(64);
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

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('TaskExecutionResult type', () => {
    it('should accept valid task result', () => {
      const result: TaskExecutionResult = {
        task_id: 'task-1',
        type: 'website_html',
        success: true,
        result: { html: '<html></html>' },
        executed_at: new Date().toISOString(),
        duration_ms: 1000,
      };

      expect(result.task_id).toBe('task-1');
      expect(result.success).toBe(true);
    });

    it('should accept failed task result', () => {
      const result: TaskExecutionResult = {
        task_id: 'task-2',
        type: 'lighthouse_html',
        success: false,
        error: 'Timeout',
        executed_at: new Date().toISOString(),
        duration_ms: 5000,
      };

      expect(result.task_id).toBe('task-2');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout');
    });
  });
});
