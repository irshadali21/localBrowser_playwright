/**
 * Unit Tests for Validation Schemas
 * Tests Zod validation schemas for API inputs
 */

const assert = require('assert');

async function runTests() {
  console.log('Running Validation Schema Tests...\n');
  
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
  
  const { validateInput, visitUrlSchema, executeCodeSchema, googleSearchSchema, cleanupSchema } = 
    await import('../validators/schemas.js');
  
  // Visit URL Schema Tests
  test('Valid HTTPS URL passes', () => {
    const result = validateInput(visitUrlSchema, {
      url: 'https://example.com',
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    assert.strictEqual(result.success, true, 'Valid URL should pass');
  });
  
  test('Valid HTTP URL passes', () => {
    const result = validateInput(visitUrlSchema, {
      url: 'http://example.com',
    });
    assert.strictEqual(result.success, true, 'HTTP URL should pass');
  });
  
  test('URL without protocol fails', () => {
    const result = validateInput(visitUrlSchema, {
      url: 'example.com',
    });
    assert.strictEqual(result.success, false, 'URL without protocol should fail');
  });
  
  test('Invalid URL format fails', () => {
    const result = validateInput(visitUrlSchema, {
      url: 'not-a-url',
    });
    assert.strictEqual(result.success, false, 'Invalid URL should fail');
  });
  
  test('Empty URL fails', () => {
    const result = validateInput(visitUrlSchema, {
      url: '',
    });
    assert.strictEqual(result.success, false, 'Empty URL should fail');
  });
  
  test('Valid waitUntil options pass', () => {
    ['load', 'domcontentloaded', 'networkidle', 'commit'].forEach((option) => {
      const result = validateInput(visitUrlSchema, {
        url: 'https://example.com',
        waitUntil: option,
      });
      assert.strictEqual(result.success, true, `${option} should be valid`);
    });
  });
  
  test('Invalid waitUntil fails', () => {
    const result = validateInput(visitUrlSchema, {
      url: 'https://example.com',
      waitUntil: 'invalid',
    });
    assert.strictEqual(result.success, false, 'Invalid waitUntil should fail');
  });
  
  test('Valid timeout passes', () => {
    const result = validateInput(visitUrlSchema, {
      url: 'https://example.com',
      timeout: 60000,
    });
    assert.strictEqual(result.success, true, 'Valid timeout should pass');
  });
  
  test('Timeout too long fails', () => {
    const result = validateInput(visitUrlSchema, {
      url: 'https://example.com',
      timeout: 600000, // More than max (5 minutes)
    });
    assert.strictEqual(result.success, false, 'Timeout too long should fail');
  });
  
  // Execute Code Schema Tests
  test('Valid code passes', () => {
    const result = validateInput(executeCodeSchema, {
      code: 'return document.title;',
    });
    assert.strictEqual(result.success, true, 'Valid code should pass');
  });
  
  test('Empty code fails', () => {
    const result = validateInput(executeCodeSchema, {
      code: '',
    });
    assert.strictEqual(result.success, false, 'Empty code should fail');
  });
  
  test('Code too long fails', () => {
    const result = validateInput(executeCodeSchema, {
      code: 'x'.repeat(10001),
    });
    assert.strictEqual(result.success, false, 'Code too long should fail');
  });
  
  // Google Search Schema Tests
  test('Valid search query passes', () => {
    const result = validateInput(googleSearchSchema, {
      q: 'test query',
    });
    assert.strictEqual(result.success, true, 'Valid query should pass');
  });
  
  test('Empty search query fails', () => {
    const result = validateInput(googleSearchSchema, {
      q: '',
    });
    assert.strictEqual(result.success, false, 'Empty query should fail');
  });
  
  test('Query too long fails', () => {
    const result = validateInput(googleSearchSchema, {
      q: 'x'.repeat(501),
    });
    assert.strictEqual(result.success, false, 'Query too long should fail');
  });
  
  // Cleanup Schema Tests
  test('Valid maxAge passes', () => {
    const result = validateInput(cleanupSchema, {
      maxAge: 24,
    });
    assert.strictEqual(result.success, true, 'Valid maxAge should pass');
  });
  
  test('MaxAge too long fails', () => {
    const result = validateInput(cleanupSchema, {
      maxAge: 1000,
    });
    assert.strictEqual(result.success, false, 'MaxAge too long should fail');
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

runTests().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
