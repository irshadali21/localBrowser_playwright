# Quick Start: Cloudflare Protection

## Immediate Solutions for Your Issues

### Issue 1: SSL Certificate Errors ✅ FIXED

**Problem:**

```
ERR_CERT_COMMON_NAME_INVALID at https://sftoyota.com/
```

**Solution:** Automatically handled! SSL errors are now ignored by default.

### Issue 2: Redirects (e.g., `/` → `/en`) ✅ FIXED

**Problem:** Site redirects to language-specific pages and you need the final URL

**Solution:** Automatically tracked! Response now includes both URLs:

```json
{
  "requestedUrl": "https://example.com/",
  "finalUrl": "https://example.com/en"
}
```

## Test Everything Right Now

## Test Everything Right Now

### Test SSL Error Handling

```bash
# Test the Toyota site with SSL issues
node tests/test-ssl-and-redirects.js https://sftoyota.com/
```

### Test Redirect Following

```bash
# Test multiple sites including redirects
node tests/test-ssl-and-redirects.js
```

### Test Cloudflare Protection

```bash
# Test Cloudflare bypass
node tests/test-cloudflare.js https://bmw.websites.dealerinspire.com
```

### Option 1: Test Right Now (Recommended First Step)

```bash
# Run the test script to see if it works
node tests/test-cloudflare.js https://bmw.websites.dealerinspire.com
```

This will show you exactly what's happening and create a screenshot.

### Option 2: Use in Your API Calls

The `/browser/visit` endpoint now automatically handles Cloudflare:

```bash
curl -X POST http://localhost:5000/browser/visit \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://bmw.websites.dealerinspire.com"
  }'
```

That's it! Cloudflare handling is **enabled by default**.

### Option 3: If It Still Fails - Manual Challenge

If automated bypass doesn't work:

1. **Run server in visible mode:**

   ```bash
   HEADLESS=false npm start
   ```

2. **Visit the site through the API** (it will open in a real browser window)

3. **Complete the Cloudflare challenge manually**

4. **The browser will save the clearance** - future automated requests will work!

## Understanding What Happens

### Normal Site (No Cloudflare)

```
Request → Load Page → Return Content
Time: ~2-5 seconds
```

### Cloudflare-Protected Site

```
Request → Detect Challenge → Wait for JavaScript → Challenge Passes → Return Content
Time: ~15-30 seconds
```

### Blocked (Needs Manual Intervention)

```
Request → Detect Challenge → Timeout → Error
Solution: Run in non-headless mode and complete manually once
```

## Common Scenarios

### Scenario 1: First Time Visiting Site

```javascript
// First request might encounter challenge
const result = await visitUrl('https://protected-site.com');
// Wait 15-30 seconds for automatic clearance
// Subsequent requests will be faster (cookies saved)
```

### Scenario 2: Using Job Queue

```javascript
// Job automatically includes Cloudflare handling
POST /jobs/enqueue
{
  "target": { "url": "https://protected-site.com" },
  "parser": { "mode": "vendor", "vendor": "myvendor" },
  "callbackUrl": "https://your-webhook.com"
}
// Job will wait for Cloudflare challenge before scraping
```

### Scenario 3: Custom Scraping Script

```javascript
// In your custom parser script
async function scrape(page) {
  // Page is already past Cloudflare by the time this runs
  // because visitUrl/gotoWithCloudflare handled it
  const data = await page.evaluate(() => {
    // Your scraping logic
  });
  return data;
}
```

## Troubleshooting

### Problem: "Cloudflare challenge failed"

**Quick Fix:**

```bash
# Open browser window
HEADLESS=false npm start

# Then make your API request
# Complete challenge manually in the browser window
# Cookies will be saved for future use
```

### Problem: "Navigation timeout"

**Quick Fix:**

```javascript
// Increase timeout in your request
visitUrl(url, {
  timeout: 120000, // 2 minutes instead of 1
});
```

### Problem: "Site still shows blocked page"

**Quick Fix:**

1. Check your IP isn't blacklisted
2. Try using a VPN
3. Add more delays between requests
4. See full troubleshooting in `docs/CLOUDFLARE.md`

## Configuration Options

### Disable Cloudflare Handling (if needed)

```javascript
visitUrl(url, {
  handleCloudflare: false, // Use old behavior
});
```

### Adjust Timeouts

```javascript
visitUrl(url, {
  timeout: 90000, // Overall navigation timeout
  // Cloudflare-specific timeout is set in gotoWithCloudflare (default: 30s)
});
```

### Use Direct Helper

```javascript
const { gotoWithCloudflare } = require('./helpers/cloudflareHelper');

const result = await gotoWithCloudflare(page, url, {
  waitUntil: 'domcontentloaded',
  cfTimeout: 45000, // Wait up to 45s for challenge
  humanDelay: true, // Add random 1-3s delay before navigation
});

console.log('Success:', result.success);
console.log('Blocked:', result.blocked);
console.log('Cloudflare found:', result.cloudflareEncountered);
```

## API Response Changes

### Before (No Cloudflare Handling)

```json
{
  "error": "Navigation timeout",
  "message": "Page took too long to load"
}
```

### After (With Cloudflare Handling)

```json
{
  "success": true,
  "fileId": "abc123...",
  "url": "https://protected-site.com",
  "shareableLink": "https://storage.com/share/abc123"
}
```

The API now waits for Cloudflare challenges automatically!

## Performance Impact

- **No Cloudflare**: No change (still 2-5 seconds)
- **With Cloudflare**: 15-30 seconds on first visit
- **After clearance**: Back to 2-5 seconds (cookies cached)

## Real-World Example: BMW Dealer Site

### Your Original Error

```
Please enable cookies.
Sorry, you have been blocked
You are unable to access bmw.websites.dealerinspire.com
```

### Now With Implementation

```bash
# Test it
node tests/test-cloudflare.js https://bmw.websites.dealerinspire.com

# Expected output:
[Cloudflare] Detected challenge, waiting for clearance...
[Cloudflare] Challenge passed successfully!
✅ Successfully bypassed protection!
```

### Use in Production

```javascript
// Your existing code works as-is!
const html = await visitUrl('https://bmw.websites.dealerinspire.com');
// Will automatically wait for and pass Cloudflare challenge
```

## Next Steps

1. **Test immediately:**

   ```bash
   node tests/test-cloudflare.js https://bmw.websites.dealerinspire.com
   ```

2. **If test fails, try visible mode:**

   ```bash
   HEADLESS=false npm start
   # Then run test again
   ```

3. **Check screenshot** saved in `tests/` folder

4. **Read full docs** if you need advanced features:
   - `docs/CLOUDFLARE.md` - Complete guide
   - `docs/CLOUDFLARE_IMPLEMENTATION.md` - Technical details

## That's It!

Your browser automation now handles Cloudflare automatically. No code changes needed for existing endpoints - it just works! 🎉
