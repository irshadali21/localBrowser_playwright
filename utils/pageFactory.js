// utils/pageFactory.js
const configBrowser = require('../playwrightConfig');

let context = null;

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36';

async function getBrowserContext() {
  if (!context) {
    context = await configBrowser();
  }
  return context;
}

async function getConfiguredPage() {
  const ctx = await getBrowserContext();
  const page = await ctx.newPage();

  await page.setUserAgent?.(userAgent); // fallback if unsupported (optional)
  await page.setViewportSize({ width: 1280, height: 800 });

  return page;
}

function getContext() {
  return context;
}

module.exports = {
  getConfiguredPage,
  getBrowserContext,
  getContext,
};
