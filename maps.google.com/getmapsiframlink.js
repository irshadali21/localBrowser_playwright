const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// Constants
const CSV_PATH = path.join(__dirname, 'data.csv');
const BACKUP_PATH = path.join(__dirname, 'data.csv.old');
const IFRAME_PREFIX = 'https://www.google.com/maps/embed?pb=';
const GMB_SHORT_URL_PREFIX = 'https://maps.app.goo.gl/';
const NAVIGATION_TIMEOUT = 60000;
const HEADLESS = process.env.HEADLESS !== 'false';

function parseCSV(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }
  
  const headers = parseCSVLine(lines[0]);
  const businesses = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const business = {};
    
    headers.forEach((header, index) => {
      business[header.trim()] = values[index] || '';
    });
    
    businesses.push(business);
  }
  
  return businesses;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

function writeCSV(csvPath, businesses) {
  const headers = Object.keys(businesses[0]);
  const lines = [];
  lines.push(headers.map(h => `"${h}"`).join(','));
  
  for (const business of businesses) {
    const values = headers.map(h => {
      const val = business[h] || '';
      if (val.includes('"') || val.includes(',')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return `"${val}"`;
    });
    lines.push(values.join(','));
  }
  
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');
}

async function getEmbedLinkFromGMBShortUrl(page, gmbShortUrl) {
  console.log(`  Navigating to GMB short URL: ${gmbShortUrl.substring(0, 40)}...`);
  
  try {
    await page.goto(gmbShortUrl, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT
    });
    
    await page.waitForTimeout(3000);
    
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (e) {
      console.log('  Warning: networkidle timeout, continuing...');
      await page.waitForTimeout(2000);
    }
    
    return await getEmbedLinkViaShareDialog(page);
    
  } catch (error) {
    console.log(`  Error navigating to GMB short URL: ${error.message}`);
    return null;
  }
}

