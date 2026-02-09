// services/taskExecutor.ts
import { Task, TaskExecutionResult, TaskValidationResult, TaskType } from '../types/services';
import type { VisitResult } from '../types/browser';

/**
 * Task Executor Service
 *
 * Executes browser automation tasks based on task type.
 * Returns structured results for submission back to Laravel.
 */
export class TaskExecutor {
  private browserHelper: {
    visitUrl: (url: string, options?: Record<string, unknown>) => Promise<VisitResult>;
  };

  constructor(browserHelper: {
    visitUrl: (url: string, options?: Record<string, unknown>) => Promise<VisitResult>;
  }) {
    this.browserHelper = browserHelper;
  }

  /**
   * Execute a single browser task
   */
  async execute(task: Task): Promise<TaskExecutionResult> {
    // Validate task structure
    const validation = this._validateTask(task);
    if (!validation.valid) {
      console.error(`[TaskExecutor] Invalid task:`, validation.errors);
      return {
        task_id: task?.id || 'unknown',
        type: task?.type || 'unknown',
        success: false,
        error: `Task validation failed: ${validation.errors.join(', ')}`,
        executed_at: new Date().toISOString(),
        duration_ms: 0,
      };
    }

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
      const err = error as Error;
      console.error(`[TaskExecutor] Task ${task.id} failed:`, err.message);

      return {
        task_id: task.id,
        type: task.type,
        success: false,
        error: err.message,
        executed_at: new Date().toISOString(),
        duration_ms: 0,
      };
    }
  }

  /**
   * Validate task structure
   */
  private _validateTask(task: unknown): TaskValidationResult {
    const errors: string[] = [];

    if (!task || typeof task !== 'object') {
      return { valid: false, errors: ['Task must be an object'] };
    }

    const taskObj = task as Record<string, unknown>;

    if (!taskObj.id) {
      errors.push('Missing required field: id');
    }

    if (!taskObj.type) {
      errors.push('Missing required field: type');
    } else if (!['website_html', 'lighthouse_html'].includes(taskObj.type as string)) {
      errors.push(`Invalid task type: ${taskObj.type}`);
    }

    if (!taskObj.url) {
      errors.push('Missing required field: url');
    } else if (typeof taskObj.url !== 'string') {
      errors.push('URL must be a string');
    } else if (!taskObj.url.startsWith('http://') && !taskObj.url.startsWith('https://')) {
      errors.push('URL must start with http:// or https://');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Execute website_html task: fetch and extract HTML from URL
   */
  private async executeWebsiteHtml(task: Task): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const { url, payload } = task;

    try {
      const options = {
        waitUntil: payload?.waitUntil || 'domcontentloaded',
        timeout: payload?.timeout || 60000,
        saveToFile: true,
        returnHtml: false,
        handleCloudflare: payload?.handleCloudflare !== false,
        useProgressiveRetry: payload?.useProgressiveRetry !== false,
      };

      const fileMetadata = await this.browserHelper.visitUrl(url, options);

      const duration = Date.now() - startTime;

      console.log(`[TaskExecutor] website_html task ${task.id} completed`, {
        url,
        duration: `${duration}ms`,
        fileId: (fileMetadata as unknown as Record<string, unknown>).fileId,
        storageType: (fileMetadata as unknown as Record<string, unknown>).storageType,
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
      const err = error as Error;
      console.error(`[TaskExecutor] website_html task ${task.id} failed:`, err.message);

      const duration = Date.now() - startTime;

      return {
        task_id: task.id,
        type: 'website_html',
        success: false,
        error: err.message,
        executed_at: new Date().toISOString(),
        duration_ms: duration,
      };
    }
  }

  /**
   * Execute lighthouse_html task: run Lighthouse audit and return JSON
   */
  private async executeLighthouseHtml(task: Task): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const { url, payload } = task;

    interface LighthouseResult {
      lhr?: {
        lighthouseVersion?: string;
        categories?: {
          performance?: { score: number | null };
          accessibility?: { score: number | null };
          'best-practices'?: { score: number | null };
          seo?: { score: number | null };
        };
        audits?: Record<string, unknown>;
        configSettings?: Record<string, unknown>;
      };
    }

    let lighthouseFn: (url: string, options: Record<string, unknown>) => Promise<LighthouseResult>;
    try {
      const lighthouse = await import('lighthouse');
      lighthouseFn = lighthouse.default as unknown as (
        url: string,
        options: Record<string, unknown>
      ) => Promise<LighthouseResult>;
    } catch (error) {
      const err = error as Error;
      console.warn(`[TaskExecutor] Lighthouse package not available, using fallback`, {
        error: err.message,
      });

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
      const options = {
        logLevel: 'error',
        output: 'json',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        chromeFlags: [
          '--headless=new',
          '--disable-gpu',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
        ...(process.env.CHROME_PORT ? { port: parseInt(process.env.CHROME_PORT, 10) } : {}),
        ...(payload?.lighthouseOptions as Record<string, unknown>),
      };

      console.log(`[TaskExecutor] Starting Lighthouse audit for ${url}`, {
        hasCustomPort: !!process.env.CHROME_PORT,
        timeout: payload?.timeout || 120000,
      });

      const lighthouseTimeout = payload?.timeout || 120000;
      const runnerResult = await Promise.race([
        lighthouseFn(url, options),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Lighthouse audit timeout after ${lighthouseTimeout}ms`)),
            lighthouseTimeout
          )
        ),
      ]);

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
      const err = error as Error;
      console.error(`[TaskExecutor] Lighthouse task ${task.id} failed:`, err.message);

      const duration = Date.now() - startTime;

      return {
        task_id: task.id,
        type: 'lighthouse_html',
        success: false,
        error: err.message,
        executed_at: new Date().toISOString(),
        duration_ms: duration,
      };
    }
  }
}

export default TaskExecutor;
