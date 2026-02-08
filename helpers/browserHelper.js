// helpers/browserHelper.js
const { requestPage, closePage } = require('../utils/pageManager');
const { gotoWithCloudflare, simulateHumanBehavior } = require('./cloudflareHelper');

let browserPageId = null;
let browserPage = null;

async function getBrowserPage() {
  const { page, id } = await requestPage('browser');
  browserPage = page;
  browserPageId = id;
  return browserPage;
}

async function closeBrowser() {
  if (browserPageId) {
    closePage(browserPageId);
    browserPageId = null;
    browserPage = null;
  }
}

async function executeCode(userCode) {
  const page = await getBrowserPage();
  const fn = new Function('page', userCode);
  return await fn(page);
}

async function googleSearch(query) {
  const page = await getBrowserPage();
  await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('textarea[name="q"]').fill(query);
  await page.keyboard.press('Enter');
  await page.waitForLoadState('networkidle');

  await page.waitForTimeout(1000);

  return await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('a:has(h3)').forEach(anchor => {
      const title = anchor.querySelector('h3')?.innerText.trim();
      const link = anchor.href;
      const parent = anchor.closest('div[data-hveid]') || anchor.closest('div')?.parentElement;

      let snippet = '';
      if (parent) {
        const el = parent.querySelector('div[style*="line-clamp"] span, div[data-snh-s="0"] span, div[role="text"] span');
        snippet = el?.innerText?.trim() || '';
      }

      if (title && link.startsWith('http')) {
        results.push({ title, link, snippet });
      }
    });
    return results;
  });
}

async function visitUrl(url, options = {}) {
  const page = await getBrowserPage();
  const {
    waitUntil = 'domcontentloaded',  // Changed from 'networkidle' - more reliable for most sites
    timeout = 60000,
    saveToFile = true,
    returnHtml = false,  // If false, returns file metadata; if true, returns HTML directly
    handleCloudflare = true,  // Enable Cloudflare handling by default
    useProgressiveRetry = true  // Enable progressive retry for navigation timeouts
  } = options;

  let finalUrl = url;

  // Navigate with Cloudflare handling if enabled
  if (handleCloudflare) {
    const result = await gotoWithCloudflare(page, url, {
      waitUntil,
      timeout,
      cfTimeout: 30000,
      humanDelay: true,
      useProgressiveRetry
    });

    if (result.blocked) {
      throw new Error('Cloudflare challenge failed - site still blocking access');
    }

    // Store the final URL after redirects
    finalUrl = result.finalUrl || page.url();

    // Add human-like behavior after successful navigation
    await simulateHumanBehavior(page);
  } else {
    // Fallback to original retry logic
    await gotoWithRetry(page, url, { 
      waitUntil, 
      timeout 
    }, 1);
    
    // Get final URL after redirects
    finalUrl = page.url();
  }

  // Additional wait to ensure everything is settled
  await page.waitForTimeout(2000);

  // Log if URL changed due to redirect
  if (finalUrl !== url) {
    console.log(`[Browser] Final URL after redirects: ${finalUrl}`);
  }

  // Get the full HTML content WITHOUT removing anything
  const html = await page.content();

  if (!saveToFile || returnHtml) {
    // Legacy behavior: return HTML directly (for small pages)
    return html;
  }

  // Save to file using configured storage adapter
  const StorageFactory = require('../utils/storage/StorageFactory');
  const storage = StorageFactory.createStorage();
  const crypto = require('crypto');
  
  const fileId = crypto.randomBytes(16).toString('hex');
  
  const result = await storage.saveHtml(fileId, html, finalUrl);
  
  // Add final URL to the result if it's different from requested URL
  if (finalUrl !== url) {
    result.requestedUrl = url;
    result.finalUrl = finalUrl;
  }
  
  return result;
}

async function gotoWithRetry(page, url, options = {}, retries = 1) {
  const waitStrategies = ['networkidle', 'load', 'domcontentloaded'];
  const currentStrategy = options.waitUntil || 'networkidle';
  const strategyIndex = waitStrategies.indexOf(currentStrategy);
  
  try {
    console.log(`[Navigation] Attempting ${url} with waitUntil=${currentStrategy}, timeout=${options.timeout || 30000}ms`);
    return await page.goto(url, options);
  } catch (err) {
    const isTimeout = err.message.includes('Timeout') || err.name === 'TimeoutError';
    
    if (isTimeout) {
      // Try next wait strategy as fallback
      if (strategyIndex < waitStrategies.length - 1) {
        const nextStrategy = waitStrategies[strategyIndex + 1];
        console.log(`[Navigation] Timeout with '${currentStrategy}', falling back to '${nextStrategy}'`);
        await page.waitForTimeout(2000);
        return gotoWithRetry(page, url, { ...options, waitUntil: nextStrategy }, 0);
      }
      
      // If already on last strategy, do one retry with same settings
      if (retries > 0) {
        console.log(`[Navigation] Retrying ${url} (${retries} attempts left)`);
        await page.waitForTimeout(3000);
        return gotoWithRetry(page, url, options, retries - 1);
      }
    }
    
    throw err;
  }
}

async function scrapeProduct(url, vendor) {
  const page = await getBrowserPage();
  await gotoWithRetry(page, url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const strategy = scraperStrategies[vendor.toLowerCase()];
  if (!strategy) throw new Error(`No scraper for vendor: ${vendor}`);

  return await strategy(page);
}

async function runScript(script, context = {}) {
  if (!script || typeof script !== 'string') {
    throw new Error('Invalid script definition');
  }

  const page = await getBrowserPage();
  const fn = new Function('page', 'target', 'parser', 'context', script);
  return await fn(page, context.target, context.parser, context);
}

// Vendor-specific scraping logic
const scraperStrategies = {
  beddermattress: async (page) => {
    return await page.evaluate(() => {
      const parse = txt => parseFloat(txt?.replace(/[^0-9.]/g, '')) || 0;
      const sale = document.querySelector('.price__sale .price-item--sale')?.innerText;
      const regular = document.querySelector('.price__sale s.price-item--regular')?.innerText;
      const standalone = document.querySelector('.price-item--regular')?.innerText;

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
    const parse = match => parseFloat((match?.[1] || '').replace(/[^0-9.]/g, '')) || 0;

    return {
      vendorPrice: parse(matchDiscounted),
      vendorBeforeDiscount: parse(matchVariant),
    };
  }
};

async function getHtmlFile(fileId) {
  const StorageFactory = require('../utils/storage/StorageFactory');
  const storage = StorageFactory.createStorage();
  
  return await storage.getHtml(fileId);
}

module.exports = {
  executeCode,
  googleSearch,
  visitUrl,
  scrapeProduct,
  runScript,
  closeBrowser,
  getHtmlFile
};