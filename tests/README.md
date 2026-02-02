# Test Scripts

This folder contains test scripts for validating the Browser Automation API functionality.

---

## Available Tests

### 1. test-storage-adapter.js
Tests storage adapter functionality for all storage types (local, BeDrive, WordPress).

**What it tests:**
- Storage adapter initialization
- HTML file saving
- HTML file retrieval
- Storage statistics
- Error handling

**Usage:**
```bash
node test-storage-adapter.js
```

**Prerequisites:**
- Configure storage type in `.env`
- For cloud storage, ensure credentials are set

**Expected Output:**
```
Created storage adapter: local
--- Testing saveHtml() ---
✅ saveHtml() successful
--- Testing getHtml() ---
✅ getHtml() successful
--- Testing getStats() ---
✅ getStats() successful
✅ All tests passed!
```

---

### 2. test-wordpress-storage.js
Tests WordPress Media API storage adapter specifically.

**What it tests:**
- WordPress API authentication
- File upload to Media Library
- File download from WordPress
- Storage statistics
- Cleanup error handling (should fail)
- Storage type detection

**Usage:**
```bash
# Set WordPress credentials in .env first
node test-wordpress-storage.js
```

**Prerequisites:**
- WordPress site with HTTPS
- Application password generated
- HTML file uploads enabled
- Environment variables:
  ```env
  WORDPRESS_URL=https://your-site.com
  WORDPRESS_USERNAME=admin
  WORDPRESS_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
  ```

**Expected Output:**
```
=== WordPress Storage Adapter Test ===

✅ Environment variables found
✅ WordPress adapter initialized

--- Test 1: saveHtml() ---
✅ saveHtml() successful
   WordPress Media ID: 123
   Media URL: https://...

--- Test 2: getHtml() ---
✅ getHtml() successful
✅ HTML content verified

--- Test 3: getStats() ---
✅ getStats() successful

--- Test 4: cleanup() ---
✅ cleanup() correctly throws error

--- Test 5: getType() ---
✅ getType() successful

=== All Tests Passed! ===
```

**Note:** This test uploads a file to WordPress. You may want to delete it from the Media Library afterwards.

---

### 3. test-shareable-link.js
Tests BeDrive shareable link generation.

**What it tests:**
- BeDrive shareable link creation
- Link retrieval
- Link format validation

**Usage:**
```bash
node test-shareable-link.js
```

**Prerequisites:**
- BeDrive storage configured in `.env`
- Valid BeDrive API key
- Environment variables:
  ```env
  BEDRIVE_URL=https://your-bedrive.com
  BEDRIVE_API_KEY=sk_live_...
  ```

---

### 4. test-cloudflare.js
Tests Cloudflare protection handling and anti-bot bypass mechanisms.

**What it tests:**
- Cloudflare challenge detection
- Automatic challenge waiting
- Human-like behavior simulation
- Stealth mode configuration
- Navigation success/failure

**Usage:**
```bash
# Test with default BMW site
node tests/test-cloudflare.js

# Test with custom URL
node tests/test-cloudflare.js https://your-site-with-cloudflare.com
```

**Prerequisites:**
- Browser context initialized
- For best results, run in non-headless mode first:
  ```bash
  HEADLESS=false node tests/test-cloudflare.js
  ```

**Expected Output:**
```
🧪 Testing Cloudflare Protection Handling

1️⃣  Initializing browser context...
✅ Browser ready

2️⃣  Navigating to: https://example.com
⏳ This may take 30-60 seconds if Cloudflare challenge is present...

[Cloudflare] Detected challenge, waiting for clearance...
[Cloudflare] Challenge passed successfully!

📊 Navigation Results:
⏱️  Time elapsed: 15.32s
🌐 Success: true
🚫 Blocked: false
☁️  Cloudflare encountered: true

✅ Successfully bypassed protection!
📸 Screenshot saved to: tests/cloudflare-test-success.png
```

**Troubleshooting:**
- If test fails, run in non-headless mode and complete challenge manually once
- Persistent browser will remember clearance tokens
- See [docs/CLOUDFLARE.md](../docs/CLOUDFLARE.md) for detailed solutions

---

## Running All Tests

Run tests sequentially:

```bash
# Test current storage configuration
node test-storage-adapter.js

# Test WordPress storage (if configured)
node test-wordpress-storage.js

# Test BeDrive links (if configured)
node test-shareable-link.js

# Test Cloudflare protection
node tests/test-cloudflare.js
```

---

## Troubleshooting

### Test Failures

**"Environment variables not set"**
- Ensure `.env` file exists in project root
- Verify required variables are set
- Check variable names (case-sensitive)

**"Connection refused" / "Network errors"**
- Check API URLs are correct
- Verify credentials are valid
- Test connectivity: `curl https://your-api-url`

**"Authentication failed"**
- Verify API keys/passwords
- Check WordPress application password (not account password)
- Ensure credentials have proper permissions

**"File upload failed"**
- Check storage quota/limits
- Verify file size is within limits
- For WordPress: Enable HTML file uploads

### Test Output

Tests create temporary files:
- Local storage: `./scraped_html/test*.html`
- BeDrive: Files in configured folder
- WordPress: Files in Media Library

**Cleanup:**
- Local: Files auto-deleted by cleanup
- BeDrive: Delete manually from web UI
- WordPress: Delete from Media Library

---

## Test Development

### Adding New Tests

1. Create test file: `test-feature-name.js`
2. Import required modules:
   ```javascript
   require('dotenv').config();
   const AdapterClass = require('../utils/storage/AdapterClass');
   ```
3. Write test functions
4. Handle errors appropriately
5. Exit with proper code (0 = success, 1 = failure)

### Test Template

```javascript
// test-new-feature.js
require('dotenv').config();

async function testFeature() {
  console.log('=== Feature Test ===\n');

  try {
    // Test code here
    console.log('✅ Test passed');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testFeature()
  .then(() => {
    console.log('\n✅ All tests passed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test error:', error);
    process.exit(1);
  });
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: |
          cd tests
          node test-storage-adapter.js
        env:
          STORAGE_TYPE: local
```

---

## Additional Resources

- [Setup Guide](../docs/SETUP.md) - Installation and configuration
- [Storage Guide](../docs/STORAGE.md) - Storage configuration details
- [API Reference](../README.md) - Complete API documentation

---

## Support

For issues with tests:

1. Check environment configuration
2. Review error messages
3. Verify API connectivity
4. Check documentation
5. Review logs: `tail -f ../logs/*.log`
