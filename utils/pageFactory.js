// utils/pageFactory.js
const configBrowser = require('../playwrightConfig');

let context = null;

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.26 Safari/537.36';

async function getBrowserContext() {
  if (!context) {
    context = await configBrowser();
  }
  return context;
}

async function getConfiguredPage() {
  const ctx = await getBrowserContext();
  const page = await ctx.newPage();

  await page.setUserAgent?.(userAgent);
  await page.setViewportSize({ width: 1280, height: 800 });

  // Anti-detection: Override navigator properties to hide automation
  await page.addInitScript(() => {
    // Override webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });

    // Override plugins array
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // Mock chrome object
    window.chrome = {
      runtime: {},
    };

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });

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
