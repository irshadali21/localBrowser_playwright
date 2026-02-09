# Cloudflare Protection & SSL/Redirect Handling

This guide covers Cloudflare protection bypass, SSL certificate handling, and automatic redirect following.

---

## Quick Start

### Test Everything Right Now

```bash
# Test SSL error handling
node tests/test-ssl-and-redirects.js https://sftoyota.com/

# Test Cloudflare bypass
node tests/test-cloudflare.js https://bmw.websites.dealerinspire.com

# Test redirect following
node tests/test-ssl-and-redirects.js
```

---

## What This Handles

### ✅ SSL Certificate Errors

Automatically ignores invalid, expired, or misconfigured SSL certificates:

```bash
# These now work without errors:
node tests/test-ssl-and-redirects.js https://sftoyota.com/
```

### ✅ Cloudflare Protection

Automatically detects and bypasses Cloudflare JavaScript challenges:

```javascript
// Cloudflare handling is enabled by default
const result = await visitUrl('https://protected-site.com');
// Waits 15-30 seconds for challenge completion
```

### ✅ Redirect Tracking

Follows all redirects (HTTP and JavaScript) and returns both URLs:

```json
{
  "requestedUrl": "https://example.com/",
  "finalUrl": "https://example.com/en"
}
```

---

## Implemented Solutions

### 1. Browser Stealth Configuration

Enhanced browser launch arguments mask automation detection:

- Disabled automation flags (`AutomationControlled`)
- Real browser fingerprints (plugins, languages, chrome object)
- Updated User-Agent strings
- Locale and timezone settings
- **SSL certificate error handling** (ignores invalid/expired certificates)

### 2. Cloudflare Challenge Detection & Waiting

The `cloudflareHelper.js` module provides:

- **Automatic detection** of Cloudflare challenges
- **Smart waiting** for challenges to complete (up to 30s)
- **Human-like behavior** simulation (mouse movement, scrolling)

### 3. Automatic Redirect Handling

The system automatically:

- **Follows all HTTP redirects** (301, 302, 307, 308)
- **Handles JavaScript redirects** (waits for client-side redirects)
- **Tracks redirect chains** (from initial URL to final destination)
- **Returns final URL** in results

### 4. Persistent Browser Context

Your existing persistent context in `profile-data/` helps by:

- Maintaining cookies across sessions
- Preserving Cloudflare clearance tokens
- Building trust over multiple visits

---

## How It Works

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

### SSL + Redirect + Cloudflare

```
https://bad-cert-site.com
  ↓ Ignore SSL error
https://bad-cert-site.com (loaded)
  ↓ Redirect
https://bad-cert-site.com/en
  ↓ Cloudflare
https://bad-cert-site.com/en (after challenge)
```

---

## Usage Examples

### Basic Usage (Automatic)

```javascript
// Handles Cloudflare, SSL errors, and redirects automatically
const result = await visitUrl('https://example.com');
// If redirected, result includes both requestedUrl and finalUrl
```

### Advanced Options

```javascript
const result = await visitUrl('https://example.com', {
  waitUntil: 'networkidle',
  timeout: 60000,
  handleCloudflare: true, // Enable Cloudflare handling (default: true)
  saveToFile: true,
  returnHtml: false,
});

// Check if site redirected
if (result.finalUrl !== result.requestedUrl) {
  console.log(`Redirected: ${result.requestedUrl} → ${result.finalUrl}`);
}
```

### Disable Cloudflare Handling

```javascript
// For sites you know don't use Cloudflare
const result = await visitUrl('https://example.com', {
  handleCloudflare: false,
});
```

### Direct Cloudflare Helper Usage

```javascript
const { gotoWithCloudflare } = require('./helpers/cloudflareHelper');

const result = await gotoWithCloudflare(page, url, {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
  cfTimeout: 30000, // Max time to wait for challenge
  humanDelay: true, // Add random delay before navigation
});

if (result.blocked) {
  console.error('Still blocked by Cloudflare');
} else if (result.cloudflareEncountered) {
  console.log('Passed Cloudflare challenge');
}
```

---

## API Usage

### Visit URL with Cloudflare Protection

```bash
curl -X POST http://localhost:5000/browser/visit \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://bmw.websites.dealerinspire.com",
    "options": {
      "handleCloudflare": true,
      "timeout": 60000
    }
  }'
```

**Response with redirect:**

```json
{
  "success": true,
  "fileId": "abc123def456...",
  "url": "https://bmw.websites.dealerinspire.com/en",
  "requestedUrl": "https://bmw.websites.dealerinspire.com",
  "finalUrl": "https://bmw.websites.dealerinspire.com/en",
  "shareableLink": "https://storage.com/share/abc123..."
}
```

---

## Troubleshooting

### Cloudflare Still Blocks You

1. **Run in Non-Headless Mode**

   ```bash
   HEADLESS=false npm start
   ```

   This shows the actual browser and makes detection harder.

