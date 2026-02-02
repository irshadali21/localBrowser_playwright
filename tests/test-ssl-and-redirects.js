// tests/test-ssl-and-redirects.js
/**
 * Test SSL certificate handling and redirect following
 * 
 * Run with: node tests/test-ssl-and-redirects.js
 */

const { gotoWithCloudflare } = require('../helpers/cloudflareHelper');
const { getBrowserContext } = require('../utils/pageFactory');

async function testSslAndRedirects() {
  console.log('🧪 Testing SSL Certificate Handling & Redirects\n');

  let context;
  let page;

  try {
    // Get browser context
    console.log('1️⃣  Initializing browser context...');
    context = await getBrowserContext();
    page = await context.newPage();
    console.log('✅ Browser ready\n');

    // Test cases: [url, description]
    const testCases = [
      ['https://sftoyota.com/', 'Toyota site with SSL issue'],
      ['http://github.com', 'GitHub HTTP to HTTPS redirect'],
      ['https://www.google.com', 'No redirect (baseline)'],
    ];

    // Allow custom URL from command line
    if (process.argv[2]) {
      testCases.unshift([process.argv[2], 'Custom URL']);
    }

    for (let i = 0; i < testCases.length; i++) {
      const [url, description] = testCases[i];
      
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Test ${i + 1}/${testCases.length}: ${description}`);
      console.log(`URL: ${url}`);
      console.log('='.repeat(70));

      try {
        const startTime = Date.now();
        
        console.log('⏳ Navigating...');
        const result = await gotoWithCloudflare(page, url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
          cfTimeout: 20000,
          humanDelay: false  // Skip delay for faster testing
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n📊 Results:');
        console.log(`   ⏱️  Time: ${elapsed}s`);
        console.log(`   🌐 Success: ${result.success}`);
        console.log(`   🚫 Blocked: ${result.blocked}`);
        console.log(`   ☁️  Cloudflare: ${result.cloudflareEncountered}`);
        console.log(`   📡 Status: ${result.response?.status() || 'N/A'}`);
        
        // Check for redirects
        const finalUrl = result.finalUrl || page.url();
        const wasRedirected = finalUrl !== url;
        
        console.log(`\n🔗 URL Information:`);
        console.log(`   Requested: ${url}`);
        console.log(`   Final URL: ${finalUrl}`);
        
        if (wasRedirected) {
          console.log(`   ✅ REDIRECT DETECTED AND FOLLOWED`);
          
          // Extract redirect details
          const originalDomain = new URL(url).hostname;
          const finalDomain = new URL(finalUrl).hostname;
          const originalPath = new URL(url).pathname;
          const finalPath = new URL(finalUrl).pathname;
          
          if (originalDomain !== finalDomain) {
            console.log(`   📍 Domain change: ${originalDomain} → ${finalDomain}`);
          }
          if (originalPath !== finalPath) {
            console.log(`   📍 Path change: ${originalPath} → ${finalPath}`);
          }
        } else {
          console.log(`   ℹ️  No redirect (same as requested)`);
        }

        // Get page title
        const title = await page.title();
        console.log(`\n📄 Page Info:`);
        console.log(`   Title: ${title.substring(0, 60)}${title.length > 60 ? '...' : ''}`);

        // Check for SSL errors (should be handled)
        const content = await page.content();
        const hasSSLError = content.toLowerCase().includes('ssl') && 
                          (content.toLowerCase().includes('error') || 
                           content.toLowerCase().includes('certificate'));
        
        if (hasSSLError) {
          console.log(`\n   ⚠️  WARNING: Page may contain SSL error content`);
        } else {
          console.log(`\n   ✅ No SSL errors detected`);
        }

        console.log(`\n✅ Test PASSED`);

      } catch (error) {
        console.error(`\n❌ Test FAILED`);
        console.error(`   Error: ${error.message}`);
        
        // Check error type
        if (error.message.includes('ERR_CERT')) {
          console.error(`\n   🔴 SSL CERTIFICATE ERROR NOT HANDLED`);
          console.error(`   This should have been ignored by ignoreHTTPSErrors`);
        } else if (error.message.includes('Timeout')) {
          console.error(`\n   ⏱️  TIMEOUT ERROR`);
          console.error(`   Site may be slow or unreachable`);
        } else if (error.cloudflareBlocked) {
          console.error(`\n   ☁️  CLOUDFLARE BLOCKING`);
        }
        
        // Try to get current URL even on error
        try {
          const currentUrl = page.url();
          if (currentUrl) {
            console.error(`\n   Current URL: ${currentUrl}`);
          }
        } catch (urlErr) {
          // Ignore
        }
      }

      // Wait between tests
      if (i < testCases.length - 1) {
        console.log('\n⏳ Waiting 2 seconds before next test...');
        await page.waitForTimeout(2000);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 Summary');
    console.log('='.repeat(70));
    console.log('✅ All tests completed');
    console.log('\n💡 Key Points:');
    console.log('   • SSL certificate errors should be automatically ignored');
    console.log('   • Redirects should be followed automatically');
    console.log('   • Final URL should reflect any redirects (including /en, etc.)');
    console.log('   • Cloudflare challenges should be detected and handled');

  } catch (error) {
    console.error('\n❌ Test suite crashed:', error.message);
    console.error(error.stack);

  } finally {
    // Cleanup
    if (page) {
      await page.close();
    }
    console.log('\n🧹 Cleanup complete\n');
  }
}

// Run the test
console.log('═══════════════════════════════════════════════════════════════════');
console.log('     SSL Certificate & Redirect Handling Test');
console.log('═══════════════════════════════════════════════════════════════════\n');

testSslAndRedirects()
  .then(() => {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('✅ Test suite completed successfully');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  });
