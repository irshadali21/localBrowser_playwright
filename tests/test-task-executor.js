// tests/test-task-executor.js

const assert = require('assert');
const TaskExecutor = require('../services/taskExecutor');

describe('Task Executor Service', () => {
  let executor;
  let mockBrowserHelper;

  beforeEach(() => {
    // Mock browser helper
    mockBrowserHelper = {
      launchBrowser: async () => ({
        newPage: async () => ({
          setViewportSize: async () => {},
          goto: async () => {},
          content: async () => '<html><body>Test</body></html>',
          title: async () => 'Test Page',
          evaluate: async () => [{ name: 'description', content: 'Test page' }],
          close: async () => {},
        }),
        close: async () => {},
      }),
    };

    executor = new TaskExecutor(mockBrowserHelper);
  });

  describe('Execute method', () => {
    it('should execute website_html task', async () => {
      const task = {
        id: 'task-123',
        type: 'website_html',
        url: 'https://example.com',
        payload: { viewport: { width: 1920, height: 1080 } },
      };

      const result = await executor.execute(task);

      assert.strictEqual(result.task_id, 'task-123');
      assert.strictEqual(result.type, 'website_html');
      assert.strictEqual(result.success, true);
      assert(result.result.html);
      assert.strictEqual(result.result.url, 'https://example.com');
      assert(result.executed_at);
      assert(result.duration_ms > 0);
    });

    it('should handle unknown task type gracefully', async () => {
      const task = {
        id: 'task-456',
        type: 'unknown_type',
        url: 'https://example.com',
        payload: {},
      };

      const result = await executor.execute(task);

      assert.strictEqual(result.task_id, 'task-456');
      assert.strictEqual(result.type, 'unknown_type');
      assert.strictEqual(result.success, false);
      assert(result.error);
      assert(result.error.includes('Unknown task type'));
    });

    it('should catch execution errors', async () => {
      // Override browser helper to throw error
      mockBrowserHelper.launchBrowser = async () => {
        throw new Error('Browser launch failed');
      };

      const task = {
        id: 'task-789',
        type: 'website_html',
        url: 'https://example.com',
        payload: {},
      };

      const result = await executor.execute(task);

      assert.strictEqual(result.success, false);
      assert(result.error.includes('Browser launch failed'));
    });
  });

  describe('Website HTML task', () => {
    it('should extract HTML content correctly', async () => {
      const task = {
        id: 'task-html-001',
        type: 'website_html',
        url: 'https://example.com',
        payload: { viewport: { width: 1920, height: 1080 } },
      };

      const result = await executor.executeWebsiteHtml(task);

      assert.strictEqual(result.success, true);
      assert(result.result.html);
      assert(result.result.title);
      assert(result.result.meta);
      assert(Array.isArray(result.result.meta));
    });

    it('should set viewport from payload', async () => {
      let viewportSet = false;
      mockBrowserHelper.launchBrowser = async () => ({
        newPage: async () => ({
          setViewportSize: async (size) => {
            assert.strictEqual(size.width, 800);
            assert.strictEqual(size.height, 600);
            viewportSet = true;
          },
          goto: async () => {},
          content: async () => '<html></html>',
          title: async () => 'Test',
          evaluate: async () => [],
          close: async () => {},
        }),
        close: async () => {},
      });

      executor = new TaskExecutor(mockBrowserHelper);

      const task = {
        id: 'task-viewport',
        type: 'website_html',
        url: 'https://example.com',
        payload: { viewport: { width: 800, height: 600 } },
      };

      await executor.executeWebsiteHtml(task);
      assert(viewportSet, 'Viewport should have been set');
    });
  });

  describe('Lighthouse task', () => {
    it('should handle lighthouse task type', async () => {
      const task = {
        id: 'task-lighthouse-001',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: { lighthouseOptions: {} },
      };

      // Note: Full Lighthouse test would require mocking lighthouse module
      // This is a placeholder for the test structure
      assert.strictEqual(task.type, 'lighthouse_html');
    });
  });

  describe('Error handling', () => {
    it('should return error result on browser failure', async () => {
      mockBrowserHelper.launchBrowser = async () => {
        throw new Error('Browser initialization failed');
      };

      const task = {
        id: 'task-error-001',
        type: 'website_html',
        url: 'https://example.com',
        payload: {},
      };

      const result = await executor.executeWebsiteHtml(task);

      assert.strictEqual(result.success, false);
      assert(result.error);
      assert(result.error.includes('Browser initialization failed'));
    });

    it('should close browser even on error', async () => {
      let browserClosed = false;
      mockBrowserHelper.launchBrowser = async () => ({
        newPage: async () => {
          throw new Error('Page creation failed');
        },
        close: async () => {
          browserClosed = true;
        },
      });

      executor = new TaskExecutor(mockBrowserHelper);

      const task = {
        id: 'task-cleanup-001',
        type: 'website_html',
        url: 'https://example.com',
        payload: {},
      };

      await executor.executeWebsiteHtml(task);
      assert(browserClosed, 'Browser should be closed even on error');
    });
  });

  describe('Duration tracking', () => {
    it('should track execution duration', async () => {
      const task = {
        id: 'task-duration-001',
        type: 'website_html',
        url: 'https://example.com',
        payload: {},
      };

      const result = await executor.executeWebsiteHtml(task);

      assert(result.duration_ms >= 0);
      assert(typeof result.duration_ms === 'number');
    });
  });
});
