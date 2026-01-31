# Browser API Improvements

## Current Test Results
✅ Successfully fetched HTML from http://jetkidsgym.com/
✅ Page loaded and rendered correctly
✅ API returned complete HTML structure

## Identified Limitations & Proposed Solutions

### 1. **Configurable Script/Style Removal**
**Current Issue:** All scripts and styles are stripped unconditionally

**Proposed Solution:**
```javascript
// Add query parameters for control
GET /browser/visit?url=...&stripScripts=true&stripStyles=true&stripLinks=false

// Implementation in browserHelper.js
async function visitUrl(url, options = {}) {
  const {
    stripScripts = true,
    stripStyles = true,
    stripLinks = true,
    keepInlineStyles = false
  } = options;
  
  const page = await getBrowserPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  await page.evaluate(({ stripScripts, stripStyles, stripLinks, keepInlineStyles }) => {
    const selectors = [];
    if (stripScripts) selectors.push('script');
    if (stripStyles) selectors.push('style');
    if (stripLinks) selectors.push('link[rel="stylesheet"]');
    
    if (selectors.length > 0) {
      document.querySelectorAll(selectors.join(', ')).forEach(el => {
        if (keepInlineStyles && el.tagName === 'STYLE') return;
        el.remove();
      });
    }
  }, { stripScripts, stripStyles, stripLinks, keepInlineStyles });
  
  return await page.content();
}
```

### 2. **Advanced Wait Strategies**
**Current Issue:** Only waits for `domcontentloaded`, missing dynamic content

**Proposed Solution:**
```javascript
// Add waitFor parameter
GET /browser/visit?url=...&waitFor=networkidle&timeout=60000&waitSelector=.main-content

async function visitUrl(url, options = {}) {
  const {
    waitFor = 'domcontentloaded', // 'load', 'domcontentloaded', 'networkidle'
    waitSelector = null,           // CSS selector to wait for
    timeout = 30000,
    scrollToBottom = false         // Trigger lazy-loading
  } = options;
  
  const page = await getBrowserPage();
  
  // Navigate with chosen strategy
  await gotoWithRetry(page, url, { 
    waitUntil: waitFor, 
    timeout 
  });
  
  // Wait for specific element if provided
  if (waitSelector) {
    await page.waitForSelector(waitSelector, { timeout });
  }
  
  // Scroll to trigger lazy-loading
  if (scrollToBottom) {
    await autoScroll(page);
  }
  
  // Additional wait for any final animations
  await page.waitForTimeout(1000);
  
  return await page.content();
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}
```

### 3. **Response Format Options**
**Current Issue:** Always returns full HTML, can be huge

**Proposed Solution:**
```javascript
// Add format parameter
GET /browser/visit?url=...&format=html&extract=.main-content&minify=true

// Return formats:
// - html: full HTML string
// - text: extracted text only
// - json: structured data extraction
// - markdown: converted to markdown
// - screenshot: base64 image

async function visitUrl(url, options = {}) {
  const {
    format = 'html',
    extractSelector = null,
    minify = false
  } = options;
  
  const page = await getBrowserPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  let content;
  
  switch (format) {
    case 'text':
      content = extractSelector 
        ? await page.$eval(extractSelector, el => el.innerText)
        : await page.evaluate(() => document.body.innerText);
      break;
      
    case 'json':
      content = await extractStructuredData(page, extractSelector);
      break;
      
    case 'screenshot':
      content = await page.screenshot({ 
        encoding: 'base64',
        fullPage: true 
      });
      break;
      
    case 'markdown':
      const html = await page.content();
      content = convertHtmlToMarkdown(html);
      break;
      
    case 'html':
    default:
      if (extractSelector) {
        content = await page.$eval(extractSelector, el => el.outerHTML);
      } else {
        content = await page.content();
      }
      if (minify) {
        content = content.replace(/>\s+</g, '><').trim();
      }
  }
  
  return content;
}
```

### 4. **Enhanced Error Handling & Retry**
**Current Issue:** Limited error handling in visitUrl

**Proposed Solution:**
```javascript
async function visitUrl(url, options = {}) {
  const {
    retries = 3,
    retryDelay = 2000,
    ignoreHTTPSErrors = false,
    timeout = 30000
  } = options;
  
  const page = await getBrowserPage();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await gotoWithRetry(page, url, {
        waitUntil: 'domcontentloaded',
        timeout,
        ignoreHTTPSErrors
      });
      
      // Success - process and return
      return await processPage(page, options);
      
    } catch (err) {
      console.error(`[visitUrl] Attempt ${attempt}/${retries} failed:`, err.message);
      
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        await page.waitForTimeout(delay);
      } else {
        throw new Error(`Failed after ${retries} attempts: ${err.message}`);
      }
    }
  }
}
```

### 5. **Caching Layer**
**Current Issue:** Every request hits the browser, slow for repeated requests

**Proposed Solution:**
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute default

GET /browser/visit?url=...&cache=true&cacheTTL=600

async function visitUrl(url, options = {}) {
  const { useCache = false, cacheTTL = 300 } = options;
  
  if (useCache) {
    const cacheKey = `html:${url}:${JSON.stringify(options)}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('[visitUrl] Cache hit');
      return cached;
    }
  }
  
  const page = await getBrowserPage();
  const content = await fetchAndProcessPage(page, url, options);
  
  if (useCache) {
    cache.set(cacheKey, content, cacheTTL);
  }
  
  return content;
}
```

### 6. **JavaScript Execution Context**
**Current Issue:** Can't interact with page before getting HTML

**Proposed Solution:**
```javascript
POST /browser/visit
{
  "url": "http://jetkidsgym.com/",
  "preActions": [
    { "type": "click", "selector": ".accept-cookies" },
    { "type": "fill", "selector": "#search", "value": "gymnastics" },
    { "type": "wait", "timeout": 2000 }
  ]
}

async function visitUrl(url, options = {}) {
  const { preActions = [] } = options;
  
  const page = await getBrowserPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  // Execute pre-actions before getting HTML
  for (const action of preActions) {
    switch (action.type) {
      case 'click':
        await page.click(action.selector);
        break;
      case 'fill':
        await page.fill(action.selector, action.value);
        break;
      case 'wait':
        await page.waitForTimeout(action.timeout);
        break;
      case 'waitForSelector':
        await page.waitForSelector(action.selector);
        break;
      case 'evaluate':
        await page.evaluate(action.script);
        break;
    }
  }
  
  return await page.content();
}
```

### 7. **Metadata Extraction**
**Current Issue:** Only returns HTML, no metadata about the page

**Proposed Solution:**
```javascript
GET /browser/visit?url=...&includeMeta=true

// Returns:
{
  "html": "...",
  "meta": {
    "title": "JETKids Gymnastics",
    "description": "...",
    "url": "https://www.jetkidsgym.com",
    "statusCode": 200,
    "loadTime": 2341,
    "imageCount": 45,
    "linkCount": 128,
    "wordCount": 1523,
    "openGraph": { ... },
    "structuredData": [ ... ]
  }
}
```

## Implementation Priority

1. **High Priority:**
   - Configurable script/style removal (#1)
   - Advanced wait strategies (#2)
   - Enhanced error handling (#4)

2. **Medium Priority:**
   - Response format options (#3)
   - JavaScript execution context (#6)

3. **Low Priority:**
   - Caching layer (#5)
   - Metadata extraction (#7)

## Next Steps

Would you like me to implement any of these improvements? I recommend starting with #1, #2, and #4 as they address the most critical limitations.
