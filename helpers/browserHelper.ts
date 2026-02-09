/**
 * Browser Helper - High-level browser operations with type safety
 */

import type { Page } from 'playwright';
import type {
  BrowserHelper,
  VisitOptions,
  SearchResult,
  VisitResult,
  CloudflareResult,
} from '../types/browser';
import type { StorageResult } from '../types/common';
import { BrowserErrorCode } from '../types/browser';
import { requestPage } from '../utils/pageManager';
import { gotoWithCloudflare, simulateHumanBehavior } from './cloudflareHelper';
import { BrowserError } from '../types/errors';

/**
 * Get a browser page for operations
 */
export async function getBrowserPage(): Promise<Page> {
  const { page } = await requestPage('browser');
  return page;
}

/**
 * Close the current browser page
 * NOTE: This is a legacy function - pages are now managed by pageManager
 */
export async function closeBrowser(): Promise<void> {
  // Individual pages should be closed via pageManager.closePage()
  // This function is kept for backward compatibility
}

/**
 * Execute arbitrary JavaScript code on a browser page
 * NOTE: This uses eval which can be dangerous with user input
 */
export async function executeCode(userCode: string): Promise<unknown> {
  const page = await getBrowserPage();

  try {
    // Using Function constructor with page as argument
    // WARNING: This is a security risk with untrusted input
    const fn = new Function('page', userCode);
    return await fn(page);
  } catch (error) {
    throw new BrowserError(
      `Code execution failed: ${(error as Error).message}`,
      BrowserErrorCode.CODE_EXECUTION_ERROR,
      { userCodeLength: userCode.length }
    );
  }
}

/**
 * Perform a Google search and return results
 */
export async function googleSearch(query: string): Promise<SearchResult[]> {
  const page = await getBrowserPage();

  await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Enter search query
  await page.locator('textarea[name="q"]').fill(query);
  await page.keyboard.press('Enter');
  await page.waitForLoadState('networkidle');

  await page.waitForTimeout(1000);

  // Extract search results using page evaluation
  return await page.evaluate((): SearchResult[] => {
    const results: SearchResult[] = [];

    document.querySelectorAll('a:has(h3)').forEach((anchor) => {
      const anchorEl = anchor as HTMLAnchorElement;
      const title = anchor.querySelector('h3')?.innerText.trim();
      const link = anchorEl.href;
      const parent = anchor.closest('div[data-hveid]') || anchor.closest('div')?.parentElement;

      let snippet = '';
      if (parent) {
        const el = parent.querySelector('div[style*="line-clamp"] span, div[data-snh-s="0"] span, div[role="text"] span');
        snippet = el?.innerHTML?.trim() || '';
      }

      if (title && link.startsWith('http')) {
        results.push({ title, link, snippet });
      }
    });

    return results;
  });
}

/**
 * Navigate to a URL and optionally save the HTML
 */
export async function visitUrl(url: string, options: VisitOptions = {}): Promise<VisitResult> {
  const {
    waitUntil = 'domcontentloaded',
    timeout = 60000,
    handleCloudflare = true,
    useProgressiveRetry = true,
  } = options;

  const page = await getBrowserPage();
  let finalUrl = url;

  // Navigate with Cloudflare handling if enabled
  if (handleCloudflare) {
    const result = await gotoWithCloudflare(page, url, {
      waitUntil,
      timeout,
      cfTimeout: 30000,
      humanDelay: true,
      useProgressiveRetry,
    }) as CloudflareResult;

    if (result.blocked) {
      throw new BrowserError(
        'Cloudflare challenge failed - site still blocking access',
        BrowserErrorCode.CLOUDFLARE_BLOCKED
      );
    }

    // Store the final URL after redirects
    finalUrl = result.finalUrl || page.url();

    // Add human-like behavior after successful navigation
    await simulateHumanBehavior(page);
  } else {
    // Fallback to direct navigation
    await page.goto(url, { waitUntil, timeout });
    finalUrl = page.url();
  }

  const result: VisitResult = {
    url: finalUrl,
  };

  if (finalUrl !== url) {
    result.requestedUrl = url;
    result.finalUrl = finalUrl;
  }

  return result;
}

