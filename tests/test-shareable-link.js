// Quick test of BeDrive shareable link
require('dotenv').config();
const StorageFactory = require('./utils/storage/StorageFactory');

async function testShareableLink() {
  try {
    console.log('\n=== Testing BeDrive Shareable Link ===\n');
    
    const storage = StorageFactory.createStorage();
    console.log(`Storage type: ${storage.getType()}`);
    
    const testHtml = '<html><body><h1>Test</h1></body></html>';
    const result = await storage.saveHtml('testlink123', testHtml, 'http://example.com');
    
    console.log('\n✅ Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.shareableLink) {
      console.log(`\n🔗 Shareable Link: ${result.shareableLink}`);
    } else {
      console.log(`\n⚠️  No shareable link generated`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testShareableLink();
