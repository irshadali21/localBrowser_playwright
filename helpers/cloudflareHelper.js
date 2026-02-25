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
  const { timeout = 30000, checkInterval = 1000, useHumanInteraction = true } = options;
  const startTime = Date.now();
  let humanInteractionAttempted = false;

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

    // Try human interaction after 5 seconds if challenge still present
    if (useHumanInteraction && !humanInteractionAttempted && (Date.now() - startTime) > 5000) {
      console.log('[Cloudflare] Attempting human interaction to solve challenge...');
      const solved = await solveCloudflareChallenge(page);
      
      if (solved) {
        console.log('[Cloudflare] Challenge resolved via human interaction!');
        return true;
      }
      
      humanInteractionAttempted = true;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Cloudflare] Still in challenge... (${elapsed}s elapsed)`);
  }

  // Last attempt with human interaction if not yet tried
  if (useHumanInteraction && !humanInteractionAttempted) {
    console.log('[Cloudflare] Final attempt with human interaction...');
    const solved = await solveCloudflareChallenge(page);
    if (solved) {
      return true;
    }
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

/**
 * Solves Cloudflare challenge by simulating human interaction
 * Presses tab to focus the challenge button, then spacebar to click it
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} - True if challenge was resolved
 */
async function solveCloudflareChallenge(page) {
  try {
    console.log('[Cloudflare] Attempting to solve challenge with human interaction...');
    
    // First, simulate human behavior (mouse movement + scroll)
    await simulateHumanBehavior(page);
    
    // Press Tab to focus on the challenge button
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    
    // Press Spacebar to activate the challenge
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    
    // Try multiple tab+space combinations in case there are multiple elements
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
    }
    
    // Wait 3 seconds for the challenge to resolve
    console.log('[Cloudflare] Waiting 3 seconds for challenge resolution...');
    await page.waitForTimeout(3000);
    
    // Check if challenge is still present
    const stillInChallenge = await isCloudflareChallenge(page);
    
    if (stillInChallenge) {
      console.log('[Cloudflare] Challenge still present after human interaction');
      return false;
    }
    
    console.log('[Cloudflare] Challenge resolved successfully!');
    return true;
  } catch (err) {
    console.error('[Cloudflare] Error solving challenge:', err.message);
    return false;
  }
}

module.exports = {
  isCloudflareChallenge,
  waitForCloudflareChallenge,
  gotoWithCloudflare,
  simulateHumanBehavior,
  solveCloudflareChallenge,
};
