// helpers/browserHelper.js
const { requestPage, closePage } = require('../utils/pageManager');

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

async function visitUrl(url) {
  const page = await getBrowserPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    document.querySelectorAll('script, style, link[rel="stylesheet"]').forEach(el => el.remove());
  });
  return await page.content();
}

async function gotoWithRetry(page, url, options = {}, retries = 1) {
  try {
    return await page.goto(url, options);
  } catch (err) {
    if (err.message.includes('Navigation timeout') && retries > 0) {
      await page.waitForTimeout(3000);
      return gotoWithRetry(page, url, options, retries - 1);
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

module.exports = {
  executeCode,
  googleSearch,
  visitUrl,
  scrapeProduct,
  runScript,
  closeBrowser
};