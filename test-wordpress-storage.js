// test-wordpress-storage.js
/**
 * Test script for WordPress Storage Adapter
 * 
 * Usage:
 *   node test-wordpress-storage.js
 * 
 * Prerequisites:
 *   - WordPress site with HTTPS or localhost
 *   - Application password generated
 *   - HTML file uploads enabled
 *   - Environment variables set (WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_PASSWORD)
 */

require('dotenv').config();
const WordPressStorageAdapter = require('./utils/storage/WordPressStorageAdapter');

async function testWordPressStorage() {
  console.log('=== WordPress Storage Adapter Test ===\n');

  // Check environment variables
  if (!process.env.WORDPRESS_URL) {
    console.error('❌ WORDPRESS_URL not set in .env file');
    process.exit(1);
  }
  if (!process.env.WORDPRESS_USERNAME) {
    console.error('❌ WORDPRESS_USERNAME not set in .env file');
    process.exit(1);
  }
  if (!process.env.WORDPRESS_PASSWORD) {
    console.error('❌ WORDPRESS_PASSWORD not set in .env file');
    process.exit(1);
  }

  console.log('✅ Environment variables found');
  console.log(`   Site: ${process.env.WORDPRESS_URL}`);
  console.log(`   User: ${process.env.WORDPRESS_USERNAME}\n`);

  // Initialize adapter
  const storage = new WordPressStorageAdapter({
    url: process.env.WORDPRESS_URL,
    username: process.env.WORDPRESS_USERNAME,
    password: process.env.WORDPRESS_PASSWORD
  });

  console.log('✅ WordPress adapter initialized\n');

  // Test 1: Save HTML
  console.log('--- Test 1: saveHtml() ---');
  const fileId = 'test' + Date.now().toString(36);
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>WordPress Storage Test</title>
</head>
<body>
  <h1>Test HTML File</h1>
  <p>This is a test file uploaded to WordPress Media Library.</p>
  <p>File ID: ${fileId}</p>
  <p>Timestamp: ${new Date().toISOString()}</p>
</body>
</html>
  `;
  const url = 'https://example.com/test';

  try {
    const saveResult = await storage.saveHtml(fileId, html, url);
    console.log('✅ saveHtml() successful');
    console.log('   File ID:', saveResult.fileId);
    console.log('   File Name:', saveResult.fileName);
    console.log('   WordPress Media ID:', saveResult.cloudFileId);
    console.log('   Media URL:', saveResult.mediaUrl);
    console.log('   Media Link:', saveResult.mediaLink);
    console.log('   File Size:', saveResult.fileSizeKB);
    console.log('');
  } catch (error) {
    console.error('❌ saveHtml() failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }

  // Test 2: Get HTML
  console.log('--- Test 2: getHtml() ---');
  try {
    const getResult = await storage.getHtml(fileId);
    console.log('✅ getHtml() successful');
    console.log('   File ID:', getResult.fileId);
    console.log('   File Name:', getResult.fileName);
    console.log('   WordPress Media ID:', getResult.cloudFileId);
    console.log('   HTML Length:', getResult.html.length, 'characters');
    console.log('   Created At:', getResult.createdAt);
    console.log('');

    // Verify HTML content matches
    if (getResult.html.includes(fileId)) {
      console.log('✅ HTML content verified (fileId found in content)');
    } else {
      console.warn('⚠️  Warning: FileId not found in retrieved HTML');
    }
    console.log('');
  } catch (error) {
    console.error('❌ getHtml() failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }

  // Test 3: Get Stats
  console.log('--- Test 3: getStats() ---');
  try {
    const stats = await storage.getStats();
    console.log('✅ getStats() successful');
    console.log('   File Count:', stats.fileCount);
    console.log('   Total Size:', stats.totalSizeMB, 'MB');
    console.log('   Average Size:', stats.averageSizeMB, 'MB');
    console.log('   Storage Type:', stats.storageType);
    console.log('   Cloud Provider:', stats.cloudProvider);
    if (stats.note) {
      console.log('   Note:', stats.note);
    }
    console.log('');
  } catch (error) {
    console.error('❌ getStats() failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }

  // Test 4: Cleanup (should throw error)
  console.log('--- Test 4: cleanup() ---');
  try {
    await storage.cleanup(24);
    console.error('❌ cleanup() should have thrown an error');
    process.exit(1);
  } catch (error) {
    console.log('✅ cleanup() correctly throws error');
    console.log('   Message:', error.message);
    console.log('');
  }

  // Test 5: Get Type
  console.log('--- Test 5: getType() ---');
  const type = storage.getType();
  console.log('✅ getType() successful');
  console.log('   Type:', type);
  console.log('');

  console.log('=== All Tests Passed! ===\n');
  console.log('⚠️  Note: Test file uploaded to WordPress Media Library');
  console.log('   You may want to delete it manually from WordPress admin.');
  console.log('');
}

// Run tests
testWordPressStorage()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  });
