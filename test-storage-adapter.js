// Test script to verify storage adapter integration
const StorageFactory = require('./utils/storage/StorageFactory');

async function testStorageAdapter() {
  console.log('\n=== Testing Storage Adapter ===\n');
  
  // Get storage configuration
  const config = StorageFactory.getStorageConfig();
  console.log('Storage Configuration:');
  console.log(JSON.stringify(config, null, 2));
  
  // Create storage adapter based on env
  const storage = StorageFactory.createStorage();
  console.log(`\nCreated storage adapter: ${storage.getType()}`);
  
  // Test saving HTML
  console.log('\n--- Testing saveHtml() ---');
  const testHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Test Page</title></head>
      <body><h1>Test Content</h1></body>
    </html>
  `;
  
  try {
    const result = await storage.saveHtml('test123', testHtml, 'http://example.com');
    console.log('Save result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Test retrieving HTML
    console.log('\n--- Testing getHtml() ---');
    const retrieved = await storage.getHtml('test123');
    console.log(`Retrieved ${retrieved.fileSizeBytes} bytes`);
    console.log(`HTML matches: ${retrieved.html === testHtml}`);
    
    // Test getting stats
    console.log('\n--- Testing getStats() ---');
    const stats = await storage.getStats();
    console.log('Storage stats:');
    console.log(JSON.stringify(stats, null, 2));
    
    // Test cleanup (only for local storage)
    if (storage.getType() === 'local') {
      console.log('\n--- Testing cleanup() ---');
      const cleanupResult = await storage.cleanup(0); // Delete all files
      console.log('Cleanup result:');
      console.log(JSON.stringify(cleanupResult, null, 2));
    } else {
      console.log('\n--- Skipping cleanup() (cloud storage) ---');
      console.log('Cloud storage does not support cleanup');
    }
    
    console.log('\n✅ All tests passed!\n');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run tests
testStorageAdapter().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