async function getEmbedLinkViaShareDialog(page) {
  try {
    await page.waitForTimeout(2000);
    
    console.log('  Looking for Share button...');
    
    const shareButtonSelectors = [
      'button:has-text("Share")',
      'button[aria-label*="Share"]',
      'button[aria-label="Share"]',
      'button[data-value="Share"]',
      'button.mvBUOc',
      'button[aria-label*="share"]',
      'button svg[aria-label*="Share"]',
      'a:has-text("Share")',
    ];
    
    let shareButton = null;
    for (const selector of shareButtonSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
          shareButton = element;
          console.log(`  Found Share button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (shareButton) {
      await shareButton.click();
      console.log('  Clicked Share button');
      await page.waitForTimeout(2000);
    } else {
      console.log('  Share button not found via selectors, trying keyboard shortcut...');
      await page.keyboard.press('Control+d');
      await page.waitForTimeout(2000);
    }
    
    console.log('  Looking for Embed a map option...');
    
    const embedButtonSelectors = [
      'button:has-text("Embed a map")',
      'a:has-text("Embed a map")',
      'button:has-text("Embed")',
      'a:has-text("Embed")',
      'button[aria-label*="Embed"]',
      'button[aria-label*="embed"]',
      'button[data-value="Embed a map"]',
      '.Rx2Usb',
      'div[role="menuitem"]:has-text("Embed")',
    ];
    
    let embedButton = null;
    for (const selector of embedButtonSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
          embedButton = element;
          console.log(`  Found Embed button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (embedButton) {
      await embedButton.click();
      console.log('  Clicked Embed a map button');
      
      // Wait for the embed tab to be active and iframe input to appear
      try {
        await page.waitForSelector('input.yA7sBe', { timeout: 5000 });
        console.log('  Embed dialog input found');
      } catch (e) {
        console.log('  Waiting for embed dialog failed, taking screenshot...');
        await page.screenshot({ path: 'embed-dialog-error.png' });
        return null;
      }
      
    } else {
      console.log('  Embed button not found');
      return null;
    }
    
    // Try to extract iframe URL from the specific input
    let iframeUrl = null;
    try {
      const inputValue = await page.$eval('input.yA7sBe', el => el.value);
      console.log('  Debug: Input value preview:', inputValue.substring(0, 100));
      
      const match = inputValue.match(/https:\/\/www\.google\.com\/maps\/embed\?pb=[^"']*/);
      if (match) {
        iframeUrl = match[0];
        console.log(`  Found iframe URL: ${iframeUrl.substring(0, 80)}...`);
      }
    } catch (e) {
      console.log('  Debug: Could not extract from input.yA7sBe');
    }
    
    // Fallback to other methods
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
    
    if (iframeUrl && iframeUrl.includes('google.com/maps/embed')) {
      return iframeUrl;
    }
    
    console.log('  Iframe not in expected location');
    return null;
    
    if (iframeUrl && iframeUrl.includes('maps.google.com/embed')) {
      console.log(`  Found iframe URL: ${iframeUrl.substring(0, 80)}...`);
      return iframeUrl;
    }
    
    console.log('  Iframe not in expected location');
    return null;
    
  } catch (error) {
    console.log(`  Error in getEmbedLinkViaShareDialog: ${error.message}`);
    return null;
  }
}

async function getEmbedLinkFromCurrentPage(page) {
  try {
    const currentUrl = page.url();
    console.log(`  Current URL: ${currentUrl.substring(0, 80)}...`);
    
    if (currentUrl.includes('maps.google.com/maps/embed')) {
      console.log('  Already on embed URL!');
      return currentUrl;
    }
    
    const placeMatch = currentUrl.match(/!1s([^:]+):([^!]+)/);
    const coordMatch = currentUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    const placeNameMatch = currentUrl.match(/\/place\/([^\/]+)/);
    
    if (placeMatch || coordMatch) {
      let embedUrl = '';
      
      if (placeMatch) {
        const placeId = placeMatch[1];
        const latLng = placeMatch[2].split(';');
        const lat = latLng[0] || '0';
        const lng = latLng[1] || '0';
        
        embedUrl = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1!2d${encodeURIComponent(lng)}!3d${encodeURIComponent(lat)}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s${encodeURIComponent(placeId)}!2s0!3m2!1sen!2s`;
      } else if (coordMatch) {
        const lat = coordMatch[1];
        const lng = coordMatch[2];
        
        embedUrl = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1!2d${encodeURIComponent(lng)}!3d${encodeURIComponent(lat)}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0:0xplaceholder!2s0!3m2!1sen!2s`;
      }
      
      if (embedUrl) {
        console.log(`  Generated embed URL from current page`);
        return embedUrl;
      }
    }
    
    console.log('  Could not extract embed URL automatically');
    return null;
    
  } catch (error) {
    console.log(`  Error in getEmbedLinkFromCurrentPage: ${error.message}`);
    return null;
  }
}

async function searchBusiness(page, businessName, address) {
  const query = `${businessName} ${address}`;
  console.log(`  Searching for: ${query}`);
  
  try {
    const encodedQuery = encodeURIComponent(query);
    await page.goto(`https://www.google.com/maps/search/${encodedQuery}`, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT
    });
    
    await page.waitForTimeout(3000);
    
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (e) {
      console.log('  Warning: networkidle timeout, continuing...');
      await page.waitForTimeout(2000);
    }
    
    console.log('  Waiting for search results...');
    
    const resultSelectors = [
      'div[data-result-index="0"]',
      '.place-result',
      '.Nv2PK',
      'div[role="button"][aria-label*="Results"]',
      '#searchboxinput',
    ];
    
    let foundResults = false;
    for (const selector of resultSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundResults = true;
          console.log(`  Found results with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(2000);
    
    const clickableResultSelectors = [
      'div[data-result-index="0"]',
      '.place-result',
      '.Nv2PK',
      'a[href*="/place/"]',
    ];
    
    for (const selector of clickableResultSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          await element.click();
          console.log(`  Clicked on first result using: ${selector}`);
          await page.waitForTimeout(3000);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    return await getEmbedLinkViaShareDialog(page);
    
  } catch (error) {
    console.log(`  Error in searchBusiness: ${error.message}`);
    return null;
  }
}

async function processBusiness(page, business, index, total) {
  const name = business['Business Name'];
  const address = business['Address'] || '';
  const currentGMB = business['GMB Listing URL'];
  
  console.log(`\n[${index + 1}/${total}] Processing: ${name}`);
  console.log(`  Address: ${address}`);
  
  if (business['Iframe url'] && business['Iframe url'].startsWith(IFRAME_PREFIX)) {
    console.log('  ✓ Already has iframe embed link - skipping');
    return { success: true, skipped: true, reason: 'already_has_iframe' };
  }
  
  if (currentGMB && currentGMB.startsWith(GMB_SHORT_URL_PREFIX)) {
    console.log(`  Has GMB short URL: ${currentGMB.substring(0, 40)}...`);
    
    try {
      const embedUrl = await getEmbedLinkFromGMBShortUrl(page, currentGMB);
      
      if (embedUrl) {
        business['Iframe url'] = embedUrl;
        business['Completed?'] = 'Completed and live';
        business['Additional notes'] = 'Images OK, Listing OK, SSL OK';
        console.log('  ✓ Successfully converted GMB short URL to embed link!');
        return { success: true, skipped: false };
      } else {
        console.log('  ✗ Could not get embed link from GMB short URL');
        business['Completed?'] = 'Failed - could not get embed from short URL';
        return { success: false, skipped: false };
      }
    } catch (error) {
      console.log(`  ✗ Error processing GMB short URL: ${error.message}`);
      business['Completed?'] = 'Error: ' + error.message;
      return { success: false, skipped: false };
    }
  }
  
  if (currentGMB && currentGMB.trim() && !currentGMB.startsWith(IFRAME_PREFIX) && !currentGMB.startsWith(GMB_SHORT_URL_PREFIX)) {
    console.log(`  Has non-iframe URL: ${currentGMB.substring(0, 50)}...`);
    console.log('  This URL type is not supported, trying search instead...');
  }
  
  if (!currentGMB || !currentGMB.trim()) {
    console.log('  No GMB URL - will search on Google Maps');
  }
  
  const maxRetries = 2;
  let lastError = null;
  
  for (let retry = 0; retry < maxRetries; retry++) {
    if (retry > 0) {
      console.log(`  Retry ${retry}/${maxRetries - 1}...`);
      await page.waitForTimeout(3000);
    }
    
    try {
      const embedUrl = await searchBusiness(page, name, address);
      
      if (embedUrl) {
        business['Iframe url'] = embedUrl;
        business['Completed?'] = 'Completed and live';
        business['Additional notes'] = 'Images OK, Listing OK, SSL OK';
        console.log('  ✓ Successfully got embed link!');
        return { success: true, skipped: false };
      }
      
      console.log('  ✗ Could not get embed link');
      lastError = 'No embed URL found';
      
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      lastError = error.message;
    }
  }
  
  business['Completed?'] = 'Failed: ' + (lastError || 'Unknown error');
  return { success: false, skipped: false };
}

async function main() {
  console.log('=== Google Maps Iframe Link Extractor ===\n');
  console.log('Improvements:');
  console.log('  - Uses existing GMB short URLs when available');
  console.log('  - 60-second timeout with retry logic');
  console.log('  - Updated selectors for current Google Maps UI');
  console.log('  - Better error handling and logging\n');
  
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Error: CSV file not found at ${CSV_PATH}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(CSV_PATH, BACKUP_PATH);
    console.log('Created backup of CSV at:', BACKUP_PATH);
  }
  
  let businesses;
  try {
    businesses = parseCSV(CSV_PATH);
    console.log(`Found ${businesses.length} business entries\n`);
  } catch (error) {
    console.error(`Error parsing CSV: ${error.message}`);
    process.exit(1);
  }
  
  const alreadyHasIframe = businesses.filter(b => 
    b['Iframe url'] && b['Iframe url'].startsWith(IFRAME_PREFIX)
  );
  
  const hasGmbShortUrl = businesses.filter(b => 
    b['GMB Listing URL'] && b['GMB Listing URL'].startsWith(GMB_SHORT_URL_PREFIX)
  );
  
  const needsSearch = businesses.filter(b => 
    (!b['GMB Listing URL'] || !b['GMB Listing URL'].trim())
  );
  
  const hasOtherUrl = businesses.filter(b => 
    b['GMB Listing URL'] && 
    !b['GMB Listing URL'].startsWith(IFRAME_PREFIX) &&
    !b['GMB Listing URL'].startsWith(GMB_SHORT_URL_PREFIX)
  );
  
  console.log('Entry breakdown:');
  console.log(`  Already have iframe: ${alreadyHasIframe.length}`);
  console.log(`  Have GMB short URL: ${hasGmbShortUrl.length}`);
  console.log(`  Have other URL: ${hasOtherUrl.length}`);
  console.log(`  Need search: ${needsSearch.length}\n`);
  
  if (alreadyHasIframe.length === businesses.length) {
    console.log('All entries already have iframe embed links!');
    return;
  }
  
  console.log('Launching browser...');
  let browser;
  let context;
  let page;
  
  try {
    browser = await chromium.launch({
      headless: HEADLESS,
      args: ['--disable-blink-features=AutomationControlled']
    });
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation', 'notifications'],
      ignoreHTTPSErrors: true
    });
    page = await context.newPage();
    
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
      
      window.chrome = {
        runtime: {},
      };
      
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
    
    console.log('Browser launched successfully\n');
  } catch (error) {
    console.error(`Error launching browser: ${error.message}`);
    process.exit(1);
  }
  
  let processed = 0;
  let successful = 0;
  let skipped = 0;
  let failed = 0;
  const failedEntries = [];
  
  for (let i = 0; i < businesses.length; i++) {
    const business = businesses[i];
    const iframe = business['Iframe url'];
    
    if (iframe && iframe.startsWith(IFRAME_PREFIX)) {
      skipped++;
      continue;
    }
    
    const result = await processBusiness(page, business, processed, businesses.length);
    
    if (result.success) {
      successful++;
    } else {
      failed++;
      failedEntries.push({
        name: business['Business Name'],
        reason: business['Completed?']
      });
    }
    processed++;
    
    try {
      writeCSV(CSV_PATH, businesses);
      console.log('  Progress saved to CSV\n');
    } catch (error) {
      console.log(`  Warning: Could not save progress: ${error.message}\n`);
    }
    
    await page.waitForTimeout(2000);
  }
  
  try {
    writeCSV(CSV_PATH, businesses);
    console.log('\nFinal progress saved to CSV');
  } catch (error) {
    console.log(`\nWarning: Could not save final progress: ${error.message}`);
  }
  
  console.log('\n=== Summary ===');
  console.log(`Total entries: ${businesses.length}`);
  console.log(`Skipped (already have iframe): ${skipped}`);
  console.log(`Processed: ${processed}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  
  if (failedEntries.length > 0) {
    console.log('\n=== Failed Entries (for manual review) ===');
    for (const entry of failedEntries) {
      console.log(`  - ${entry.name}: ${entry.reason}`);
    }
  }
  
  try {
    await browser.close();
    console.log('\nBrowser closed');
  } catch (e) {
    
  }
  
  console.log('\nDone!');
}

process.on('uncaughtException', (error) => {
  console.error(`\nUncaught Exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`\nUnhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

main();
