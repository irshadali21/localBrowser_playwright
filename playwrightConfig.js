// utils/playwrightConfig.js
const { chromium } = require('playwright');
const path = require('path');

const userDataDir = path.join(process.cwd(), 'profile-data');

async function configBrowser() {
  return await chromium.launchPersistentContext(userDataDir, {
    headless: process.env.HEADLESS !== 'false',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['geolocation', 'notifications'],
    ignoreHTTPSErrors: true,  // Ignore SSL/TLS certificate errors
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--lang=en-US,en',
      '--window-size=1280,800',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list'
    ]
  });
}

module.exports = configBrowser;