2. **Manual Cookie Collection**
   - Run in non-headless mode
   - Visit the site manually and complete the challenge
   - The cookies will be saved to `profile-data/`
   - Future automated requests will use those cookies

3. **Increase Delays**

   ```javascript
   const result = await visitUrl(url, {
     timeout: 120000, // Give more time for challenges
   });
   ```

4. **Use Residential Proxies**
   Some sites require residential IPs. Add to `playwrightConfig.js`:

   ```javascript
   proxy: {
     server: 'http://proxy-server:port',
     username: 'user',
     password: 'pass'
   }
   ```

5. **Rotate User Agents**
   Modify `utils/pageFactory.js` to use different user agents per session.

6. **Add More Human Behavior**
   Use the `simulateHumanBehavior()` function more frequently:

   ```javascript
   const { simulateHumanBehavior } = require('./helpers/cloudflareHelper');

   await page.goto(url);
   await simulateHumanBehavior(page); // Mouse movements, scrolling
   await page.click('selector');
   await simulateHumanBehavior(page); // More human behavior
   ```

### Error: "ERR_CERT_COMMON_NAME_INVALID"

✅ **Automatically handled** - SSL certificate errors are now ignored by default.

If you still see this error, verify:

- `ignoreHTTPSErrors: true` is set in `playwrightConfig.js`
- Browser arguments include `--ignore-certificate-errors`

### Error: "Cloudflare challenge failed"

- **Solution**: Run in non-headless mode and let the challenge complete manually first
- The persistent browser will remember the clearance

### Error: "Navigation timeout"

- **Solution**: Increase timeout or change waitUntil strategy

```javascript
visitUrl(url, {
  timeout: 120000,
  waitUntil: 'domcontentloaded',
});
```

### Site still blocking after challenge passes

- Some sites require multiple visits to build trust
- Try visiting their homepage first, then the target page
- Consider using residential proxies

### Challenge keeps appearing

- Your IP may be flagged
- Try using a VPN or proxy
- Increase delays between requests

---

## Technical Details

### Challenge Detection

The helper checks for:

- Page title containing "Just a moment" or "Please Wait"
- HTML content with Cloudflare-specific strings
- Cloudflare challenge form elements

### Challenge Waiting

- Polls every 1 second (configurable)
- Waits up to 30 seconds by default (configurable)
- Verifies challenge clearance before proceeding

### Anti-Detection Measures

- Navigator properties overridden (webdriver, plugins, languages)
- Chrome object mocked
- Random delays between actions
- Mouse movements and scrolling
- Real browser fingerprint emulation

### SSL Certificate Handling

- `ignoreHTTPSErrors: true` in browser context
- `--ignore-certificate-errors` browser argument
- `--ignore-certificate-errors-spki-list` browser argument

### Redirect Tracking

- HTTP redirects: Auto-followed by Playwright
- JavaScript redirects: 1-second wait for `window.location` changes
- Both `requestedUrl` and `finalUrl` returned in response

---

## Performance Impact

| Scenario                      | Time                         |
| ----------------------------- | ---------------------------- |
| Normal site (no Cloudflare)   | 2-5 seconds                  |
| With redirects                | 3-6 seconds                  |
| With Cloudflare (first visit) | 15-30 seconds                |
| SSL errors                    | No additional time           |
| After Cloudflare clearance    | 2-5 seconds (cookies cached) |

---

## Configuration Options

### Disable Cloudflare Handling

```javascript
visitUrl(url, {
  handleCloudflare: false, // Use old behavior
});
```

### Adjust Timeouts

```javascript
visitUrl(url, {
  timeout: 90000, // Overall navigation timeout
  cfTimeout: 45000, // Cloudflare-specific timeout
});
```

### Adjust Redirect Wait Time

```javascript
// In cloudflareHelper.js
await page.waitForTimeout(2000); // Wait 2 seconds for JS redirects
```

### Disable SSL Error Handling (Not Recommended)

```javascript
// In playwrightConfig.js
// Comment out: ignoreHTTPSErrors: true,
```

---

## Best Practices

1. **Always test in non-headless first** when encountering new Cloudflare implementations
2. **Reuse the persistent context** - don't clear profile-data/ unnecessarily
3. **Add delays** between requests to the same domain (5-10 seconds minimum)
4. **Rotate IPs** if scraping at scale
5. **Monitor for blocks** and implement exponential backoff
6. **Respect rate limits** - aggressive scraping leads to permanent bans

---

## Alternative Solutions

If the built-in solutions don't work:

1. **Use a Cloudflare bypass service** (external API)
2. **Browser with real human interaction** (manual intervention)
3. **Use their official API** if available
4. **Contact site owner** for scraping permission

---

## Related Documentation

- [Setup Guide](SETUP.md)
- [Storage Configuration](STORAGE.md)
- [API Documentation](API_DOCUMENTATION.md)
- [Common Issues](COMMON_ISSUES.md)
