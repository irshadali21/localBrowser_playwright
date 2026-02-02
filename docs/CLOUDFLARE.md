# Cloudflare Protection Handling

This project implements multiple strategies to handle Cloudflare and other anti-bot protection systems, SSL certificate errors, and automatic redirect following.

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
- **Returns final URL** in results (e.g., `/` → `/en` language redirects)

### 4. Persistent Browser Context
Your existing persistent context in `profile-data/` helps by:
- Maintaining cookies across sessions
- Preserving Cloudflare clearance tokens
- Building trust over multiple visits

## Common Issues Handled

### SSL Certificate Errors ✅ FIXED
**Problem:**
```
ERR_CERT_COMMON_NAME_INVALID
ERR_CERT_DATE_INVALID
ERR_CERT_AUTHORITY_INVALID
```

**Solution:** Automatically ignored via `ignoreHTTPSErrors: true` in browser config.

### Language Redirects ✅ FIXED
**Problem:** Site redirects `/` → `/en` or `/es` for language selection

**Solution:** System follows redirects automatically and returns final URL:
```javascript
{
  "requestedUrl": "https://example.com/",
  "finalUrl": "https://example.com/en",
  "fileId": "abc123..."
}
```

## Usage

### Basic Usage (Automatic Handling)
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
  handleCloudflare: true,  // Enable Cloudflare handling (default: true)
  saveToFile: true,
  returnHtml: false
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
  handleCloudflare: false
});
```

### Direct Cloudflare Helper Usage
```javascript
const { gotoWithCloudflare } = require('./helpers/cloudflareHelper');

const result = await gotoWithCloudflare(page, url, {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
  cfTimeout: 30000,      // Max time to wait for challenge
  humanDelay: true       // Add random delay before navigation
});

if (result.blocked) {
  console.error('Still blocked by Cloudflare');
} else if (result.cloudflareEncountered) {
  console.log('Passed Cloudflare challenge');
}
```

## When Cloudflare Still Blocks You

If you're still getting blocked, try these strategies:

### 1. Run in Non-Headless Mode
```bash
HEADLESS=false npm start
```
This shows the actual browser and makes detection harder.

### 2. Manual Cookie Collection
1. Run in non-headless mode
2. Visit the site manually and complete the challenge
3. The cookies will be saved to `profile-data/`
4. Future automated requests will use those cookies

### 3. Increase Delays
```javascript
const result = await visitUrl(url, {
  timeout: 120000  // Give more time for challenges
});
```

### 4. Use Residential Proxies
Some sites require residential IPs. Add to `playwrightConfig.js`:
```javascript
proxy: {
  server: 'http://proxy-server:port',
  username: 'user',
  password: 'pass'
}
```

### 5. Rotate User Agents
Modify `utils/pageFactory.js` to use different user agents per session.

### 6. Add More Human Behavior
Use the `simulateHumanBehavior()` function more frequently:
```javascript
const { simulateHumanBehavior } = require('./helpers/cloudflareHelper');

await page.goto(url);
await simulateHumanBehavior(page);  // Mouse movements, scrolling
await page.click('selector');
await simulateHumanBehavior(page);  // More human behavior
```

## API Endpoints

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

## Troubleshooting

### Error: "ERR_CERT_COMMON_NAME_INVALID"
✅ **Automatically handled** - SSL certificate errors are now ignored by default.

If you still see this error, verify:
- `ignoreHTTPSErrors: true` is set in `playwrightConfig.js`
- Browser arguments include `--ignore-certificate-errors`

### Site Redirects Not Being Followed
✅ **Automatically handled** - All redirects are now followed automatically.

The API returns both `requestedUrl` and `finalUrl` so you can see the redirect chain:
```javascript
const result = await visitUrl('https://example.com');
console.log('Requested:', result.requestedUrl);  // https://example.com
console.log('Final:', result.finalUrl);           // https://example.com/en
```

### Error: "Cloudflare challenge failed"
- **Solution**: Run in non-headless mode and let the challenge complete manually first
- The persistent browser will remember the clearance

### Error: "Navigation timeout"
- **Solution**: Increase timeout or change waitUntil strategy
```javascript
visitUrl(url, { 
  timeout: 120000, 
  waitUntil: 'domcontentloaded' 
})
```

### Site still blocking after challenge passes
- Some sites require multiple visits to build trust
- Try visiting their homepage first, then the target page
- Consider using residential proxies

### Challenge keeps appearing
- Your IP may be flagged
- Try using a VPN or proxy
- Increase delays between requests

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

## Best Practices

1. **Always test in non-headless first** when encountering new Cloudflare implementations
2. **Reuse the persistent context** - don't clear profile-data/ unnecessarily
3. **Add delays** between requests to the same domain (5-10 seconds minimum)
4. **Rotate IPs** if scraping at scale
5. **Monitor for blocks** and implement exponential backoff
6. **Respect rate limits** - aggressive scraping leads to permanent bans

## Alternative Solutions

If the built-in solutions don't work:

1. **Use a Cloudflare bypass service** (external API)
2. **Browser with real human interaction** (manual intervention)
3. **Use their official API** if available
4. **Contact site owner** for scraping permission
