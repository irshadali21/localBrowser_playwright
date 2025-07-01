// utils/playwrightConfig.js
const { chromium } = require('playwright');
const path = require('path');

const userDataDir = path.join(process.cwd(), 'profile-data');

async function configBrowser() {
  return await chromium.launchPersistentContext(userDataDir, {
    headless: process.env.HEADLESS !== 'false',
    viewport: { width: 1280, height: 800 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
    ]
  });
}

module.exports = configBrowser;
