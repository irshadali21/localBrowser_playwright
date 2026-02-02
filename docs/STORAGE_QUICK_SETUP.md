# Quick Setup Examples for Storage Adapters

## Local Storage (Default - No Configuration Needed)

```bash
# .env file - minimal configuration
API_KEY=your_api_key_here
WEBHOOK_SECRET=your_webhook_secret

# Start server
npm start

# Test
curl -H "x-api-key: your_api_key_here" \
  "http://localhost:5000/browser/visit?url=https://example.com"
```

Files saved to: `./scraped_html/`

---

## BeDrive Cloud Storage Setup

### Step 1: Get BeDrive Credentials
1. Sign up at https://bedrive.net/ or self-host
2. Go to Settings → API Keys
3. Generate new API key
4. Note your folder ID (or create one)

### Step 2: Configure Environment
```bash
# .env file
API_KEY=your_api_key_here
WEBHOOK_SECRET=your_webhook_secret

STORAGE_TYPE=bedrive
BEDRIVE_URL=https://your-instance.bedrive.net/api/v1
BEDRIVE_API_KEY=your_bedrive_api_key
BEDRIVE_FOLDER_ID=1
```

### Step 3: Test
```bash
npm start

curl -H "x-api-key: your_api_key_here" \
  "http://localhost:5000/browser/visit?url=https://example.com"
```

Response includes `shareableLink` for public access!

---

## WordPress Media Storage Setup

### Step 1: Generate WordPress Application Password
1. Log in to WordPress admin
2. Go to **Users → Profile**
3. Scroll to **Application Passwords** section
4. Enter name: "Browser Automation API"
5. Click **Add New Application Password**
6. Copy the password (format: `xxxx xxxx xxxx xxxx xxxx xxxx`)

**Note:** Application passwords require HTTPS or localhost.

### Step 2: Configure Environment
```bash
# .env file
API_KEY=your_api_key_here
WEBHOOK_SECRET=your_webhook_secret

STORAGE_TYPE=wordpress
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_USERNAME=your_username
WORDPRESS_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

### Step 3: Enable HTML File Uploads (if needed)

Add to your theme's `functions.php`:
```php
add_filter('upload_mimes', function($mimes) {
    $mimes['html'] = 'text/html';
    $mimes['htm'] = 'text/html';
    return $mimes;
});
```

Or install "WP Extra File Types" plugin.

### Step 4: Test
```bash
npm start

curl -H "x-api-key: your_api_key_here" \
  "http://localhost:5000/browser/visit?url=https://example.com"
```

Response includes `mediaUrl` for direct WordPress file access!

---

## Comparison Table

| Feature | Local | BeDrive | WordPress |
|---------|-------|---------|-----------|
| **Setup Time** | Instant | 5 minutes | 5 minutes |
| **Cost** | Free | Free/Paid | Hosting cost |
| **Storage Limit** | Disk space | Unlimited | Plan-dependent |
| **Public URLs** | No | Yes | Yes |
| **Auto Cleanup** | Yes | No | No |
| **Auth Method** | API key only | API key + token | App password |
| **Best For** | Testing, dev | Production | WP users |

---

## Testing Your Setup

### Check Storage Stats
```bash
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup/stats"
```

Expected response:
```json
{
  "fileCount": 0,
  "totalSizeMB": "0.00",
  "averageSizeMB": "0.00",
  "storageType": "local|cloud",
  "cloudProvider": "bedrive|wordpress"  // only for cloud
}
```

### Upload Test File
```bash
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=https://example.com" \
  | jq '.'
```

### Download Test File
```bash
# Get fileId from upload response, then:
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/download/YOUR_FILE_ID" \
  -o test.html
```

---

## Troubleshooting

### Local Storage
**Issue:** Permission errors
```bash
mkdir -p scraped_html
chmod 755 scraped_html
```

### BeDrive
**Issue:** 401 Unauthorized
- Check `BEDRIVE_API_KEY` is correct
- Ensure `BEDRIVE_URL` includes `/api/v1`
- Verify API key has upload permissions

**Issue:** 404 Folder Not Found
- Use folder ID (number) instead of name
- Or set `BEDRIVE_FOLDER_ID=` (empty) to use root

### WordPress
**Issue:** 401 Authentication Failed
- Verify using application password, not account password
- Check username is correct (case-sensitive)
- Ensure site uses HTTPS

**Issue:** 403 Upload Forbidden
- User needs Editor or Administrator role
- Enable HTML file uploads (see Step 3 above)
- Check hosting doesn't block HTML uploads

**Issue:** 413 Payload Too Large
```bash
# Increase PHP limits in php.ini:
upload_max_filesize = 64M
post_max_size = 64M
memory_limit = 256M
```

---

## Switching Storage Types

You can switch storage types anytime without losing existing files:

```bash
# Stop server
# Update STORAGE_TYPE in .env
# Start server

npm start
```

**Note:** Old files remain in previous storage location. New files use new storage type.

---

## Production Recommendations

### Local Storage
- Enable cleanup: `ENABLE_LOCAL_CLEANUP=true`
- Monitor disk space regularly
- Set appropriate `CLEANUP_MAX_AGE_HOURS`

### BeDrive Cloud
- Use dedicated folder for organization
- Monitor BeDrive storage quota (if applicable)
- Keep API key secure (never commit to git)

### WordPress
- Use dedicated WordPress user for API
- Regularly review Media Library for orphaned files
- Consider WordPress storage plugins for optimization
- Set up automated WordPress backups

---

## Need Help?

1. Check logs: `tail -f logs/*.log`
2. View database errors: `sqlite3 logs/database.db "SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT 10"`
3. Test storage adapter directly: `node test-storage-adapter.js`
4. Review documentation:
   - [FILE_STORAGE_API.md](./FILE_STORAGE_API.md)
   - [CLOUD_STORAGE_IMPLEMENTATION.md](./CLOUD_STORAGE_IMPLEMENTATION.md)
   - [WORDPRESS_STORAGE_SETUP.md](./WORDPRESS_STORAGE_SETUP.md)
   - [BEDRIVE_SETUP.md](./BEDRIVE_SETUP.md)
