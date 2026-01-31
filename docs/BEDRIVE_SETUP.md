# BeDrive Cloud Storage Setup Guide

## What is BeDrive?

BeDrive is a self-hosted file sharing and storage platform (similar to Google Drive or Dropbox) that you can deploy on your own hosting. It provides unlimited storage capacity depending on your hosting plan.

## Prerequisites

1. A BeDrive instance deployed on your hosting
2. Admin access to your BeDrive dashboard
3. Ability to generate API keys

## Setup Steps

### 1. Deploy BeDrive

If you don't have BeDrive deployed yet:
- Visit [BeDrive Documentation](https://bedrive.net) for installation instructions
- Deploy on your hosting (requires PHP 8.1+, MySQL/PostgreSQL)
- Complete the installation wizard

### 2. Generate API Key

1. Log into your BeDrive dashboard
2. Go to **Settings** → **API Keys** (or similar section)
3. Click **Generate New API Key**
4. Copy the generated API key
5. Save it securely (you won't be able to see it again)

### 3. Get Folder ID

Option A: Use the root folder
- Simply set `BEDRIVE_FOLDER_ID=scraped_html`
- The adapter will create this folder automatically

Option B: Use an existing folder
1. Create a folder in BeDrive named "scraped_html"
2. Open the folder
3. Copy the folder ID from the URL: `https://your-bedrive.com/drive/folder/{FOLDER_ID}`

### 4. Configure Environment Variables

Update your `.env` file:

```env
# Switch to cloud storage
STORAGE_TYPE=cloud

# Disable local cleanup (not needed for cloud)
ENABLE_LOCAL_CLEANUP=false

# BeDrive Configuration
BEDRIVE_URL=https://your-bedrive-instance.com
BEDRIVE_API_KEY=sk_live_abc123xyz789...
BEDRIVE_FOLDER_ID=scraped_html
```

**Important Notes:**
- Remove trailing slash from `BEDRIVE_URL`
- API key should start with `sk_` prefix (standard BeDrive format)
- Keep API key secure - never commit to git

### 5. Restart the Server

```bash
npm start
```

You should see:
```
Playwright server running on port 5000
[Storage] Using cloud storage - automatic cleanup is disabled (cloud mode)
```

### 6. Verify Setup

Run the test script:
```bash
node test-storage-adapter.js
```

Expected output:
```
Created storage adapter: cloud
[BedriveStorage] Initializing BeDrive storage...
[BedriveStorage] Ensuring folder exists: scraped_html
--- Testing saveHtml() ---
[BedriveStorage] Uploading HTML file to BeDrive...
Save result:
{
  "fileId": "...",
  "cloudFileId": "123",
  "storageType": "cloud",
  ...
}
✅ All tests passed!
```

## API Endpoints Behavior

All API endpoints work identically with cloud storage:

### Visit URL and Save HTML
```bash
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=http://example.com"
```

Response includes cloud storage details:
```json
{
  "fileId": "abc123...",
  "cloudFileId": "456",
  "url": "http://example.com",
  "storageType": "cloud",
  "downloadUrl": "/browser/download/abc123...",
  "viewUrl": "/browser/view/abc123...",
  "message": "HTML saved successfully to BeDrive cloud storage."
}
```

### Download HTML
```bash
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/download/abc123..." \
  -o output.html
```

The API fetches the file from BeDrive and streams it to you.

### Get Storage Stats
```bash
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup/stats"
```

Response:
```json
{
  "fileCount": 42,
  "storageType": "cloud",
  "message": "Cloud storage statistics"
}
```

## Troubleshooting

### Error: "Failed to upload to BeDrive"

**Cause:** Invalid API key or URL

**Solution:**
1. Verify `BEDRIVE_URL` is correct (no trailing slash)
2. Check API key is valid
3. Test connection:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://your-bedrive.com/api/v1/user
   ```

### Error: "Folder not found"

**Cause:** `BEDRIVE_FOLDER_ID` doesn't exist

**Solution:**
1. Use `scraped_html` (adapter creates it automatically)
2. Or create the folder manually in BeDrive dashboard

### Error: "Unauthorized"

**Cause:** API key doesn't have upload permissions

**Solution:**
1. Regenerate API key in BeDrive
2. Ensure API key has file upload permissions

### Files Not Appearing in BeDrive

**Check:**
1. Look in the `scraped_html` folder
2. Verify folder permissions in BeDrive
3. Check BeDrive storage quota hasn't been exceeded

## Performance Considerations

### Upload Speed
- Cloud upload speed depends on your hosting bandwidth
- Typical: 1-5 seconds for 1MB HTML file
- Large files (>5MB) may take 10-30 seconds

### Download Speed
- Download speed depends on BeDrive server location
- Consider using CDN if BeDrive supports it

### Recommendations
- Use cloud storage for production (unlimited capacity)
- Use local storage for development (faster)
- Monitor BeDrive storage usage via dashboard

## Security Best Practices

1. **API Key Security**
   - Never commit `.env` to git
   - Rotate API keys periodically
   - Use different keys for dev/staging/production

2. **Access Control**
   - Set folder permissions in BeDrive
   - Consider making `scraped_html` folder private
   - Use BeDrive's sharing features carefully

3. **HTTPS**
   - Always use HTTPS for `BEDRIVE_URL`
   - Verify SSL certificate is valid

## Migration

### From Local to Cloud

1. Update `.env` to use cloud storage
2. Restart server
3. Old local files remain in `./scraped_html/`
4. (Optional) Manually upload old files to BeDrive if needed

### From Cloud to Local

1. Update `.env` to use local storage
2. Restart server
3. Cloud files remain on BeDrive
4. (Optional) Download important files from BeDrive dashboard

## Cost Comparison

| Storage Type | Cost | Capacity | Cleanup Needed |
|-------------|------|----------|----------------|
| Local VPS | VPS storage ($5-50/mo) | 20GB-100GB typical | Yes (automatic) |
| BeDrive Cloud | Hosting ($10-30/mo) | Unlimited* | No |

*Depends on hosting plan

## Support

For BeDrive-specific issues:
- [BeDrive Documentation](https://bedrive.net/docs)
- [BeDrive Support](https://bedrive.net/support)

For integration issues:
- Check `logs/database.db` for error logs
- Review `CLOUD_STORAGE_IMPLEMENTATION.md`
- Run `node test-storage-adapter.js` for diagnostics
