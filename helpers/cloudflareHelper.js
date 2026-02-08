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
 * Navigates to URL with Cloudflare handling and progressive retry strategy
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
    useProgressiveRetry = true,  // Enable progressive retry strategy
  } = options;

  // Progressive retry strategy: try stricter conditions first, then relax
  const retryStrategies = useProgressiveRetry ? [
    { waitUntil: 'networkidle', timeout: Math.min(30000, timeout) },
    { waitUntil: 'load', timeout: Math.min(30000, timeout) },
    { waitUntil: 'domcontentloaded', timeout: Math.min(30000, timeout) },
  ] : [{ waitUntil, timeout }];

  let lastError = null;

  for (let i = 0; i < retryStrategies.length; i++) {
    const strategy = retryStrategies[i];
    
    try {
      console.log(`[Cloudflare] Navigation attempt ${i + 1}/${retryStrategies.length}:`, {
        url,
        waitUntil: strategy.waitUntil,
        timeout: strategy.timeout
      });

      // Add random delay before navigation (simulate human behavior)
      if (humanDelay && i === 0) {  // Only delay on first attempt
        const delay = Math.floor(Math.random() * 2000) + 1000; // 1-3 seconds
        await page.waitForTimeout(delay);
      }

      // Navigate to the page (Playwright automatically follows redirects)
      const response = await page.goto(url, { 
        waitUntil: strategy.waitUntil, 
        timeout: strategy.timeout 
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

      // Success! Return the result
      console.log(`[Cloudflare] Navigation successful with strategy: ${strategy.waitUntil}`);
      return {
        success: true,
        blocked: false,
        response,
        finalUrl,
        cloudflareEncountered: false,
      };

    } catch (err) {
      lastError = err;
      console.error(`[Cloudflare] Navigation attempt ${i + 1} failed:`, err.message);
      
      // If this isn't the last retry, continue to next strategy
      if (i < retryStrategies.length - 1) {
        console.log(`[Cloudflare] Retrying with next strategy...`);
        continue;
      }
      
      // Last attempt failed, check if we're on a Cloudflare block page
      try {
        const isBlocked = await isCloudflareChallenge(page);
        
        throw {
          ...err,
          cloudflareBlocked: isBlocked,
          finalUrl: page.url(),
        };
      } catch (checkErr) {
        // If we can't even check the page, just throw the original error
        throw lastError;
      }
    }
  }

  // If we get here, all retries failed
  throw lastError;
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
