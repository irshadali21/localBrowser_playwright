# WordPress Media API Storage - Implementation Summary

## What Was Added

A new cloud storage adapter that integrates WordPress Media Library as a storage backend for scraped HTML files.

## Files Created

### 1. WordPressStorageAdapter.js
**Location:** `utils/storage/WordPressStorageAdapter.js`

**Purpose:** Implements the StorageAdapter interface for WordPress Media API

**Key Features:**
- Uploads HTML files via WordPress REST API (`/wp/v2/media`)
- Uses Basic Authentication with application passwords
- Adds metadata (title, caption, description) to uploads
- Retrieves files by searching WordPress media library
- Provides storage statistics (file count, total size)
- Returns direct URLs to uploaded files

**Methods Implemented:**
- `saveHtml(fileId, html, url)` - Upload HTML to WordPress Media Library
- `getHtml(fileId)` - Download HTML from WordPress
- `getStats()` - Get storage statistics
- `cleanup(maxAgeHours)` - Not supported (throws error)
- `getType()` - Returns 'cloud'

### 2. Documentation Files

#### WORDPRESS_STORAGE_SETUP.md
**Location:** `docs/WORDPRESS_STORAGE_SETUP.md`

Complete setup guide covering:
- WordPress requirements and prerequisites
- Application password generation steps
- Environment variable configuration
- API endpoint details
- Usage examples with curl commands
- Troubleshooting common issues
- Security best practices
- Comparison with other storage options

#### STORAGE_QUICK_SETUP.md
**Location:** `docs/STORAGE_QUICK_SETUP.md`

Quick reference guide for all storage types:
- Step-by-step setup for local, BeDrive, and WordPress storage
- Configuration examples
- Comparison table
- Testing procedures
- Troubleshooting tips
- Production recommendations

### 3. Test Script

#### test-wordpress-storage.js
**Location:** `test-wordpress-storage.js`

Automated test script that verifies:
- Environment variables are set correctly
- Connection to WordPress REST API works
- File upload functionality
- File retrieval functionality
- Statistics retrieval
- Error handling (cleanup should fail)
- Type detection

**Usage:**
```bash
node test-wordpress-storage.js
```

## Files Modified

### 1. StorageFactory.js
**Location:** `utils/storage/StorageFactory.js`

**Changes:**
- Added `require` for WordPressStorageAdapter
- Added `wordpress` case to storage type switch
- Added WordPress configuration to `getStorageConfig()` method

### 2. README.md
**Location:** `README.md`

**Changes:**
- Updated storage options section to include WordPress
- Added WordPress configuration example
- Updated notes about application passwords
- Added "three storage backends" instead of "two"

### 3. CLOUD_STORAGE_IMPLEMENTATION.md
**Location:** `docs/CLOUD_STORAGE_IMPLEMENTATION.md`

**Changes:**
- Updated storage adapter pattern diagram to include WordPress
- Added WordPressStorageAdapter section to architecture
- Updated environment configuration with WordPress variables
- Added reference link to WORDPRESS_STORAGE_SETUP.md

### 4. .env.example
**Location:** `.env.example`

**Changes:**
- Updated STORAGE_TYPE comments to include 'wordpress'
- Added WordPress Media Storage section with configuration variables
- Added notes about application passwords and HTTPS requirement

## How It Works

### Authentication Flow

1. User generates application password in WordPress admin (Users → Profile)
2. Application password is added to `.env` file
3. WordPressStorageAdapter creates axios instance with Basic Auth
4. All API requests include `Authorization: Basic {credentials}` header

### Upload Flow

1. User makes request to `/browser/visit?url=...`
2. Browser scrapes HTML content
3. Storage adapter (via Factory) saves HTML
4. WordPress adapter:
   - Creates multipart/form-data request
   - Uploads file to `/wp/v2/media` endpoint
   - Adds metadata (title, caption, description)
   - Returns WordPress media object with URLs
5. API returns response with `mediaUrl` for direct access

### Download Flow

1. User makes request to `/browser/download/:fileId`
2. Storage adapter searches WordPress media library
3. WordPress adapter:
   - Calls `/wp/v2/media?search={fileId}` endpoint
   - Finds matching file by filename
   - Downloads content from `source_url`
   - Returns HTML content
4. API streams HTML to user

## Configuration Options

### Required Environment Variables

