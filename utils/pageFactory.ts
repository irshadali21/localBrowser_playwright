/**
 * Page Factory - Creates and configures browser pages with anti-detection measures
 */

import type { BrowserContext, Page } from 'playwright';
import configBrowser from '../playwrightConfig';

let context: BrowserContext | null = null;

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.26 Safari/537.36';

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };

/**
 * Anti-detection script to inject into pages
 */
const ANTI_DETECTION_SCRIPT = `
  (() => {
    // Override webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false
    });

    // Override plugins array
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });

    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });

    // Mock chrome object
    window.chrome = {
      runtime: {}
    };

    // Override permissions query
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => {
      if (parameters.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission });
      }
      return originalQuery(parameters);
    };
  })();
`;

/**
 * Get or create the browser context with proper configuration
 */
export async function getBrowserContext(): Promise<BrowserContext> {
  if (!context) {
    context = await configBrowser();
    // Set user agent at context level
    await context.addInitScript(ANTI_DETECTION_SCRIPT);
  }
  return context;
}

/**
 * Get the current context (may be null if not initialized)
 */
export function getContext(): BrowserContext | null {
  return context;
}

/**
 * Configure a new page with anti-detection measures
 */
export async function getConfiguredPage(): Promise<Page> {
  const ctx = await getBrowserContext();
  const page = await ctx.newPage();

  // Set viewport
  await page.setViewportSize(DEFAULT_VIEWPORT);

  return page;
}

// Re-export for backward compatibility
export const pageFactory = {
  getConfiguredPage,
  getBrowserContext,
  getContext,
};

export default pageFactory;
