/**
 * Integration Tests for TypeScript Migrated Files
 * Tests the refactored browser helper, page factory, and page manager
 */

const assert = require('assert');

/**
 * Test utilities
 */
async function runTests() {
  console.log('Running TypeScript Migration Integration Tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  function test(name, fn) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }
  
  // Test 1: pageFactory module loads
  test('pageFactory loads correctly', async () => {
    const { pageFactory } = await import('../../utils/pageFactory.js');
    assert.ok(pageFactory, 'pageFactory should be exported');
    assert.ok(typeof pageFactory.getConfiguredPage === 'function', 'getConfiguredPage should be a function');
    assert.ok(typeof pageFactory.getBrowserContext === 'function', 'getBrowserContext should be a function');
  });
  
  // Test 2: pageManager module loads
  test('pageManager loads correctly', async () => {
    const { pageManager } = await import('../../utils/pageManager.js');
    assert.ok(pageManager, 'pageManager should be exported');
    assert.ok(typeof pageManager.requestPage === 'function', 'requestPage should be a function');
    assert.ok(typeof pageManager.closePage === 'function', 'closePage should be a function');
    assert.ok(typeof pageManager.listPages === 'function', 'listPages should be a function');
  });
  
  // Test 3: browserHelper module loads
  test('browserHelper loads correctly', async () => {
    const { browserHelper } = await import('../../helpers/browserHelper.js');
    assert.ok(browserHelper, 'browserHelper should be exported');
    assert.ok(typeof browserHelper.getBrowserPage === 'function', 'getBrowserPage should be a function');
    assert.ok(typeof browserHelper.visitUrl === 'function', 'visitUrl should be a function');
    assert.ok(typeof browserHelper.googleSearch === 'function', 'googleSearch should be a function');
  });
  
  // Test 4: DI Container loads
  test('DI Container loads correctly', async () => {
    const { DIContainer, createContainer } = await import('../../di/container.js');
    assert.ok(DIContainer, 'DIContainer should be exported');
    assert.ok(createContainer, 'createContainer should be exported');
    const container = createContainer();
    assert.ok(container instanceof DIContainer, 'createContainer should return DIContainer instance');
    assert.ok(container.has('logger'), 'container should have logger service');
  });
  
  // Test 5: Validation schemas load
  test('Validation schemas load correctly', async () => {
    const schemas = await import('../../validators/schemas.js');
    assert.ok(schemas.visitUrl, 'visitUrlSchema should be exported');
    assert.ok(schemas.executeCode, 'executeCodeSchema should be exported');
    assert.ok(schemas.googleSearch, 'googleSearchSchema should be exported');
    assert.ok(schemas.validateInput, 'validateInput should be exported');
    assert.ok(schemas.createValidationError, 'createValidationError should be exported');
  });
  
  // Test 6: Error classes load
  test('Error classes load correctly', async () => {
    const { BrowserError } = await import('../../types/errors.js');
    assert.ok(BrowserError, 'BrowserError should be exported');
    assert.ok(typeof BrowserError === 'function', 'BrowserError should be a class');
    
    const { AppError } = await import('../../types/errors.js');
    assert.ok(AppError, 'AppError should be exported');
    assert.ok(typeof AppError === 'function', 'AppError should be a class');
  });
  
  // Test 7: Validation functions work
  test('Validation functions work correctly', async () => {
    const { validateInput, visitUrlSchema } = await import('../../validators/schemas.js');
    
    // Valid URL should pass
    const validResult = validateInput(visitUrlSchema, {
      url: 'https://example.com',
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    assert.strictEqual(validResult.success, true, 'Valid URL should pass validation');
    
    // Invalid URL should fail
    const invalidResult = validateInput(visitUrlSchema, {
      url: 'example.com', // Missing protocol
    });
    assert.strictEqual(invalidResult.success, false, 'Invalid URL should fail validation');
  });
  
  // Test 8: pageFactory creates pages
  test('pageFactory creates configured pages', async () => {
    const { getConfiguredPage, getContext } = await import('../../utils/pageFactory.js');
    
    const page = await getConfiguredPage();
    assert.ok(page, 'Page should be created');
    assert.ok(typeof page.goto === 'function', 'Page should have goto method');
    assert.ok(typeof page.evaluate === 'function', 'Page should have evaluate method');
    
    await page.close();
  });
  
  // Test 9: pageManager tracks pages
  test('pageManager creates and tracks pages', async () => {
    const { requestPage, closePage, listPages } = await import('../../utils/pageManager.js');
    
    const { id, page } = await requestPage('browser');
    assert.ok(id > 0, 'Page ID should be greater than 0');
    assert.ok(page, 'Page should be created');
    
    const pages = listPages();
    assert.ok(pages.some((p) => p.id === id), 'List pages should include our page');
    
    closePage(id);
  });
  
  // Test 10: DI Container resolves services
  test('DI Container resolves services', async () => {
    const { getContainer } = await import('../../di/container.js');
    
    const container = getContainer();
    const logger = container.resolve('logger');
    assert.ok(logger, 'Logger should be resolved');
  });
  
  // Test 11: Error classes instantiate correctly
  test('Error classes instantiate correctly', async () => {
    const { BrowserError } = await import('../../types/errors.js');
    const { BrowserErrorCode } = await import('../../types/browser.js');
    
    const error = new BrowserError(
      'Test error',
      BrowserErrorCode.CLOUDFLARE_BLOCKED,
      { test: true }
    );
    
    assert.ok(error instanceof Error, 'BrowserError should be instance of Error');
    assert.strictEqual(error.name, 'BrowserError', 'Error name should be BrowserError');
    assert.strictEqual(error.code, BrowserErrorCode.CLOUDFLARE_BLOCKED, 'Error code should match');
    assert.strictEqual(error.context?.test, true, 'Error context should be preserved');
  });
  
  // Test 12: browserHelper gets pages
  test('browserHelper gets browser pages', async () => {
    const { getBrowserPage } = await import('../../helpers/browserHelper.js');
    
    const page = await getBrowserPage();
    assert.ok(page, 'Page should be returned');
    assert.ok(typeof page.goto === 'function', 'Page should have goto method');
  });
  
  // Summary
  console.log(`\n----------------------------------------`);
  console.log(`Tests: ${passed + failed}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`----------------------------------------`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
