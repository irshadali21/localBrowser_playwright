const { chromium } = require('playwright');
const path = require('path');

async function testIframeExtraction() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['geolocation', 'notifications'],
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();
  
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.26 Safari/537.36';
  await page.setUserAgent?.(userAgent);
  
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    window.chrome = { runtime: {} };
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });
  
  try {
    console.log('Navigating to known business...');
    await page.goto('https://www.google.com/maps/place/Prospect+Heights+Plumbing+Brooklyn/@40.6826346,-73.9729819,17z/data=!4m8!3m7!1s0x89c25ba564414de7:0x883748ef52af604c!8m2!3d40.6826346!4d-73.9729819!9m1!1b1!16s%2Fg%2F11bxnq2z0q');
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await page.waitForTimeout(5000);
    
    console.log('Page title:', await page.title());
    
    console.log('Looking for Share button...');
    await page.click('button:has-text("Share")');
    await page.waitForTimeout(2000);
    
    console.log('Looking for Embed a map tab...');
    await page.click('button:has-text("Embed a map")');
    await page.waitForTimeout(3000);
    
    console.log('Checking all inputs on page...');
    const allInputs = await page.evaluate(() => {
      const inputs = [];
      document.querySelectorAll('input').forEach((input, index) => {
        const value = input.value || '';
        const className = input.className || '';
        const type = input.type || '';
        inputs.push({ index, className, type, value: value.substring(0, 100) + (value.length > 100 ? '...' : '') });
      });
      return inputs;
    });
    
    console.log('All inputs:', JSON.stringify(allInputs, null, 2));
    
    console.log('Taking screenshot of embed dialog...');
    const shareDialog = await page.$('.yFnP6d');
    if (shareDialog) {
      await shareDialog.screenshot({ path: 'embed-dialog-screenshot.png' });
      console.log('Embed dialog screenshot saved to embed-dialog-screenshot.png');
    } else {
      console.log('Share dialog not found, taking full page screenshot...');
      await page.screenshot({ path: 'full-page-screenshot.png' });
    }
    
    console.log('Checking for iframe...');
    const iframeSelector = 'iframe[src*="maps.google.com/embed"]';
    try {
      await page.waitForSelector(iframeSelector, { timeout: 10000 });
      console.log('✅ Iframe found in DOM');
    } catch (e) {
      console.log('❌ Iframe not found in DOM');
      const bodyHTML = await page.evaluate(() => document.body.outerHTML.substring(0, 2000));
      console.log('Page HTML snippet:', bodyHTML);
    }
    
    let iframeUrl = null;
    try {
      const inputValue = await page.$eval('input.yA7sBe', el => el.value);
      console.log('Debug: Input value preview:', inputValue.substring(0, 100));
      
      const match = inputValue.match(/https:\/\/www\.google\.com\/maps\/embed\?pb=[^"']*/);
      if (match) {
        iframeUrl = match[0];
        console.log('Debug: Found iframe URL:', iframeUrl);
        console.log('Debug: URL includes expected string:', iframeUrl.includes('google.com/maps/embed'));
      }
    } catch (e) {
      console.log('Debug: Could not extract from input.yA7sBe:', e.message);
    }
    
    if (!iframeUrl) {
      iframeUrl = await page.evaluate(() => {
        const iframeInputs = document.querySelectorAll('input');
        for (const input of iframeInputs) {
          const value = input.value || '';
          if (value.includes('maps.google.com/embed')) {
            const match = value.match(/https:\/\/www\.google\.com\/maps\/embed\?pb=[^"']*/);
            if (match) {
              return match[0];
            }
          }
        }
        
        const iframe = document.querySelector('iframe[src*="maps.google.com/embed"]');
        if (iframe && iframe.src) {
          return iframe.src;
        }
        
        return null;
      });
    }
    
    console.log('Extracted iframe URL:', iframeUrl);
    
  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'debug-screenshot.png' });
    console.log('Screenshot saved to debug-screenshot.png');
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

testIframeExtraction().catch(console.error);
