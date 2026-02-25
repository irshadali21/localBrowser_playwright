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
   * Validate task structure
   * @private
   */
  _validateTask(task) {
    const errors = [];

    if (!task || typeof task !== 'object') {
      return { valid: false, errors: ['Task must be an object'] };
    }

    if (!task.id) {
      errors.push('Missing required field: id');
    }

    if (!task.type) {
      errors.push('Missing required field: type');
    } else if (!['website_html', 'lighthouse_html'].includes(task.type)) {
      errors.push(`Invalid task type: ${task.type}`);
    }

    if (!task.url) {
      errors.push('Missing required field: url');
    } else if (typeof task.url !== 'string') {
      errors.push('URL must be a string');
    } else if (!task.url.startsWith('http://') && !task.url.startsWith('https://')) {
      errors.push('URL must start with http:// or https://');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
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
        waitUntil: payload?.waitUntil || 'domcontentloaded',  // Changed from 'networkidle' for better reliability
        timeout: payload?.timeout || 60000,
        saveToFile: true,
        returnHtml: false,  // Return file metadata, not raw HTML
        handleCloudflare: payload?.handleCloudflare !== false,
        useProgressiveRetry: payload?.useProgressiveRetry !== false,  // Enable progressive retry by default
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
   * Execute lighthouse_html task: fetch performance scores from pagespeed.web.dev
   * @private
   */
  async executeLighthouseHtml(task) {
    const startTime = Date.now();
    const { url, payload } = task;

    let page = null;
    let pageId = null;
    try {
      // Get page from browserHelper
      const pageResult = await this.browserHelper.getPage();
      page = pageResult.page;
      pageId = pageResult.id;

      if (!page) {
        throw new Error('Page not available');
      }

      // Function to extract comprehensive score data from pagespeed.web.dev page
      const extractScoreData = async (page, formFactor, baseUrl) => {
        try {
          // Wait for the page to load and for scores to appear
          await page.waitForSelector('[class*="gauge"]', { timeout: 30000 }).catch(() => null);
          
          // Wait for scores to calculate
          await page.waitForTimeout(8000);

          // Extract data using page.evaluate for better performance
          const data = await page.evaluate(() => {
            const result = {
              scores: {
                performance: null,
                accessibility: null,
                bestPractices: null,
                seo: null
              },
              coreWebVitals: {
                lcp: null,
                inp: null,
                cls: null,
                assessment: null
              },
              metrics: {
                fcp: null,
                ttfb: null
              },
              htmlReportUrl: null
            };

            // Helper function to extract numeric score from elements
            const extractScoreFromElement = (element) => {
              if (!element) return null;
              const text = element.textContent || '';
              const match = text.match(/(\d+)(?:\s*\/\s*100)?/);
              if (match) {
                const num = parseInt(match[1], 10);
                // If > 1, assume it's out of 100, convert to 0-1 scale
                return num > 1 ? num / 100 : num;
              }
              return null;
            };

            // Try to find category scores - look for gauge sections
            // The page has sections for Performance, Accessibility, Best Practices, SEO
            const categorySections = document.querySelectorAll('[class*="category"], section, [data-category]');
            
            // Look for score gauges - typically in circular gauges
            const gaugeElements = document.querySelectorAll('[class*="gauge"], [class*="score"]');
            
            // Try to find scores from the page content by looking for category names with scores
            const categories = ['performance', 'accessibility', 'bestPractices', 'seo'];
            const categoryNameMap = {
              'performance': ['performance', 'Performance'],
              'accessibility': ['accessibility', 'Accessibility', 'a11y'],
              'bestPractices': ['best practices', 'bestPractices', 'Best Practices'],
              'seo': ['seo', 'SEO', 'Search Engine Optimization']
            };

            // Find all text content that might contain scores
            const pageText = document.body.innerText;
            
            // Extract performance score - usually the main score
            const perfMatch = pageText.match(/(?:Performance|performance)[\s:]*(\d+)(?:\s*%|[\s\/]100)?/i);
            if (perfMatch && !result.scores.performance) {
              const num = parseInt(perfMatch[1], 10);
              result.scores.performance = num > 1 ? num / 100 : num;
            }

            // Extract accessibility score
            const a11yMatch = pageText.match(/(?:Accessibility|a11y)[\s:]*(\d+)(?:\s*%|[\s\/]100)?/i);
            if (a11yMatch) {
              const num = parseInt(a11yMatch[1], 10);
              result.scores.accessibility = num > 1 ? num / 100 : num;
            }

            // Extract best practices score
            const bpMatch = pageText.match(/(?:Best\s*Practices)[\s:]*(\d+)(?:\s*%|[\s\/]100)?/i);
            if (bpMatch) {
              const num = parseInt(bpMatch[1], 10);
              result.scores.bestPractices = num > 1 ? num / 100 : num;
            }

            // Extract SEO score
            const seoMatch = pageText.match(/(?:SEO|Search\s*Engine\s*Optimization)[\s:]*(\d+)(?:\s*%|[\s\/]100)?/i);
            if (seoMatch) {
              const num = parseInt(seoMatch[1], 10);
              result.scores.seo = num > 1 ? num / 100 : num;
            }

            // Extract Core Web Vitals
            // LCP - Largest Contentful Paint
            const lcpMatch = pageText.match(/(?:LCP|Largest\s*Contentful\s*Paint)[\s:\d]*(?:(\d+\.?\d*)\s*(?:s|sec|seconds?)?)/i);
            if (lcpMatch && lcpMatch[1]) {
              result.coreWebVitals.lcp = parseFloat(lcpMatch[1]) + 's';
            }

            // INP - Interaction to Next Paint
            const inpMatch = pageText.match(/(?:INP|Interaction\s*to\s*Next\s*Paint)[\s:\d]*(?:(\d+\.?\d*)\s*ms)/i);
            if (inpMatch && inpMatch[1]) {
              result.coreWebVitals.inp = Math.round(parseFloat(inpMatch[1])) + 'ms';
            }

            // CLS - Cumulative Layout Shift
            const clsMatch = pageText.match(/(?:CLS|Cumulative\s*Layout\s*Shift)[\s:\d]*(?:(\d+\.?\d*))/i);
            if (clsMatch && clsMatch[1]) {
              result.coreWebVitals.cls = clsMatch[1];
            }

            // Core Web Vitals Assessment (Pass/Fail)
            const assessmentMatch = pageText.match(/(?:Core\s*Web\s*Vitals|CWV)[\s:\w]*(Pass|Fail|Passed|Failed|Good|Needs\s*Improvement|Poor)/i);
            if (assessmentMatch) {
              const assessment = assessmentMatch[1].toLowerCase();
              if (assessment.includes('pass') || assessment === 'good') {
                result.coreWebVitals.assessment = 'Passed';
              } else if (assessment.includes('fail') || assessment === 'poor' || assessment.includes('improvement')) {
                result.coreWebVitals.assessment = 'Failed';
              }
            }

            // FCP - First Contentful Paint
            const fcpMatch = pageText.match(/(?:FCP|First\s*Contentful\s*Paint)[\s:\d]*(?:(\d+\.?\d*)\s*(?:s|sec|seconds?)?)/i);
            if (fcpMatch && fcpMatch[1]) {
              result.metrics.fcp = parseFloat(fcpMatch[1]) + 's';
            }

            // TTFB - Time to First Byte
            const ttfbMatch = pageText.match(/(?:TTFB|Time\s*to\s*First\s*Byte)[\s:\d]*(?:(\d+\.?\d*)\s*(?:s|sec|seconds?|ms)?)/i);
            if (ttfbMatch && ttfbMatch[1]) {
              const value = parseFloat(ttfbMatch[1]);
              result.metrics.ttfb = value + 's';
            }

            // Look for a link to the full HTML report
            const reportLinks = document.querySelectorAll('a[href*="report"], a[href*="export"], a[href*="html"]');
            for (const link of reportLinks) {
              const href = link.getAttribute('href');
              if (href && (href.includes('pagespeed.web.dev') || href.includes('lighthouse'))) {
                result.htmlReportUrl = href.startsWith('http') ? href : 'https://pagespeed.web.dev' + href;
                break;
              }
            }

            return result;
          });

          console.log(`[TaskExecutor] Extracted ${formFactor} data:`, data);
          return data;
        } catch (error) {
          console.error(`[TaskExecutor] Error extracting ${formFactor} data:`, error.message);
          return {
            scores: { performance: null, accessibility: null, bestPractices: null, seo: null },
            coreWebVitals: { lcp: null, inp: null, cls: null, assessment: null },
            metrics: { fcp: null, ttfb: null },
            htmlReportUrl: null
          };
        }
      };

      // Get scores for mobile
      console.log(`[TaskExecutor] Fetching mobile scores from pagespeed.web.dev for ${url}`);
      const mobileUrl = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}&form_factor=mobile`;
      await page.goto(mobileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      const mobileData = await extractScoreData(page, 'mobile', mobileUrl);

      // Get scores for desktop
      console.log(`[TaskExecutor] Fetching desktop scores from pagespeed.web.dev for ${url}`);
      const desktopUrl = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}&form_factor=desktop`;
      await page.goto(desktopUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      const desktopData = await extractScoreData(page, 'desktop', desktopUrl);

      // Generate HTML report URL if not found on page
      // The pagespeed web dev report can be accessed via the same URL with additional parameters
      const generateReportUrl = (targetUrl, formFactor) => {
        return `https://pagespeed.web.dev/report?url=${encodeURIComponent(targetUrl)}&form_factor=${formFactor}`;
      };

      // Use found report URLs or generate them
      const mobileHtmlReportUrl = mobileData.htmlReportUrl || generateReportUrl(url, 'mobile');
      const desktopHtmlReportUrl = desktopData.htmlReportUrl || generateReportUrl(url, 'desktop');

      const duration = Date.now() - startTime;

      console.log(`[TaskExecutor] lighthouse_html task ${task.id} completed`, {
        url,
        duration: `${duration}ms`,
        mobileData,
        desktopData,
      });

      return {
        task_id: task.id,
        type: 'lighthouse_html',
        success: true,
        result: {
          url,
          source: 'pagespeed.web.dev',
          mobile: {
            coreWebVitals: mobileData.coreWebVitals,
            metrics: mobileData.metrics,
            scores: {
              performance: mobileData.scores.performance,
              accessibility: mobileData.scores.accessibility,
              bestPractices: mobileData.scores.bestPractices,
              seo: mobileData.scores.seo
            },
            htmlReportUrl: mobileHtmlReportUrl
          },
          desktop: {
            coreWebVitals: desktopData.coreWebVitals,
            metrics: desktopData.metrics,
            scores: {
              performance: desktopData.scores.performance,
              accessibility: desktopData.scores.accessibility,
              bestPractices: desktopData.scores.bestPractices,
              seo: desktopData.scores.seo
            },
            htmlReportUrl: desktopHtmlReportUrl
          },
          timestamp: new Date().toISOString(),
        },
        executed_at: new Date().toISOString(),
        duration_ms: duration,
      };
    } catch (error) {
      console.error(`[TaskExecutor] lighthouse_html task ${task.id} failed:`, error.message);

      const duration = Date.now() - startTime;

      return {
        task_id: task.id,
        type: 'lighthouse_html',
        success: false,
        error: error.message,
        executed_at: new Date().toISOString(),
        duration_ms: duration,
      };
    } finally {
      // Clean up page - release back to pool
      if (pageId) {
        try {
          const { closePage } = require('../utils/pageManager');
          closePage(pageId);
        } catch (e) {
          // Ignore close errors
        }
      }
    }
  }
}

module.exports = TaskExecutor;
