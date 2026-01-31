# File-Based HTML Storage API

## Problem Solved

**Issue:** Large HTML pages (500KB - 10MB+) can't be efficiently sent over API responses.

**Solution:** Save full HTML to disk, return metadata with download URLs.

## Key Features

✅ **Full HTML Preservation** - No script/style removal, keeps everything  
✅ **Waits for AJAX/APIs** - Uses `networkidle` to ensure all requests complete  
✅ **No Size Limits** - Works with any page size  
✅ **Fast API Response** - Returns metadata instantly  
✅ **Auto Cleanup** - Deletes old files automatically  
✅ **Backward Compatible** - Can still return HTML directly if needed  

---

## API Endpoints

### 1. Visit URL (Save to File)

```bash
GET /browser/visit?url=http://jetkidsgym.com/

# Optional parameters:
# - waitUntil: 'networkidle' (default) | 'load' | 'domcontentloaded'
# - timeout: 60000 (default, in ms)
# - returnHtml: false (default) | true (backward compatible)
# - saveToFile: true (default) | false
```

**Response:**
```json
{
  "fileId": "a1b2c3d4e5f6g7h8",
  "fileName": "a1b2c3d4e5f6g7h8_1738368234567.html",
  "url": "http://jetkidsgym.com/",
  "fileSizeKB": "1234.56 KB",
  "fileSizeMB": "1.21 MB",
  "timestamp": 1738368234567,
  "downloadUrl": "/browser/download/a1b2c3d4e5f6g7h8",
  "viewUrl": "/browser/view/a1b2c3d4e5f6g7h8",
  "message": "HTML saved successfully. Use downloadUrl to retrieve the file."
}
```

### 2. Download HTML File

```bash
GET /browser/download/:fileId

# Example:
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/download/a1b2c3d4e5f6g7h8" \
  -o page.html
```

**Response:** Raw HTML file (attachment download)

### 3. View HTML (as JSON)

```bash
GET /browser/view/:fileId
```

**Response:**
```json
{
  "fileId": "a1b2c3d4e5f6g7h8",
  "fileName": "a1b2c3d4e5f6g7h8_1738368234567.html",
  "html": "<!DOCTYPE html><html>...</html>",
  "fileSizeBytes": 1234567,
  "createdAt": "2026-01-31T12:34:56.789Z"
}
```

### 4. Storage Statistics

```bash
GET /cleanup/stats
```

**Response:**
```json
{
  "fileCount": 42,
  "totalSizeMB": "125.34",
  "averageSizeMB": "2.98"
}
```

### 5. Manual Cleanup

```bash
POST /cleanup?maxAge=24

# Parameters:
# - maxAge: Delete files older than N hours (default: 24)
```

**Response:**
```json
{
  "deleted": 15,
  "freedSpaceMB": "45.67",
  "remaining": 27,
  "message": "Deleted 15 files, freed 45.67 MB"
}
```

---

## Usage Examples

### PowerShell

```powershell
# 1. Visit URL and save HTML
$response = Invoke-RestMethod `
  -Uri "http://localhost:5000/browser/visit?url=http://jetkidsgym.com/" `
  -Headers @{"x-api-key"="YOUR_KEY"}

Write-Host "File saved: $($response.fileSizeKB)"
Write-Host "Download URL: $($response.downloadUrl)"

# 2. Download the HTML file
$fileId = $response.fileId
Invoke-WebRequest `
  -Uri "http://localhost:5000/browser$($response.downloadUrl)" `
  -Headers @{"x-api-key"="YOUR_KEY"} `
  -OutFile "downloaded_page.html"

# 3. Get HTML as JSON
$htmlData = Invoke-RestMethod `
  -Uri "http://localhost:5000/browser/view/$fileId" `
  -Headers @{"x-api-key"="YOUR_KEY"}

Write-Host "HTML Length: $($htmlData.html.Length) characters"
```

### Node.js

```javascript
const axios = require('axios');
const fs = require('fs');

const API_KEY = 'YOUR_KEY';
const BASE_URL = 'http://localhost:5000';

async function scrapeAndSave(url) {
  // 1. Visit URL
  const visitResponse = await axios.get(`${BASE_URL}/browser/visit`, {
    params: { url },
    headers: { 'x-api-key': API_KEY }
  });
  
  console.log('File saved:', visitResponse.data.fileSizeKB);
  
  // 2. Download HTML
  const downloadResponse = await axios.get(
    `${BASE_URL}${visitResponse.data.downloadUrl}`,
    { headers: { 'x-api-key': API_KEY } }
  );
  
  // 3. Save to local file
  fs.writeFileSync('page.html', downloadResponse.data);
  console.log('HTML saved to page.html');
  
  return visitResponse.data;
}

