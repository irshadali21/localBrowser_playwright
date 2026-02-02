# Storage Configuration Guide

Complete guide for configuring and using the storage system in the Browser Automation API.

---

## Table of Contents

1. [Overview](#overview)
2. [Storage Options](#storage-options)
3. [Quick Setup](#quick-setup)
4. [Local Storage](#local-storage)
5. [BeDrive Cloud Storage](#bedrive-cloud-storage)
6. [WordPress Media Storage](#wordpress-media-storage)
7. [API Usage](#api-usage)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)
10. [Comparison](#comparison)

---

## Overview

The API supports three storage backends for scraped HTML files:

```
┌─────────────────────────────────────────────────┐
│          Storage Adapter Architecture           │
│                                                  │
│  StorageAdapter (Base Interface)                │
│      ├── LocalStorageAdapter                    │
│      ├── BedriveStorageAdapter                  │
│      └── WordPressStorageAdapter                │
└─────────────────────────────────────────────────┘
```

**Key Features:**
- ✅ Multiple storage backends (local, BeDrive, WordPress)
- ✅ Easy switching via environment variable
- ✅ Consistent API across all storage types
- ✅ Automatic cleanup (local storage only)
- ✅ Public shareable URLs (cloud storage)

---

## Storage Options

### Local Storage (Default)
- **Where:** `./scraped_html/` directory
- **Cleanup:** Automatic (configurable)
- **Public URLs:** No
- **Best For:** Development, testing, small deployments

### BeDrive Cloud Storage
- **Where:** Self-hosted BeDrive instance
- **Cleanup:** Not needed (unlimited storage)
- **Public URLs:** Yes (shareable links)
- **Best For:** Production, large-scale scraping

### WordPress Media Storage
- **Where:** WordPress Media Library
- **Cleanup:** Manual via WordPress admin
- **Public URLs:** Yes (direct media URLs)
- **Best For:** WordPress users, CMS integration

---

## Quick Setup

### Local Storage (No Configuration)

```bash
# .env
API_KEY=your_api_key
STORAGE_TYPE=local  # or omit (default)

# Start server
npm start
```

Files saved to: `./scraped_html/`

### BeDrive Cloud Storage

```bash
# .env
STORAGE_TYPE=bedrive
BEDRIVE_URL=https://your-bedrive.com
BEDRIVE_API_KEY=your_api_key
BEDRIVE_FOLDER_ID=scraped_html
```

### WordPress Media Storage

```bash
# .env
STORAGE_TYPE=wordpress
WORDPRESS_URL=https://your-site.com
WORDPRESS_USERNAME=admin
WORDPRESS_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

---

## Local Storage

### Configuration

```env
# .env file
STORAGE_TYPE=local

# Automatic cleanup settings
ENABLE_LOCAL_CLEANUP=true       # Enable/disable cleanup
CLEANUP_INTERVAL_HOURS=6        # Run every 6 hours
CLEANUP_MAX_AGE_HOURS=24        # Delete files older than 24 hours
```

### Features

**Advantages:**
- ✅ No external dependencies
- ✅ Instant setup
- ✅ Automatic cleanup
- ✅ No authentication needed
- ✅ Fast access

**Limitations:**
- ❌ No public URLs
- ❌ Limited by disk space
- ❌ Files deleted on cleanup
- ❌ No built-in sharing

### Directory Structure

```
scraped_html/
├── abc123def456_1738368234567.html
├── xyz789ghi012_1738368345678.html
└── ...
```

### Manual Cleanup

```bash
# Delete files older than 24 hours
curl -X POST -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup?maxAge=24"
```

---

## BeDrive Cloud Storage

### Prerequisites

1. BeDrive instance deployed (https://bedrive.net)
2. Admin access to BeDrive dashboard
3. PHP 8.1+, MySQL/PostgreSQL

### Setup Steps

**Step 1: Generate API Key**
1. Log into BeDrive dashboard
2. Go to **Settings → API Keys**
3. Click **Generate New API Key**
4. Copy the API key (starts with `sk_`)

**Step 2: Get Folder ID (Optional)**
- Use `scraped_html` for auto-creation
- Or create folder and copy ID from URL: `/drive/folder/{ID}`

**Step 3: Configure Environment**

```env
STORAGE_TYPE=bedrive
BEDRIVE_URL=https://your-bedrive.com
BEDRIVE_API_KEY=sk_live_abc123xyz789
BEDRIVE_FOLDER_ID=scraped_html
```

**Step 4: Restart Server**

```bash
npm start
```

### Features

**Advantages:**
- ✅ Unlimited storage (depends on hosting)
- ✅ Automatic shareable links
- ✅ Public file access
- ✅ No cleanup needed
- ✅ Web interface for management

**Limitations:**
- ❌ Requires external service
- ❌ Setup time required
- ❌ May incur hosting costs

### API Response

```json
{
  "fileId": "abc123",
  "storageType": "cloud",
  "cloudProvider": "bedrive",
  "cloudFileId": "456",
  "shareableLink": "https://bedrive.com/drive/s/xyz",
  "shareableHash": "xyz",
  "downloadUrl": "/browser/download/abc123"
}
```

### Troubleshooting

**401 Unauthorized**
- Check API key is correct
- Verify BEDRIVE_URL includes proper domain
- Ensure API key has upload permissions

**404 Folder Not Found**
- Set BEDRIVE_FOLDER_ID to empty string for root
- Or create folder manually and use numeric ID

---

## WordPress Media Storage

### Prerequisites

1. WordPress 5.6+ with HTTPS enabled
2. User with Editor or Administrator role
3. HTML file uploads enabled

### Setup Steps

**Step 1: Generate Application Password**
1. Log into WordPress admin
2. Go to **Users → Profile**
3. Scroll to **Application Passwords**
4. Enter name: "Browser Automation API"
5. Click **Add New Application Password**
6. Copy password: `xxxx xxxx xxxx xxxx xxxx xxxx`

**Step 2: Enable HTML Uploads**

Add to `functions.php`:
```php
add_filter('upload_mimes', function($mimes) {
    $mimes['html'] = 'text/html';
    return $mimes;
});
```

Or install "WP Extra File Types" plugin.

**Step 3: Configure Environment**

```env
STORAGE_TYPE=wordpress
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_USERNAME=admin
WORDPRESS_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

**Step 4: Restart Server**

```bash
npm start
```

### Features

**Advantages:**
- ✅ Direct WordPress integration
- ✅ CMS file management
- ✅ Public media URLs
- ✅ Rich metadata support
- ✅ WordPress backup integration
- ✅ Application password security

**Limitations:**
- ❌ Requires WordPress site
- ❌ HTTPS required (or localhost)
- ❌ PHP upload size limits
- ❌ No automatic cleanup
- ❌ Storage depends on hosting plan

### API Response

```json
{
  "fileId": "abc123",
  "storageType": "cloud",
  "cloudProvider": "wordpress",
  "cloudFileId": 789,
  "mediaUrl": "https://site.com/wp-content/uploads/2026/02/file.html",
  "mediaLink": "https://site.com/?attachment_id=789",
  "downloadUrl": "/browser/download/abc123"
}
```

### WordPress REST API Endpoints

```
POST /wp/v2/media
  - Upload HTML files
  - Adds title, caption, description

GET /wp/v2/media?search={fileId}
  - Search for files by ID

GET /wp/v2/media?mime_type=text/html
  - Get storage statistics
```

### Troubleshooting

**401 Authentication Failed**
- Use application password, not account password
- Verify username is correct (case-sensitive)
- Ensure HTTPS is enabled

**403 Upload Forbidden**
- User needs Editor or Administrator role
- Enable HTML file uploads (see Step 2)
- Check hosting doesn't block HTML

**413 Payload Too Large**
```php
// In php.ini
upload_max_filesize = 64M
post_max_size = 64M
memory_limit = 256M
```

**Socket Hang Up / Connection Timeout**
```
Error: WordPress upload failed: Connection timeout
```
**Causes:**
- Large file size (>200KB) exceeds PHP execution time
- Network connection unstable
- WordPress server overloaded
- Firewall blocking uploads

**Solutions:**
```php
// In php.ini or .htaccess
max_execution_time = 300       # 5 minutes
max_input_time = 300           # 5 minutes
upload_max_filesize = 64M
post_max_size = 64M

// In .htaccess (if php.ini not accessible)
php_value max_execution_time 300
php_value max_input_time 300
php_value upload_max_filesize 64M
php_value post_max_size 64M
```

**Quick fixes:**
- Check WordPress site is accessible: `curl -I https://your-site.com`
- Test with smaller page first
- Check PHP error logs: `/var/log/php-errors.log`
- Increase timeout in WordPress adapter (already set to 5 minutes)
- Contact hosting provider if issue persists

---

## API Usage

### Upload HTML

```bash
# Visit URL and save HTML
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=https://example.com"
```

**Response:**
```json
{
  "fileId": "abc123def456",
  "fileName": "abc123def456_1738368234567.html",
  "url": "https://example.com",
  "fileSizeKB": "123.45 KB",
  "fileSizeMB": "0.12 MB",
  "timestamp": 1738368234567,
  "storageType": "local|cloud",
  "cloudProvider": "bedrive|wordpress",
  "downloadUrl": "/browser/download/abc123def456",
  "viewUrl": "/browser/view/abc123def456"
}
```

### Download HTML

```bash
# Via API
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/download/abc123def456" \
  -o page.html

# Direct from cloud (BeDrive)
curl "https://bedrive.com/drive/s/xyz" -o page.html

# Direct from cloud (WordPress)
curl "https://site.com/wp-content/uploads/.../file.html" -o page.html
```

### View HTML as JSON

```bash
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/view/abc123def456"
```

### Storage Statistics

```bash
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup/stats"
```

**Response:**
```json
{
  "fileCount": 42,
  "totalSizeMB": "125.34",
  "averageSizeMB": "2.98",
  "storageType": "local|cloud",
  "cloudProvider": "bedrive|wordpress"
}
```

### Manual Cleanup (Local Only)

```bash
# Delete files older than 24 hours
curl -X POST -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup?maxAge=24"
```

---

## Testing

### Test Storage Adapter

```bash
# Test all storage operations
cd tests
node test-storage-adapter.js
```

### Test WordPress Storage

```bash
# Set WordPress credentials in .env first
cd tests
node test-wordpress-storage.js
```

**Expected Output:**
```
=== WordPress Storage Adapter Test ===

✅ Environment variables found
✅ WordPress adapter initialized

--- Test 1: saveHtml() ---
✅ saveHtml() successful

--- Test 2: getHtml() ---
✅ getHtml() successful

--- Test 3: getStats() ---
✅ getStats() successful

=== All Tests Passed! ===
```

### Test API Endpoints

```bash
# Test upload
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=https://example.com"

# Test download
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/download/FILE_ID"

# Test stats
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup/stats"
```

---

## Troubleshooting

### General Issues

**Storage type not recognized**
```bash
# Check STORAGE_TYPE value
echo $STORAGE_TYPE

# Valid values: local, cloud, bedrive, wordpress
```

**Files not saving**
```bash
# Check logs
tail -f logs/*.log

# Check database errors
sqlite3 logs/database.db "SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT 5"
```

### Local Storage Issues

**Permission errors**
```bash
mkdir -p scraped_html
chmod 755 scraped_html
```

**Disk space issues**
```bash
# Check available space
df -h

# Clean old files
curl -X POST -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup?maxAge=1"
```

### BeDrive Issues

**Connection errors**
- Verify BEDRIVE_URL is accessible
- Check API key is valid
- Ensure firewall allows outbound HTTPS

**Upload failures**
- Check BeDrive storage quota
- Verify folder permissions
- Test with smaller file first

### WordPress Issues

**HTTPS requirement**
- Application passwords require HTTPS
- Use localhost for testing
- Consider SSL certificate for production

**File type errors**
- Enable HTML uploads (see setup)
- Check hosting security settings
- Try different file extension (.txt)

---

## Comparison

| Feature | Local | BeDrive | WordPress |
|---------|-------|---------|-----------|
| **Setup Time** | Instant | 5-10 min | 5-10 min |
| **Cost** | Free | Hosting | Hosting |
| **Storage Limit** | Disk space | Unlimited | Plan limit |
| **Public URLs** | No | Yes | Yes |
| **Auto Cleanup** | Yes | No | No |
| **File Management** | Filesystem | Web UI | WP Admin |
| **Authentication** | API key | API key | App password |
| **HTTPS Required** | No | Yes | Yes |
| **Best For** | Dev/Testing | Production | WP Users |

### When to Use Each

**Local Storage:**
- Development and testing
- Low-volume scraping
- Temporary data
- VPS with adequate disk space

**BeDrive Cloud:**
- Production environments
- High-volume scraping
- Long-term storage
- Need shareable links
- Limited VPS storage

**WordPress Media:**
- Already using WordPress
- Need CMS integration
- Team collaboration
- WordPress backup system
- Familiar with WP admin

---

## Advanced Configuration

### Environment Variables Reference

```env
# Storage Type
STORAGE_TYPE=local|bedrive|wordpress

# Local Storage
ENABLE_LOCAL_CLEANUP=true|false
CLEANUP_INTERVAL_HOURS=6
CLEANUP_MAX_AGE_HOURS=24

# BeDrive
BEDRIVE_URL=https://your-bedrive.com
BEDRIVE_API_KEY=sk_live_...
BEDRIVE_FOLDER_ID=scraped_html

# WordPress
WORDPRESS_URL=https://your-site.com
WORDPRESS_USERNAME=username
WORDPRESS_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

### Switching Storage Types

```bash
# Stop server
# Update STORAGE_TYPE in .env
# Start server

npm start
```

**Note:** Old files remain in previous storage. New files use new storage type.

### Production Recommendations

**Local Storage:**
- Enable cleanup
- Monitor disk space
- Set appropriate max age
- Regular backups

**BeDrive Cloud:**
- Use dedicated folder
- Monitor storage quota
- Keep API key secure
- Regular audits

**WordPress:**
- Dedicated API user
- Review media library regularly
- WordPress backups enabled
- Security plugins active

---

## Security Best Practices

### General
- ✅ Keep API keys secure
- ✅ Never commit credentials to git
- ✅ Use HTTPS in production
- ✅ Regular security audits
- ✅ Monitor access logs

### Local Storage
- ✅ Restrict directory permissions
- ✅ Regular cleanup enabled
- ✅ Monitor disk usage

### BeDrive
- ✅ Use strong API keys
- ✅ Restrict API key permissions
- ✅ Enable BeDrive 2FA
- ✅ Regular key rotation

### WordPress
- ✅ Use application passwords only
- ✅ Create dedicated API user
- ✅ Minimum role (Editor)
- ✅ Revoke unused passwords
- ✅ WordPress security plugins
- ✅ Regular WP updates

---

## Support

### Documentation
- [Setup Guide](./SETUP.md) - General setup instructions
- [API Documentation](../README.md) - Complete API reference

### Debugging
```bash
# Check logs
tail -f logs/*.log

# View errors
sqlite3 logs/database.db "SELECT * FROM error_logs"

# Test storage
cd tests && node test-storage-adapter.js
```

### Common Commands
```bash
# Restart with new storage
npm start

# Test configuration
curl -H "x-api-key: KEY" http://localhost:5000/cleanup/stats

# Manual cleanup (local only)
curl -X POST -H "x-api-key: KEY" http://localhost:5000/cleanup?maxAge=24
```
