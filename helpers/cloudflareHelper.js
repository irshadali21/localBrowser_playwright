// helpers/cloudflareHelper.js

/**
 * Detects if page is showing Cloudflare challenge
 */
async function isCloudflareChallenge(page) {
  try {
    const title = await page.title();
    const content = await page.content();
    
    return (
      title.includes('Just a moment') ||
      title.includes('Please Wait') ||
      content.includes('Cloudflare') ||
      content.includes('cloudflare') ||
      content.includes('cf-challenge') ||
      content.includes('Challenge-form')
    );
  } catch (err) {
    return false;
  }
}

/**
 * Waits for Cloudflare challenge to complete
 * @param {Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Max wait time in ms (default: 30000)
 * @param {number} options.checkInterval - How often to check in ms (default: 1000)
 * @returns {Promise<boolean>} - True if challenge passed, false if still blocked
 */
async function waitForCloudflareChallenge(page, options = {}) {
  const { timeout = 30000, checkInterval = 1000 } = options;
  const startTime = Date.now();

  console.log('[Cloudflare] Detected challenge, waiting for clearance...');

  while (Date.now() - startTime < timeout) {
    await page.waitForTimeout(checkInterval);

    const stillInChallenge = await isCloudflareChallenge(page);
    
    if (!stillInChallenge) {
      console.log('[Cloudflare] Challenge passed successfully!');
      
      // Wait a bit more to ensure page is stable
      await page.waitForTimeout(2000);
      return true;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Cloudflare] Still in challenge... (${elapsed}s elapsed)`);
  }

  console.log('[Cloudflare] Challenge timeout - may still be blocked');
  return false;
}

/**
 * Navigates to URL with Cloudflare handling
 * @param {Page} page - Playwright page object
 * @param {string} url - Target URL
 * @param {Object} options - Navigation and Cloudflare options
 * @returns {Promise<Object>} - { success, blocked, response, finalUrl }
 */
async function gotoWithCloudflare(page, url, options = {}) {
  const {
    waitUntil = 'domcontentloaded',
    timeout = 60000,
    cfTimeout = 30000,
    humanDelay = true,
  } = options;

  try {
    // Add random delay before navigation (simulate human behavior)
    if (humanDelay) {
      const delay = Math.floor(Math.random() * 2000) + 1000; // 1-3 seconds
      await page.waitForTimeout(delay);
    }

    // Navigate to the page (Playwright automatically follows redirects)
    const response = await page.goto(url, { 
      waitUntil, 
      timeout 
    });

    // Wait a moment for any client-side redirects (JavaScript redirects)
    await page.waitForTimeout(1000);
    
    // Get the final URL after all redirects
    const finalUrl = page.url();
    
    if (finalUrl !== url) {
      console.log(`[Cloudflare] Redirected: ${url} → ${finalUrl}`);
    }

    // Check if we hit Cloudflare
    const isChallenge = await isCloudflareChallenge(page);
    
    if (isChallenge) {
      const passed = await waitForCloudflareChallenge(page, { timeout: cfTimeout });
      
      return {
        success: passed,
        blocked: !passed,
        response,
        finalUrl: page.url(),
        cloudflareEncountered: true,
      };
    }

    return {
      success: true,
      blocked: false,
      response,
      finalUrl,
      cloudflareEncountered: false,
    };

  } catch (err) {
    console.error('[Cloudflare] Navigation error:', err.message);
    
    // Check if we're on a Cloudflare block page despite the error
    try {
      const isBlocked = await isCloudflareChallenge(page);
      
      throw {
        ...err,
        cloudflareBlocked: isBlocked,
        finalUrl: page.url(),
      };
    } catch (checkErr) {
      // If we can't even check the page, just throw the original error
      throw err;
    }
  }
}

/**
 * Adds human-like behavior to evade detection
 */
async function simulateHumanBehavior(page) {
  try {
    // Random mouse movements
    const x = Math.floor(Math.random() * 800) + 100;
    const y = Math.floor(Math.random() * 600) + 100;
    await page.mouse.move(x, y);
    
    // Random scroll
    await page.evaluate(() => {
      window.scrollBy(0, Math.floor(Math.random() * 300) + 100);
    });
    
    await page.waitForTimeout(Math.random() * 1000 + 500);
  } catch (err) {
    // Ignore errors in simulation
  }
}

module.exports = {
  isCloudflareChallenge,
  waitForCloudflareChallenge,
  gotoWithCloudflare,
  simulateHumanBehavior,
};