scrapeAndSave('http://jetkidsgym.com/');
```

### Python

```python
import requests

API_KEY = 'YOUR_KEY'
BASE_URL = 'http://localhost:5000'
headers = {'x-api-key': API_KEY}

# 1. Visit URL
response = requests.get(
    f'{BASE_URL}/browser/visit',
    params={'url': 'http://jetkidsgym.com/'},
    headers=headers
)
data = response.json()
print(f"File saved: {data['fileSizeKB']}")

# 2. Download HTML
file_id = data['fileId']
html_response = requests.get(
    f"{BASE_URL}/browser/download/{file_id}",
    headers=headers
)

# 3. Save to file
with open('page.html', 'w', encoding='utf-8') as f:
    f.write(html_response.text)
print('HTML saved to page.html')
```

---

## Configuration

### Automatic Cleanup

Configured in `index.js`:
```javascript
scheduleCleanup(6, 24);  // Run every 6 hours, delete files older than 24 hours
```

**Customize:**
- First parameter: Cleanup interval (hours)
- Second parameter: Max file age (hours)

### File Storage Location

Files saved to: `./scraped_html/`

**Format:** `{fileId}_{timestamp}.html`

**Example:** `a1b2c3d4e5f6g7h8_1738368234567.html`

---

## Wait Strategies

### networkidle (Recommended, Default)
Waits for no network requests for 500ms. Best for AJAX-heavy sites.

```bash
GET /browser/visit?url=...&waitUntil=networkidle
```

### load
Waits for the `load` event (all resources loaded including images).

```bash
GET /browser/visit?url=...&waitUntil=load
```

### domcontentloaded
Waits for DOM to be ready (fastest, but may miss AJAX content).

```bash
GET /browser/visit?url=...&waitUntil=domcontentloaded
```

---

## Backward Compatibility

To get HTML directly in API response (old behavior):

```bash
GET /browser/visit?url=...&returnHtml=true
```

**Response:**
```json
{
  "html": "<!DOCTYPE html><html>...</html>"
}
```

⚠️ **Warning:** Only use for small pages (<500KB), may timeout on large pages.

---

## Performance Comparison

| Approach | Small Page (50KB) | Medium Page (500KB) | Large Page (5MB) |
|----------|-------------------|---------------------|------------------|
| **Direct Return** | ✅ 2s | ⚠️ 5s | ❌ Timeout |
| **File Storage** | ✅ 2s | ✅ 3s | ✅ 6s |

**File Storage Benefits:**
- No size limits
- Faster API response (returns metadata only)
- Can retry downloads without re-scraping
- Better error handling

---

## Troubleshooting

### Issue: "HTML file not found"
**Cause:** File was cleaned up or invalid fileId  
**Solution:** Check file age, adjust cleanup schedule

### Issue: Page content incomplete
**Cause:** Not waiting long enough for AJAX  
**Solution:** Use `waitUntil=networkidle` or increase timeout

### Issue: Disk space running out
**Cause:** Too many old files  
**Solution:** Reduce cleanup maxAge or run manual cleanup

```bash
POST /cleanup?maxAge=12  # Delete files older than 12 hours
```

---

## Best Practices

1. **Use `networkidle`** for dynamic sites (React, Vue, Angular)
2. **Set appropriate timeout** based on site complexity
3. **Monitor storage** using `/cleanup/stats`
4. **Adjust cleanup schedule** based on usage patterns
5. **Download files promptly** - don't rely on long-term storage

---

## Example Workflow

```bash
# 1. Scrape page (waits for all APIs/AJAX)
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=https://example.com&waitUntil=networkidle"

# Response includes fileId: abc123def456

# 2. Check storage stats
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup/stats"

# 3. Download HTML when needed
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/download/abc123def456" \
  -o example.html

# 4. Parse/process the HTML
# (use your parser of choice)

# 5. Cleanup old files
curl -X POST -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup?maxAge=6"
```

---

## Summary

**Before:**
- ❌ Large HTML caused timeouts
- ❌ Aggressive script/style removal
- ❌ Lost dynamic content

**After:**
- ✅ No size limits
- ✅ Full HTML preserved
- ✅ Waits for all AJAX/APIs
- ✅ Fast API responses
- ✅ Auto cleanup
