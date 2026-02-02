// tests/test-cloudflare.js
/**
 * Test Cloudflare protection handling
 * 
 * Run with: node tests/test-cloudflare.js
 */

const { gotoWithCloudflare, simulateHumanBehavior } = require('../helpers/cloudflareHelper');
const { getBrowserContext } = require('../utils/pageFactory');

async function testCloudflareProtection() {
  console.log('🧪 Testing Cloudflare Protection Handling\n');

  let context;
  let page;

  try {
    // Get browser context
    console.log('1️⃣  Initializing browser context...');
    context = await getBrowserContext();
    page = await context.newPage();
    console.log('✅ Browser ready\n');

    // Test URL - replace with the BMW site or any Cloudflare-protected site
    const testUrl = process.argv[2] || 'https://bmw.websites.dealerinspire.com';
    
    console.log(`2️⃣  Navigating to: ${testUrl}`);
    console.log('⏳ This may take 30-60 seconds if Cloudflare challenge is present...\n');

    const startTime = Date.now();
    const result = await gotoWithCloudflare(page, testUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
      cfTimeout: 30000,
      humanDelay: true
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    // Report results
    console.log('\n📊 Navigation Results:');
    console.log(`⏱️  Time elapsed: ${elapsed}s`);
    console.log(`🌐 Success: ${result.success}`);
    console.log(`🚫 Blocked: ${result.blocked}`);
    console.log(`☁️  Cloudflare encountered: ${result.cloudflareEncountered}`);
    console.log(`📡 Status code: ${result.response?.status() || 'N/A'}\n`);

    if (result.success) {
      console.log('3️⃣  Adding human-like behavior...');
      await simulateHumanBehavior(page);
      console.log('✅ Human behavior simulated\n');

      // Get page title and URL
      const title = await page.title();
      const finalUrl = page.url();
      
      console.log('4️⃣  Page Information:');
      console.log(`📄 Title: ${title}`);
      console.log(`🔗 URL: ${finalUrl}\n`);

      // Check if we're actually on the site or still blocked
      const content = await page.content();
      const isStillBlocked = 
        content.includes('Cloudflare') && 
        (title.includes('Just a moment') || content.includes('cf-challenge'));

      if (isStillBlocked) {
        console.log('⚠️  WARNING: Page loaded but might still be in Cloudflare challenge');
        console.log('💡 Tip: Try running in non-headless mode (HEADLESS=false npm start)\n');
      } else {
        console.log('✅ Successfully bypassed protection!\n');
        
        // Save a screenshot as proof
        await page.screenshot({ path: 'tests/cloudflare-test-success.png' });
        console.log('📸 Screenshot saved to: tests/cloudflare-test-success.png\n');
      }

    } else {
      console.log('❌ Failed to bypass Cloudflare protection\n');
      console.log('💡 Troubleshooting tips:');
      console.log('   1. Run in non-headless mode: HEADLESS=false npm start');
      console.log('   2. Manually complete the challenge once');
      console.log('   3. The persistent browser will remember the clearance');
      console.log('   4. Try using a VPN or proxy');
      console.log('   5. Check docs/CLOUDFLARE.md for more solutions\n');

      // Save screenshot of blocked page
      await page.screenshot({ path: 'tests/cloudflare-test-blocked.png' });
      console.log('📸 Screenshot saved to: tests/cloudflare-test-blocked.png\n');
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(`   ${error.message}\n`);

    if (error.cloudflareBlocked) {
      console.log('☁️  Cloudflare block detected in error state');
    }

    // Try to save screenshot even on error
    if (page) {
      try {
        await page.screenshot({ path: 'tests/cloudflare-test-error.png' });
        console.log('📸 Error screenshot saved to: tests/cloudflare-test-error.png\n');
      } catch (screenshotErr) {
        // Ignore screenshot errors
      }
    }

  } finally {
    // Cleanup
    if (page) {
      await page.close();
    }
    console.log('🧹 Cleanup complete');
  }
}

// Run the test
console.log('═══════════════════════════════════════════════════════');
console.log('     Cloudflare Protection Test');
console.log('═══════════════════════════════════════════════════════\n');

testCloudflareProtection()
  .then(() => {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ Test completed');
    console.log('═══════════════════════════════════════════════════════\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test crashed:', err);
    process.exit(1);
  });