/**
 * Navigate to URL with retry logic
 */
async function gotoWithRetry(
  page: Page,
  url: string,
  options: { waitUntil?: 'domcontentloaded' | 'load' | 'networkidle'; timeout?: number } = {},
  retries = 1
): Promise<void> {
  const waitStrategies: Array<'domcontentloaded' | 'load' | 'networkidle'> = ['networkidle', 'load', 'domcontentloaded'];
  const currentStrategy = options.waitUntil || 'networkidle';
  const strategyIndex = waitStrategies.indexOf(currentStrategy);
  
  try {
    console.log(`[Navigation] Attempting ${url} with waitUntil=${currentStrategy}, timeout=${options.timeout || 30000}ms`);
    await page.goto(url, options);
  } catch (err) {
    const error = err as Error;
    const isTimeout = error.message.includes('Timeout') || error.name === 'TimeoutError';
    
    if (isTimeout) {
      // Try next wait strategy as fallback
      if (strategyIndex < waitStrategies.length - 1) {
        const nextStrategy = waitStrategies[strategyIndex + 1];
        console.log(`[Navigation] Timeout with '${currentStrategy}', falling back to '${nextStrategy}'`);
        await page.waitForTimeout(2000);
        await gotoWithRetry(page, url, { ...options, waitUntil: nextStrategy }, 0);
        return;
      }
      
      // If already on last strategy, do one retry with same settings
      if (retries > 0) {
        console.log(`[Navigation] Retrying ${url} (${retries} attempts left)`);
        await page.waitForTimeout(3000);
        await gotoWithRetry(page, url, options, retries - 1);
        return;
      }
    }
    
    throw err;
  }
}

/**
 * Vendor-specific scraping strategy type
 */
type ScrapingStrategy = (page: Page) => Promise<Record<string, unknown>>;

/**
 * Vendor-specific scraping logic
 */
const scraperStrategies: Record<string, ScrapingStrategy> = {
  beddermattress: async (page) => {
    return await page.evaluate(() => {
      const parse = (txt: string | null | undefined) => parseFloat(txt?.replace(/[^0-9.]/g, '') || '') || 0;
      const saleEl = document.querySelector('.price__sale .price-item--sale');
      const regularEl = document.querySelector('.price__sale s.price-item--regular');
      const standaloneEl = document.querySelector('.price-item--regular');
      const sale = saleEl?.textContent;
      const regular = regularEl?.textContent;
      const standalone = standaloneEl?.textContent;

      return {
        vendorPrice: sale ? parse(sale) : parse(standalone),
        vendorBeforeDiscount: regular ? parse(regular) : parse(standalone),
      };
    });
  },

  helixsleep: async (page) => {
    const html = await page.content();
    const matchDiscounted = html.match(/data-area="discounted-price"[^>]*>(.*?)<\/div>/);
    const matchVariant = html.match(/data-area="variant-price"[^>]*>(.*?)<\/div>/);
    const parse = (match: RegExpMatchArray | null) => parseFloat((match?.[1] || '').replace(/[^0-9.]/g, '') || '') || 0;

    return {
      vendorPrice: parse(matchDiscounted),
      vendorBeforeDiscount: parse(matchVariant),
    };
  }
};

/**
 * Scrape product data from a URL using vendor-specific strategies
 */
export async function scrapeProduct(url: string, vendor: string): Promise<Record<string, unknown>> {
  const page = await getBrowserPage();
  await gotoWithRetry(page, url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const strategy = scraperStrategies[vendor.toLowerCase()];
  if (!strategy) throw new Error(`No scraper for vendor: ${vendor}`);

  return await strategy(page);
}

/**
 * Get HTML file from storage
 */
export async function getHtmlFile(fileId: string): Promise<StorageResult> {
  const StorageFactory = require('../utils/storage/StorageFactory');
  const storage = StorageFactory.createStorage();
  return await storage.getHtml(fileId);
}

// Re-export interface for backward compatibility
export const browserHelper: BrowserHelper = {
  getBrowserPage,
  closeBrowser,
  executeCode,
  googleSearch,
  visitUrl,
  scrapeProduct,
};

export default browserHelper;