```env
STORAGE_TYPE=wordpress
WORDPRESS_URL=https://your-site.com
WORDPRESS_USERNAME=admin
WORDPRESS_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

### WordPress Requirements

- WordPress 5.6 or higher
- HTTPS enabled (or localhost for testing)
- User with Editor or Administrator role
- HTML file uploads enabled (may need plugin or theme code)

### Enable HTML Uploads

Add to `functions.php`:
```php
add_filter('upload_mimes', function($mimes) {
    $mimes['html'] = 'text/html';
    return $mimes;
});
```

## API Response Example

```json
{
  "fileId": "abc123def456",
  "fileName": "abc123def456_1738368234567.html",
  "url": "https://example.com",
  "fileSizeKB": "45.67 KB",
  "fileSizeMB": "0.04 MB",
  "timestamp": 1738368234567,
  "storageType": "cloud",
  "cloudProvider": "wordpress",
  "cloudFileId": 123,
  "mediaUrl": "https://your-site.com/wp-content/uploads/2026/02/abc123def456_1738368234567.html",
  "mediaLink": "https://your-site.com/?attachment_id=123",
  "downloadUrl": "/browser/download/abc123def456",
  "viewUrl": "/browser/view/abc123def456",
  "message": "HTML saved to WordPress Media Library. Media ID: 123, URL: ..."
}
```

## Usage Examples

### Basic Upload
```bash
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=https://example.com"
```

### Download via API
```bash
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/download/abc123def456" \
  -o page.html
```

### Download Directly from WordPress
```bash
# No authentication needed - public URL!
curl "https://your-site.com/wp-content/uploads/2026/02/abc123def456_1738368234567.html" \
  -o page.html
```

### Storage Statistics
```bash
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup/stats"
```

## Benefits of WordPress Storage

✅ **Easy Integration** - Use existing WordPress infrastructure  
✅ **CMS Access** - Manage files through familiar WordPress admin  
✅ **Public URLs** - Direct file access without API authentication  
✅ **Metadata Support** - Rich metadata (title, caption, description)  
✅ **Search Capability** - WordPress built-in search functionality  
✅ **User Management** - WordPress role-based access control  
✅ **Backup Integration** - Included in WordPress backup solutions  
✅ **Plugin Ecosystem** - Extend with WordPress media plugins  

## Limitations

⚠️ **No Automatic Cleanup** - Files must be managed manually in WordPress  
⚠️ **File Type Restrictions** - May need to enable HTML uploads  
⚠️ **Upload Size Limits** - Controlled by PHP/WordPress settings  
⚠️ **HTTPS Required** - Application passwords need HTTPS (or localhost)  
⚠️ **Search Limit** - Statistics limited to 100 most recent files  
⚠️ **Storage Quota** - Depends on hosting plan limitations  

## Security Considerations

🔒 **Application Passwords** - More secure than account passwords  
🔒 **Revocable Access** - Can revoke without changing account password  
🔒 **Role-Based Access** - Uses WordPress user roles and capabilities  
🔒 **HTTPS Encryption** - All traffic encrypted in transit  
🔒 **Audit Trail** - WordPress logs media uploads  

## Testing

Run the test script:
```bash
# Set environment variables in .env first
node test-wordpress-storage.js
```

Expected output:
```
=== WordPress Storage Adapter Test ===

✅ Environment variables found
✅ WordPress adapter initialized

--- Test 1: saveHtml() ---
✅ saveHtml() successful

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

## Troubleshooting

### Common Issues

1. **401 Authentication Failed**
   - Verify username/password are correct
   - Ensure using application password, not account password
   - Check WordPress site has HTTPS enabled

2. **403 Upload Forbidden**
   - User needs Editor or Administrator role
   - Enable HTML file uploads (see setup guide)
   - Check hosting doesn't block HTML uploads

3. **413 Payload Too Large**
   - Increase PHP `upload_max_filesize` setting
   - Increase PHP `post_max_size` setting
   - Contact hosting provider

## Future Enhancements

Potential improvements:
- WordPress plugin for better integration
- Custom post type for scraped HTML
- Custom metadata fields (scrape date, URL, etc.)
- Automated cleanup based on WordPress cron
- HTML preview thumbnails
- Search and filter UI in WordPress admin
- Webhook notifications on upload
- Integration with WordPress CDN plugins

## Related Documentation

- [WORDPRESS_STORAGE_SETUP.md](./WORDPRESS_STORAGE_SETUP.md) - Detailed setup guide
- [STORAGE_QUICK_SETUP.md](./STORAGE_QUICK_SETUP.md) - Quick reference for all storage types
- [CLOUD_STORAGE_IMPLEMENTATION.md](./CLOUD_STORAGE_IMPLEMENTATION.md) - Overall architecture
- [FILE_STORAGE_API.md](./FILE_STORAGE_API.md) - API endpoint documentation

## Support

For issues or questions:
1. Check troubleshooting section in WORDPRESS_STORAGE_SETUP.md
2. Run test script: `node test-wordpress-storage.js`
3. Check WordPress REST API logs
4. Review error_logs table in SQLite database
5. Enable WordPress debugging (WP_DEBUG in wp-config.php)
