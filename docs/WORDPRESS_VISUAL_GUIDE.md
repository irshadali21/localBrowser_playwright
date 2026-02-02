# WordPress Storage Integration - Visual Guide

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser Automation API                       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Express.js API Endpoints                      │  │
│  │  /browser/visit  /browser/download  /cleanup/stats        │  │
│  └──────────────────┬──────────────────────────────────────┘  │
│                      │                                          │
│  ┌──────────────────▼──────────────────────────────────────┐  │
│  │            Storage Factory (Factory Pattern)             │  │
│  │              Creates appropriate adapter                  │  │
│  │         based on STORAGE_TYPE env variable               │  │
│  └──────────────────┬──────────────────────────────────────┘  │
│                      │                                          │
│         ┌────────────┼────────────┬──────────────┐            │
│         │            │            │              │            │
│  ┌──────▼───┐ ┌─────▼─────┐ ┌───▼──────────┐   │            │
│  │  Local   │ │  BeDrive  │ │  WordPress   │   │            │
│  │ Storage  │ │  Storage  │ │   Storage    │   │            │
│  │ Adapter  │ │  Adapter  │ │   Adapter    │   │            │
│  └──────┬───┘ └─────┬─────┘ └───┬──────────┘   │            │
│         │           │            │              │            │
└─────────┼───────────┼────────────┼──────────────┼────────────┘
          │           │            │              │
          │           │            │              │
    ┌─────▼────┐ ┌────▼─────┐ ┌───▼────────────────────┐
    │  Local   │ │  BeDrive │ │   WordPress Site       │
    │   Disk   │ │   Cloud  │ │   (Media Library)      │
    │          │ │  Storage │ │                        │
    │ scraped_ │ │          │ │  /wp-content/uploads/  │
    │  html/   │ │  Files   │ │                        │
    └──────────┘ └──────────┘ └────────────────────────┘
```

## Data Flow - Upload Process

```
1. User Request
   ↓
   curl -H "x-api-key: KEY" "http://localhost:5000/browser/visit?url=example.com"
   ↓
2. API Endpoint (/browser/visit)
   ↓
3. Playwright Browser
   ↓
   [Scrapes HTML content]
   ↓
4. browserHelper.js
   ↓
   storage.saveHtml(fileId, html, url)
   ↓
5. StorageFactory
   ↓
   [Determines storage type from STORAGE_TYPE env]
   ↓
6a. WordPress Adapter                  6b. BeDrive Adapter           6c. Local Adapter
    ↓                                      ↓                             ↓
    POST /wp/v2/media                     POST /uploads                 fs.writeFile()
    ↓                                      ↓                             ↓
    WordPress Media Library               BeDrive Cloud                 ./scraped_html/
    ↓                                      ↓                             ↓
    Returns media object with:            Returns file object           Returns file metadata
    - id: 123                             - id: "abc123"                - filePath
    - source_url                          - shareableLink               - downloadUrl
    - link                                - downloadUrl                 - viewUrl
    ↓                                      ↓                             ↓
7. API Response
   ↓
   {
     "fileId": "...",
     "storageType": "cloud",
     "cloudProvider": "wordpress",
     "mediaUrl": "https://site.com/wp-content/uploads/.../file.html",
     "downloadUrl": "/browser/download/...",
     ...
   }
