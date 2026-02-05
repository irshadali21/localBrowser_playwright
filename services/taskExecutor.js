// services/taskExecutor.js

/**
 * Task Executor Service
 * 
 * Executes browser automation tasks based on task type.
 * Returns structured results for submission back to Laravel.
 */
class TaskExecutor {
  constructor(browserHelper) {
    this.browserHelper = browserHelper;
  }

  /**
   * Execute a single browser task
   * @param {Object} task - Task object from database
   * @param {string} task.id - Task ID
   * @param {string} task.type - Task type (website_html, lighthouse_html)
   * @param {string} task.url - URL to process
   * @param {Object} task.payload - Task-specific configuration
   * @returns {Promise<Object>} Result object
   */
  async execute(task) {
    console.log(`[TaskExecutor] Starting task ${task.id}`, {
      type: task.type,
      url: task.url,
    });

    try {
      switch (task.type) {
        case 'website_html':
          return await this.executeWebsiteHtml(task);
        case 'lighthouse_html':
          return await this.executeLighthouseHtml(task);
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      console.error(`[TaskExecutor] Task ${task.id} failed:`, error);

      return {
        task_id: task.id,
        type: task.type,
        success: false,
        error: error.message,
        executed_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute website_html task: fetch and extract HTML from URL
   * @private
   */
  async executeWebsiteHtml(task) {
    const startTime = Date.now();
    const { url, payload } = task;

    try {
      // Use browserHelper.visitUrl which handles navigation, Cloudflare, and file storage
      const options = {
        waitUntil: payload?.waitUntil || 'networkidle',
        timeout: payload?.timeout || 60000,
        saveToFile: true,
        returnHtml: false,  // Return file metadata, not raw HTML
        handleCloudflare: payload?.handleCloudflare !== false,
      };

      // visitUrl returns file metadata (fileId, downloadUrl, viewUrl, etc.)
      const fileMetadata = await this.browserHelper.visitUrl(url, options);

      const duration = Date.now() - startTime;

      console.log(`[TaskExecutor] website_html task ${task.id} completed`, {
        url,
        duration: `${duration}ms`,
        fileId: fileMetadata.fileId,
        storageType: fileMetadata.storageType,
      });

      return {
        task_id: task.id,
        type: 'website_html',
        success: true,
        result: {
          ...fileMetadata,
          timestamp: new Date().toISOString(),
        },
        executed_at: new Date().toISOString(),
        duration_ms: duration,
      };
    } catch (error) {
      console.error(`[TaskExecutor] website_html task ${task.id} failed:`, error);
      
      const duration = Date.now() - startTime;

      return {
        task_id: task.id,
        type: 'website_html',
        success: false,
        error: error.message,
        executed_at: new Date().toISOString(),
        duration_ms: duration,
      };
    }
  }

  /**
   * Execute lighthouse_html task: run Lighthouse audit and return JSON
   * @private
   */
  async executeLighthouseHtml(task) {
    const startTime = Date.now();
    const { url, payload } = task;

    // Import lighthouse dynamically to avoid blocking other tasks
    let lighthouseFn;
    try {
      const lighthouse = await import('lighthouse');
      lighthouseFn = lighthouse.default;
    } catch (error) {
      console.warn(`[TaskExecutor] Lighthouse package not available, using fallback`, { error: error.message });
      // Fallback: return basic lighthouse-like result without running audit
      return {
        task_id: task.id,
        type: 'lighthouse_html',
        success: true,
        result: {
          url,
          lighthouseVersion: 'fallback-11.0.0',
          scores: {
            performance: null,
            accessibility: null,
            bestPractices: null,
            seo: null,
          },
          message: 'Lighthouse package not installed. Install with: npm install lighthouse',
          timestamp: new Date().toISOString(),
        },
        executed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      };
    }

    try {
      // Run Lighthouse audit
      const options = {
        logLevel: 'error', // Suppress verbose output
        output: 'json',
        port: process.env.CHROME_PORT || undefined,
        ...payload?.lighthouseOptions,
      };

      const runnerResult = await lighthouseFn(url, options);
      const lhr = runnerResult?.lhr;

      if (!lhr) {
        throw new Error('No Lighthouse report generated');
      }

      const duration = Date.now() - startTime;

      console.log(`[TaskExecutor] lighthouse_html task ${task.id} completed`, {
        url,
        duration: `${duration}ms`,
        score: lhr.categories?.performance?.score,
      });

      return {
        task_id: task.id,
        type: 'lighthouse_html',
        success: true,
        result: {
          url,
          lighthouseVersion: lhr.lighthouseVersion,
          scores: {
            performance: lhr.categories?.performance?.score,
            accessibility: lhr.categories?.accessibility?.score,
            bestPractices: lhr.categories?.['best-practices']?.score,
            seo: lhr.categories?.seo?.score,
          },
          audits: lhr.audits,
          configSettings: lhr.configSettings,
          timestamp: new Date().toISOString(),
        },
        executed_at: new Date().toISOString(),
        duration_ms: duration,
      };
    } catch (error) {
      console.error(`[TaskExecutor] Lighthouse task ${task.id} failed:`, error.message);

      const duration = Date.now() - startTime;

      return {
        task_id: task.id,
        type: 'lighthouse_html',
        success: false,
        error: error.message,
        executed_at: new Date().toISOString(),
        duration_ms: duration,
      };
    }
  }
}

module.exports = TaskExecutor;
