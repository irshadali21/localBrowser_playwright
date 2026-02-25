// tests/test-pagespeed.js

/**
 * Test Suite for pagespeed.web.dev Lighthouse Integration
 * 
 * This test verifies that the TaskExecutor correctly uses pagespeed.web.dev
 * instead of the local Lighthouse package for performance analysis.
 */

const assert = require('assert');
const TaskExecutor = require('../services/taskExecutor');

describe('pagespeed.web.dev Integration', () => {
  let executor;
  let mockBrowserHelper;

  /**
   * Creates a mock page with configurable responses
   * @param {Object} options - Configuration for mock page behavior
   * @returns {Object} Mock page object
   */
  const createMockPage = (options = {}) => {
    const {
      score = 0.85,
      gotoSuccess = true,
      selectorsWork = true,
    } = options;

    return {
      goto: async (url) => {
        if (!gotoSuccess) {
          throw new Error('Navigation failed');
        }
        // Verify URL format
        assert(url.includes('pagespeed.web.dev'), 'Should navigate to pagespeed.web.dev');
        assert(url.includes('form_factor=mobile') || url.includes('form_factor=desktop'), 
          'Should specify form factor');
        return { ok: gotoSuccess };
      },
      waitForSelector: async (selector, opts = {}) => {
        if (!selectorsWork) {
          throw new Error('Selector not found');
        }
        return true;
      },
      waitForTimeout: async (ms) => {
        // Minimal timeout for testing
        return;
      },
      $: async (selector) => {
        if (!selectorsWork) return null;
        // Return mock element
        return {
          textContent: async () => `${Math.round(score * 100)}`,
        };
      },
      content: async () => {
        if (!selectorsWork) return '<html></html>';
        return `<html><body><div class="gauge"><span class="score">${Math.round(score * 100)}</span></div></body></html>`;
      },
      evaluate: async (fn) => {
        if (!selectorsWork) {
          return {
            scores: { performance: null, accessibility: null, bestPractices: null, seo: null },
            coreWebVitals: { lcp: null, inp: null, cls: null, assessment: null },
            metrics: { fcp: null, ttfb: null },
            htmlReportUrl: null
          };
        }
        // Return mock data in the new structure format
        return {
          scores: {
            performance: score,
            accessibility: score - 0.05,
            bestPractices: score - 0.03,
            seo: score - 0.08
          },
          coreWebVitals: {
            lcp: '2.5s',
            inp: '200ms',
            cls: '0.05',
            assessment: 'Passed'
          },
          metrics: {
            fcp: '1.8s',
            ttfb: '0.5s'
          },
          htmlReportUrl: 'https://pagespeed.web.dev/report?url=https://example.com&form_factor=mobile'
        };
      },
      close: async () => {},
    };
  };

  beforeEach(() => {
    // Mock browser helper with working browser
    mockBrowserHelper = {
      getPage: async () => ({
        page: createMockPage({ score: 0.85 }),
        id: 'mock-page-id'
      }),
    };

    executor = new TaskExecutor(mockBrowserHelper);
  });

  describe('executeLighthouseHtml', () => {
    const validTask = {
      id: 'test-lighthouse-001',
      type: 'lighthouse_html',
      url: 'https://example.com',
      payload: {},
    };

    it('should successfully execute lighthouse task with pagespeed.web.dev', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert.strictEqual(result.success, true, 'Task should complete successfully');
      assert.strictEqual(result.type, 'lighthouse_html');
      assert.strictEqual(result.task_id, 'test-lighthouse-001');
    });

    it('should return results from pagespeed.web.dev source', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert.strictEqual(
        result.result.source,
        'pagespeed.web.dev',
        'Source should be pagespeed.web.dev'
      );
    });

    it('should include mobile performance score in result', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        result.result.mobile,
        'Result should contain mobile object'
      );
      assert(
        typeof result.result.mobile.scores?.performance === 'number' || result.result.mobile.scores?.performance === null,
        'Mobile performance should be a number or null'
      );
    });

    it('should include mobile core web vitals in result', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        result.result.mobile,
        'Result should contain mobile object'
      );
      assert(
        result.result.mobile.coreWebVitals,
        'Mobile should contain coreWebVitals'
      );
      // Core web vitals should have lcp, inp, cls, assessment
      assert(
        'lcp' in result.result.mobile.coreWebVitals,
        'Mobile coreWebVitals should have lcp'
      );
      assert(
        'inp' in result.result.mobile.coreWebVitals,
        'Mobile coreWebVitals should have inp'
      );
      assert(
        'cls' in result.result.mobile.coreWebVitals,
        'Mobile coreWebVitals should have cls'
      );
      assert(
        'assessment' in result.result.mobile.coreWebVitals,
        'Mobile coreWebVitals should have assessment'
      );
    });

    it('should include mobile metrics (FCP, TTFB) in result', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        result.result.mobile,
        'Result should contain mobile object'
      );
      assert(
        result.result.mobile.metrics,
        'Mobile should contain metrics'
      );
      assert(
        'fcp' in result.result.mobile.metrics,
        'Mobile metrics should have fcp'
      );
      assert(
        'ttfb' in result.result.mobile.metrics,
        'Mobile metrics should have ttfb'
      );
    });

    it('should include mobile category scores in result', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        result.result.mobile,
        'Result should contain mobile object'
      );
      assert(
        result.result.mobile.scores,
        'Mobile should contain scores'
      );
      assert(
        'accessibility' in result.result.mobile.scores,
        'Mobile scores should have accessibility'
      );
      assert(
        'bestPractices' in result.result.mobile.scores,
        'Mobile scores should have bestPractices'
      );
      assert(
        'seo' in result.result.mobile.scores,
        'Mobile scores should have seo'
      );
    });

    it('should include mobile HTML report URL in result', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        result.result.mobile,
        'Result should contain mobile object'
      );
      assert(
        result.result.mobile.htmlReportUrl,
        'Mobile should contain htmlReportUrl'
      );
      assert(
        typeof result.result.mobile.htmlReportUrl === 'string',
        'Mobile htmlReportUrl should be a string'
      );
      assert(
        result.result.mobile.htmlReportUrl.includes('pagespeed.web.dev'),
        'Mobile htmlReportUrl should contain pagespeed.web.dev'
      );
    });

    it('should include desktop performance score in result', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        result.result.desktop,
        'Result should contain desktop object'
      );
      assert(
        typeof result.result.desktop.scores?.performance === 'number' || result.result.desktop.scores?.performance === null,
        'Desktop performance should be a number or null'
      );
    });

    it('should include desktop core web vitals in result', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        result.result.desktop,
        'Result should contain desktop object'
      );
      assert(
        result.result.desktop.coreWebVitals,
        'Desktop should contain coreWebVitals'
      );
    });

    it('should include desktop metrics (FCP, TTFB) in result', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        result.result.desktop,
        'Result should contain desktop object'
      );
      assert(
        result.result.desktop.metrics,
        'Desktop should contain metrics'
      );
    });

    it('should include desktop category scores in result', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        result.result.desktop,
        'Result should contain desktop object'
      );
      assert(
        result.result.desktop.scores,
        'Desktop should contain scores'
      );
    });

    it('should include desktop HTML report URL in result', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        result.result.desktop,
        'Result should contain desktop object'
      );
      assert(
        result.result.desktop.htmlReportUrl,
        'Desktop should contain htmlReportUrl'
      );
    });

    it('should include scores object with performance metric', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        result.result.mobile?.scores,
        'Result should contain mobile scores object'
      );
      assert(
        'performance' in result.result.mobile.scores,
        'Mobile scores should include performance metric'
      );
    });

    it('should include timestamp in result', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        result.result.timestamp,
        'Result should include timestamp'
      );
      assert(
        new Date(result.result.timestamp).getTime() > 0,
        'Timestamp should be valid date'
      );
    });

    it('should include executed_at timestamp', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        result.executed_at,
        'Result should include executed_at'
      );
    });

    it('should include duration_ms', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert(
        typeof result.duration_ms === 'number',
        'Duration should be a number'
      );
      assert(
        result.duration_ms >= 0,
        'Duration should be non-negative'
      );
    });

    it('should include original URL in result', async () => {
      const result = await executor.executeLighthouseHtml(validTask);

      assert.strictEqual(
        result.result.url,
        'https://example.com',
        'Result should include original URL'
      );
    });
  });

  describe('URL validation and formatting', () => {
    it('should handle HTTPS URLs correctly', async () => {
      let capturedUrl;
      
      mockBrowserHelper.getPage = async () => ({
        page: {
          ...createMockPage(),
          goto: async (url) => {
            capturedUrl = url;
            return { ok: true };
          },
        },
        id: 'mock-page-id'
      });

      executor = new TaskExecutor(mockBrowserHelper);

      await executor.executeLighthouseHtml({
        id: 'test-https',
        type: 'lighthouse_html',
        url: 'https://secure.example.com',
        payload: {},
      });

      assert(capturedUrl.includes('url='), 'URL should be encoded');
      assert(capturedUrl.includes('secure.example.com'), 'URL should contain the target');
    });

    it('should handle HTTP URLs correctly', async () => {
      let capturedUrl;
      
      mockBrowserHelper.getPage = async () => ({
        page: {
          ...createMockPage(),
          goto: async (url) => {
            capturedUrl = url;
            return { ok: true };
          },
        },
        id: 'mock-page-id'
      });

      executor = new TaskExecutor(mockBrowserHelper);

      await executor.executeLighthouseHtml({
        id: 'test-http',
        type: 'lighthouse_html',
        url: 'http://insecure.example.com',
        payload: {},
      });

      assert(capturedUrl.includes('http%3A%2F%2F'), 'HTTP URL should be properly encoded');
    });

    it('should handle URLs with query parameters', async () => {
      let capturedUrl;
      
      mockBrowserHelper.getPage = async () => ({
        page: {
          ...createMockPage(),
          goto: async (url) => {
            capturedUrl = url;
            return { ok: true };
          },
        },
        id: 'mock-page-id'
      });

      executor = new TaskExecutor(mockBrowserHelper);

      await executor.executeLighthouseHtml({
        id: 'test-query',
        type: 'lighthouse_html',
        url: 'https://example.com/page?foo=bar&baz=qux',
        payload: {},
      });

      assert(capturedUrl.includes('example.com%2Fpage'), 'Query parameters should be encoded');
    });

    it('should handle URLs with special characters', async () => {
      let capturedUrl;
      
      mockBrowserHelper.getPage = async () => ({
        page: {
          ...createMockPage(),
          goto: async (url) => {
            capturedUrl = url;
            return { ok: true };
          },
        },
        id: 'mock-page-id'
      });

      executor = new TaskExecutor(mockBrowserHelper);

      await executor.executeLighthouseHtml({
        id: 'test-special',
        type: 'lighthouse_html',
        url: 'https://example.com/page/测试',
        payload: {},
      });

      assert(capturedUrl, 'URL with special characters should be encoded');
    });
  });

  describe('Form factor handling', () => {
    it('should fetch mobile scores with mobile form factor', async () => {
      const mobileUrls = [];
      
      mockBrowserHelper.getPage = async () => ({
        page: {
          ...createMockPage({ score: 0.75 }),
          goto: async (url) => {
            mobileUrls.push(url);
            return { ok: true };
          },
        },
        id: 'mock-page-id'
      });

      executor = new TaskExecutor(mockBrowserHelper);

      await executor.executeLighthouseHtml({
        id: 'test-mobile',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      const mobileUrl = mobileUrls.find(u => u.includes('form_factor=mobile'));
      assert(mobileUrl, 'Should have visited mobile URL');
    });

    it('should fetch desktop scores with desktop form factor', async () => {
      const desktopUrls = [];
      
      mockBrowserHelper.getPage = async () => ({
        page: {
          ...createMockPage({ score: 0.90 }),
          goto: async (url) => {
            desktopUrls.push(url);
            return { ok: true };
          },
        },
        id: 'mock-page-id'
      });

      executor = new TaskExecutor(mockBrowserHelper);

      await executor.executeLighthouseHtml({
        id: 'test-desktop',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      const desktopUrl = desktopUrls.find(u => u.includes('form_factor=desktop'));
      assert(desktopUrl, 'Should have visited desktop URL');
    });
  });

  describe('Score range validation', () => {
    it('should return scores between 0 and 1 when successful', async () => {
      mockBrowserHelper.getPage = async () => ({
        page: createMockPage({ score: 0.95 }),
        id: 'mock-page-id'
      });

      executor = new TaskExecutor(mockBrowserHelper);

      const result = await executor.executeLighthouseHtml({
        id: 'test-range',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      if (result.success && result.result.mobile?.scores?.performance !== null) {
        assert(
          result.result.mobile.scores.performance >= 0 && result.result.mobile.scores.performance <= 1,
          'Mobile score should be between 0 and 1'
        );
      }

      if (result.success && result.result.desktop?.scores?.performance !== null) {
        assert(
          result.result.desktop.scores.performance >= 0 && result.result.desktop.scores.performance <= 1,
          'Desktop score should be between 0 and 1'
        );
      }
    });

    it('should handle null scores gracefully', async () => {
      mockBrowserHelper.getPage = async () => ({
        page: createMockPage({ selectorsWork: false }),
        id: 'mock-page-id'
      });

      executor = new TaskExecutor(mockBrowserHelper);

      const result = await executor.executeLighthouseHtml({
        id: 'test-null',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      // Should still return success with null scores
      assert.strictEqual(result.success, true);
      assert(
        result.result.mobile.scores?.performance === null || 
        typeof result.result.mobile.scores?.performance === 'number',
        'Mobile score should be null or number'
      );
    });
  });

  describe('Error handling', () => {
    it('should handle browser unavailable error', async () => {
      mockBrowserHelper.getPage = async () => {
        throw new Error('Browser not available');
      };

      executor = new TaskExecutor(mockBrowserHelper);

      const result = await executor.executeLighthouseHtml({
        id: 'test-no-browser',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      assert.strictEqual(result.success, false);
      assert(result.error);
      assert(result.error.includes('Browser not available'));
    });

    it('should handle navigation errors gracefully', async () => {
      mockBrowserHelper.getPage = async () => ({
        page: createMockPage({ gotoSuccess: false }),
        id: 'mock-page-id'
      });

      executor = new TaskExecutor(mockBrowserHelper);

      const result = await executor.executeLighthouseHtml({
        id: 'test-nav-error',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      assert.strictEqual(result.success, false);
      assert(result.error);
    });

    it('should include task_id in error response', async () => {
      mockBrowserHelper.getPage = async () => {
        throw new Error('Browser not available');
      };

      executor = new TaskExecutor(mockBrowserHelper);

      const result = await executor.executeLighthouseHtml({
        id: 'test-error-id',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      assert.strictEqual(result.task_id, 'test-error-id');
    });

    it('should include type in error response', async () => {
      mockBrowserHelper.getPage = async () => {
        throw new Error('Browser not available');
      };

      executor = new TaskExecutor(mockBrowserHelper);

      const result = await executor.executeLighthouseHtml({
        id: 'test-error-type',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      assert.strictEqual(result.type, 'lighthouse_html');
    });

    it('should include executed_at even on error', async () => {
      mockBrowserHelper.getPage = async () => {
        throw new Error('Browser not available');
      };

      executor = new TaskExecutor(mockBrowserHelper);

      const result = await executor.executeLighthouseHtml({
        id: 'test-error-time',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      assert(result.executed_at);
    });

    it('should close page on error', async () => {
      let pageClosed = false;
      
      // Create a mock page that throws an error on navigation but has all required methods
      const mockPage = {
        goto: async () => {
          throw new Error('Navigation failed');
        },
        waitForSelector: async () => true,
        waitForTimeout: async () => {},
        $: async () => null,
        content: async () => '<html></html>',
        evaluate: async () => ({}),
        close: async () => {
          pageClosed = true;
        },
      };
      
      // Mock closePage to be called
      const originalClosePage = require('../utils/pageManager').closePage;
      require('../utils/pageManager').closePage = async (pageId) => {
        pageClosed = true;
      };
      
      mockBrowserHelper.getPage = async () => ({
        page: mockPage,
        id: 'mock-page-id'
      });

      executor = new TaskExecutor(mockBrowserHelper);

      await executor.executeLighthouseHtml({
        id: 'test-cleanup',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      // Restore original closePage
      require('../utils/pageManager').closePage = originalClosePage;
      
      assert(pageClosed, 'Page should be closed even on error');
    });
  });

  describe('Integration with task validation', () => {
    it('should validate task before execution', async () => {
      // This tests the execute() method which validates first
      const result = await executor.execute({
        id: 'test-validation',
        type: 'lighthouse_html',
        url: 'not-a-url',  // Invalid URL
        payload: {},
      });

      assert.strictEqual(result.success, false);
      assert(result.error.includes('validation failed'));
    });

    it('should reject missing URL', async () => {
      const result = await executor.execute({
        id: 'test-no-url',
        type: 'lighthouse_html',
        // Missing url
        payload: {},
      });

      assert.strictEqual(result.success, false);
      assert(result.error.includes('Missing required field'));
    });

    it('should reject invalid task type', async () => {
      const result = await executor.execute({
        id: 'test-invalid-type',
        type: 'invalid_type',
        url: 'https://example.com',
        payload: {},
      });

      assert.strictEqual(result.success, false);
      assert(result.error.includes('Invalid task type'));
    });

    it('should reject URL without http prefix', async () => {
      const result = await executor.execute({
        id: 'test-no-http',
        type: 'lighthouse_html',
        url: 'example.com',  // Missing http://
        payload: {},
      });

      assert.strictEqual(result.success, false);
      assert(result.error.includes('URL must start with'));
    });
  });

  describe('Result structure verification', () => {
    it('should have correct result structure for successful task', async () => {
      const result = await executor.executeLighthouseHtml({
        id: 'test-structure',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      // Verify top-level structure
      assert.ok(result.task_id);
      assert.ok(result.type);
      assert.strictEqual(result.success, true);
      assert.ok(result.result);
      assert.ok(result.executed_at);
      assert.ok(typeof result.duration_ms === 'number');

      // Verify result object structure
      const { result: r } = result;
      assert.ok(r.url);
      assert.ok(r.source);
      assert.ok(r.mobile);
      assert.ok(r.desktop);
      assert.ok(r.timestamp);
      // Verify mobile has scores
      assert.ok(r.mobile.scores);
      // Verify desktop has scores
      assert.ok(r.desktop.scores);
    });

    it('should match expected response schema', async () => {
      const result = await executor.executeLighthouseHtml({
        id: 'test-schema',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      const expectedKeys = ['task_id', 'type', 'success', 'result', 'executed_at', 'duration_ms'];
      const actualKeys = Object.keys(result).sort();
      
      expectedKeys.forEach(key => {
        assert(actualKeys.includes(key), `Result should contain ${key}`);
      });
    });

    it('should match expected result.result schema', async () => {
      const result = await executor.executeLighthouseHtml({
        id: 'test-result-schema',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      const expectedKeys = ['url', 'source', 'mobile', 'desktop', 'timestamp'];
      const actualKeys = Object.keys(result.result).sort();
      
      expectedKeys.forEach(key => {
        assert(actualKeys.includes(key), `Result.result should contain ${key}`);
      });
      // Also verify mobile and desktop have the required nested structure
      assert.ok(result.result.mobile.scores, 'Mobile should have scores');
      assert.ok(result.result.mobile.coreWebVitals, 'Mobile should have coreWebVitals');
      assert.ok(result.result.mobile.metrics, 'Mobile should have metrics');
      assert.ok(result.result.desktop.scores, 'Desktop should have scores');
      assert.ok(result.result.desktop.coreWebVitals, 'Desktop should have coreWebVitals');
      assert.ok(result.result.desktop.metrics, 'Desktop should have metrics');
    });
  });

  describe('Payload handling', () => {
    it('should accept empty payload', async () => {
      const result = await executor.executeLighthouseHtml({
        id: 'test-empty-payload',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {},
      });

      assert.strictEqual(result.success, true);
    });

    it('should accept payload with options', async () => {
      const result = await executor.executeLighthouseHtml({
        id: 'test-options-payload',
        type: 'lighthouse_html',
        url: 'https://example.com',
        payload: {
          timeout: 30000,
          waitUntil: 'networkidle',
        },
      });

      assert.strictEqual(result.success, true);
    });
  });
});

describe('pagespeed.web.dev URL Generation', () => {
  let mockBrowserHelper;
  let capturedUrls;

  beforeEach(() => {
    capturedUrls = [];
    mockBrowserHelper = {
      getPage: async () => ({
        page: {
          goto: async (url) => {
            capturedUrls.push(url);
            return { ok: true };
          },
          waitForSelector: async () => true,
          waitForTimeout: async () => {},
          $: async () => null,
          content: async () => '<html><body>Test</body></html>',
          evaluate: async () => [],
          close: async () => {},
        },
        id: 'mock-page-id'
      }),
    };
  });

  it('should generate correct mobile URL', async () => {
    const executor = new TaskExecutor(mockBrowserHelper);
    
    await executor.executeLighthouseHtml({
      id: 'url-test-mobile',
      type: 'lighthouse_html',
      url: 'https://example.com',
      payload: {},
    });

    const mobileUrl = capturedUrls.find(u => u.includes('form_factor=mobile'));
    assert.ok(mobileUrl, 'Should generate mobile URL');
    assert(mobileUrl.includes('https://pagespeed.web.dev/analysis'), 'Should use pagespeed.web.dev');
  });

  it('should generate correct desktop URL', async () => {
    const executor = new TaskExecutor(mockBrowserHelper);
    
    await executor.executeLighthouseHtml({
      id: 'url-test-desktop',
      type: 'lighthouse_html',
      url: 'https://example.com',
      payload: {},
    });

    const desktopUrl = capturedUrls.find(u => u.includes('form_factor=desktop'));
    assert.ok(desktopUrl, 'Should generate desktop URL');
    assert(desktopUrl.includes('https://pagespeed.web.dev/analysis'), 'Should use pagespeed.web.dev');
  });

  it('should URL-encode the target URL', async () => {
    const executor = new TaskExecutor(mockBrowserHelper);
    
    await executor.executeLighthouseHtml({
      id: 'url-encode-test',
      type: 'lighthouse_html',
      url: 'https://example.com/path?query=value',
      payload: {},
    });

    capturedUrls.forEach(url => {
      // URL should be encoded
      assert(url.includes('url='), 'URL should contain encoded parameter');
    });
  });
});