```

## WordPress Authentication Flow

```
┌──────────────────────────────────────────────────────────────┐
│                   WordPress Admin Panel                       │
│                                                                │
│  1. Go to Users → Profile                                     │
│  2. Scroll to "Application Passwords"                         │
│  3. Enter app name: "Browser Automation API"                  │
│  4. Click "Add New Application Password"                      │
│  5. Copy generated password                                   │
│     Format: xxxx xxxx xxxx xxxx xxxx xxxx                    │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                        .env File                              │
│                                                                │
│  STORAGE_TYPE=wordpress                                       │
│  WORDPRESS_URL=https://your-site.com                          │
│  WORDPRESS_USERNAME=admin                                     │
│  WORDPRESS_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx            │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│               WordPressStorageAdapter.js                      │
│                                                                │
│  axios.create({                                               │
│    baseURL: 'https://your-site.com/wp-json/wp/v2',          │
│    auth: {                                                    │
│      username: 'admin',                                       │
│      password: 'xxxx xxxx xxxx xxxx xxxx xxxx'              │
│    }                                                          │
│  })                                                           │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                  WordPress REST API                           │
│                                                                │
│  Validates credentials via application password               │
│  Returns authentication token                                 │
│  Allows access to /wp/v2/media endpoints                     │
└──────────────────────────────────────────────────────────────┘
```

## File Structure

```
localBrowser_playwright/
│
├── utils/storage/
│   ├── StorageAdapter.js           ← Base interface
│   ├── LocalStorageAdapter.js      ← Local filesystem
│   ├── BedriveStorageAdapter.js    ← BeDrive cloud
│   ├── WordPressStorageAdapter.js  ← WordPress (NEW!)
│   └── StorageFactory.js           ← Factory (updated)
│
├── docs/
│   ├── WORDPRESS_STORAGE_SETUP.md          ← Setup guide (NEW!)
│   ├── WORDPRESS_IMPLEMENTATION_SUMMARY.md  ← Summary (NEW!)
│   ├── STORAGE_QUICK_SETUP.md              ← Quick reference (NEW!)
│   ├── CLOUD_STORAGE_IMPLEMENTATION.md     ← Updated
│   └── FILE_STORAGE_API.md
│
├── test-wordpress-storage.js       ← Test script (NEW!)
├── .env.example                    ← Updated
├── README.md                       ← Updated
└── index.js
```

## Configuration Comparison

```
┌──────────────────┬─────────────────┬─────────────────┬──────────────────┐
│                  │  Local Storage  │ BeDrive Storage │ WordPress Storage│
├──────────────────┼─────────────────┼─────────────────┼──────────────────┤
│ STORAGE_TYPE     │  local          │  cloud/bedrive  │  wordpress       │
├──────────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Credentials      │  None           │  API Key        │  App Password    │
├──────────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Setup Time       │  Instant        │  5-10 min       │  5-10 min        │
├──────────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Auto Cleanup     │  Yes            │  No             │  No              │
├──────────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Public URLs      │  No             │  Yes            │  Yes             │
├──────────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Storage Limit    │  Disk space     │  Unlimited      │  Plan-dependent  │
├──────────────────┼─────────────────┼─────────────────┼──────────────────┤
│ File Management  │  Filesystem     │  BeDrive UI     │  WordPress Admin │
├──────────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Best For         │  Testing/Dev    │  Production     │  WP Users        │
└──────────────────┴─────────────────┴─────────────────┴──────────────────┘
```

## WordPress API Endpoints Used

```
┌────────────────────────────────────────────────────────────────────┐
│  POST /wp/v2/media                                                 │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Upload HTML file to WordPress Media Library                  │ │
│  │                                                               │ │
│  │ Request:                                                      │ │
│  │   Content-Type: multipart/form-data                          │ │
│  │   Authorization: Basic {base64(username:password)}           │ │
│  │   Body:                                                       │ │
│  │     - file: HTML file buffer                                 │ │
│  │     - title: "Scraped HTML - {fileId}"                      │ │
│  │     - caption: "Scraped from: {url}"                        │ │
│  │     - description: "Timestamp: {ISO}"                       │ │
│  │                                                               │ │
│  │ Response:                                                     │ │
│  │   {                                                           │ │
│  │     "id": 123,                                               │ │
│  │     "source_url": "https://.../uploads/.../file.html",      │ │
│  │     "link": "https://.../?attachment_id=123",               │ │
│  │     "media_details": { "filesize": 12345 }                  │ │
│  │   }                                                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  GET /wp/v2/media?search={fileId}&per_page=100                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Search for uploaded files by fileId                          │ │
│  │                                                               │ │
│  │ Request:                                                      │ │
│  │   Authorization: Basic {base64(username:password)}           │ │
│  │   Query Params:                                              │ │
│  │     - search: fileId to search for                           │ │
│  │     - per_page: 100 (max results)                           │ │
│  │     - orderby: date                                          │ │
│  │     - order: desc                                            │ │
│  │                                                               │ │
│  │ Response: Array of media objects                             │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  GET /wp/v2/media?mime_type=text/html                             │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Get statistics for all HTML files                            │ │
│  │                                                               │ │
│  │ Used by: getStats() method                                   │ │
│  │ Returns: Array of HTML files with sizes                      │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

