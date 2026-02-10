/**
 * Cloudflare Helper - Cloudflare challenge detection and handling
 */

import type { Page, Response } from 'playwright';
import type { CloudflareResult } from '../types/browser';

/**
 * Cloudflare navigation options
 */
export interface CloudflareOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  timeout?: number;
  cfTimeout?: number;
  humanDelay?: boolean;
  useProgressiveRetry?: boolean;
}

/**
 * Challenge wait options
 */
export interface ChallengeWaitOptions {
  timeout?: number;
  checkInterval?: number;
}

/**
 * Detects if page is showing Cloudflare challenge
 */
export async function isCloudflareChallenge(page: Page): Promise<boolean> {
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
  } catch {
    return false;
  }
}

/**
 * Waits for Cloudflare challenge to complete
 */
export async function waitForCloudflareChallenge(
  page: Page,
  options: ChallengeWaitOptions = {}
): Promise<boolean> {
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
 */
export async function gotoWithCloudflare(
  page: Page,
  url: string,
  options: CloudflareOptions = {}
): Promise<CloudflareResult> {
  const {
    waitUntil = 'domcontentloaded',
    timeout = 60000,
    cfTimeout = 30000,
    humanDelay = true,
    useProgressiveRetry = true,
  } = options;

  // Progressive retry strategy: try stricter conditions first, then relax
  const retryStrategies = useProgressiveRetry
    ? [
        { waitUntil: 'networkidle' as const, timeout: Math.min(30000, timeout) },
        { waitUntil: 'load' as const, timeout: Math.min(30000, timeout) },
        { waitUntil: 'domcontentloaded' as const, timeout: Math.min(30000, timeout) },
      ]
    : [{ waitUntil, timeout }];

  let lastError: Error | null = null;

  for (let i = 0; i < retryStrategies.length; i++) {
    const strategy = retryStrategies[i];

    try {
      console.log(`[Cloudflare] Navigation attempt ${i + 1}/${retryStrategies.length}:`, {
        url,
        waitUntil: strategy.waitUntil,
        timeout: strategy.timeout,
      });

      // Add random delay before navigation (simulate human behavior)
      if (humanDelay && i === 0) {
        const delay = Math.floor(Math.random() * 2000) + 1000;
        await page.waitForTimeout(delay);
      }

      // Navigate to the page (Playwright automatically follows redirects)
      const response = await page.goto(url, {
        waitUntil: strategy.waitUntil,
        timeout: strategy.timeout,
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
          response: response ?? undefined,
          finalUrl: page.url(),
          cloudflareEncountered: true,
        };
      }

      // Success! Return the result
      console.log(`[Cloudflare] Navigation successful with strategy: ${strategy.waitUntil}`);
      return {
        success: true,
        blocked: false,
        response: response ?? undefined,
        finalUrl,
        cloudflareEncountered: false,
      };
    } catch (err) {
      lastError = err as Error;
      console.error(`[Cloudflare] Navigation attempt ${i + 1} failed:`, lastError.message);

      // If this isn't the last retry, continue to next strategy
      if (i < retryStrategies.length - 1) {
        console.log(`[Cloudflare] Retrying with next strategy...`);
        continue;
      }

      // Last attempt failed, check if we're on a Cloudflare block page
      try {
        const isBlocked = await isCloudflareChallenge(page);

        throw {
          ...lastError,
          cloudflareBlocked: isBlocked,
          finalUrl: page.url(),
        };
      } catch {
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
export async function simulateHumanBehavior(page: Page): Promise<void> {
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
  } catch {
    // Ignore errors in simulation
  }
}

export default {
  isCloudflareChallenge,
  waitForCloudflareChallenge,
  gotoWithCloudflare,
  simulateHumanBehavior,
};