## Testing Workflow

```
1. Setup Environment
   ┌──────────────────────────────────────┐
   │ Create .env file                     │
   │ Add WordPress credentials            │
   │ Generate application password        │
   │ Enable HTML file uploads             │
   └──────────────┬───────────────────────┘
                  │
                  ▼
2. Run Test Script
   ┌──────────────────────────────────────┐
   │ node test-wordpress-storage.js       │
   │                                      │
   │ Tests:                               │
   │  ✓ Environment variables             │
   │  ✓ Connection to WordPress           │
   │  ✓ Upload HTML file                  │
   │  ✓ Download HTML file                │
   │  ✓ Get storage stats                 │
   │  ✓ Verify error handling             │
   └──────────────┬───────────────────────┘
                  │
                  ▼
3. Test API Endpoints
   ┌──────────────────────────────────────┐
   │ curl -H "x-api-key: KEY"             │
   │   /browser/visit?url=example.com     │
   │                                      │
   │ curl -H "x-api-key: KEY"             │
   │   /browser/download/fileId           │
   │                                      │
   │ curl -H "x-api-key: KEY"             │
   │   /cleanup/stats                     │
   └──────────────┬───────────────────────┘
                  │
                  ▼
4. Verify in WordPress
   ┌──────────────────────────────────────┐
   │ Go to Media → Library                │
   │ Check uploaded HTML files            │
   │ Verify metadata (title, caption)     │
   │ Test direct download URLs            │
   └──────────────────────────────────────┘
```

## Quick Start Commands

```bash
# 1. Generate WordPress Application Password
# (Do this in WordPress admin UI - Users → Profile)

# 2. Configure environment
cat >> .env << EOF
STORAGE_TYPE=wordpress
WORDPRESS_URL=https://your-site.com
WORDPRESS_USERNAME=admin
WORDPRESS_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
EOF

# 3. Enable HTML uploads (add to functions.php)
# Or install "WP Extra File Types" plugin

# 4. Run test
node test-wordpress-storage.js

# 5. Start server
npm start

# 6. Test upload
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=https://example.com"

# 7. View stats
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup/stats"
```

## Troubleshooting Decision Tree

```
Upload Fails?
│
├─ 401 Error?
│  └─ Check username/password
│     Check application password (not account password)
│     Verify HTTPS enabled
│
├─ 403 Error?
│  └─ Check user role (need Editor+)
│     Enable HTML file uploads
│     Check hosting restrictions
│
├─ 413 Error?
│  └─ Increase PHP upload_max_filesize
│     Increase PHP post_max_size
│     Contact hosting provider
│
└─ Connection Error?
   └─ Verify WORDPRESS_URL is correct
      Check site is accessible
      Test with curl directly
```

## Security Best Practices

```
✅ DO:
  ✓ Use HTTPS for WordPress site
  ✓ Generate application passwords (not account password)
  ✓ Create dedicated user for API (Editor role)
  ✓ Regularly audit uploaded files
  ✓ Revoke unused application passwords
  ✓ Keep WordPress and plugins updated
  ✓ Use strong passwords
  ✓ Enable WordPress security plugins

❌ DON'T:
  ✗ Use account password in .env
  ✗ Commit .env to git repository
  ✗ Use HTTP (non-encrypted)
  ✗ Grant Administrator role unnecessarily
  ✗ Share application passwords
  ✗ Disable WordPress security features
  ✗ Ignore WordPress security updates
```

## Additional Resources

📚 Documentation:
- [WORDPRESS_STORAGE_SETUP.md](./WORDPRESS_STORAGE_SETUP.md) - Full setup guide
- [STORAGE_QUICK_SETUP.md](./STORAGE_QUICK_SETUP.md) - Quick reference
- [CLOUD_STORAGE_IMPLEMENTATION.md](./CLOUD_STORAGE_IMPLEMENTATION.md) - Architecture

🔧 Tools:
- test-wordpress-storage.js - Automated testing
- .env.example - Configuration template

🌐 External Links:
- WordPress REST API Handbook: https://developer.wordpress.org/rest-api/
- Application Passwords: https://make.wordpress.org/core/2020/11/05/application-passwords/
- WordPress Media Endpoints: https://developer.wordpress.org/rest-api/reference/media/
