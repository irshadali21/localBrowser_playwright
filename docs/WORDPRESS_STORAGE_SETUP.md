# WordPress Media API Storage Implementation

## Overview
WordPress storage adapter integrates with WordPress REST API's Media Library to store scraped HTML files. This allows you to use any WordPress site as cloud storage for your browser automation HTML captures.

## Features
✅ **WordPress REST API Integration** - Uses native WordPress Media Library API  
✅ **Basic Authentication** - Secure connection using WordPress application passwords  
✅ **Automatic Metadata** - Adds title, caption, and description to uploads  
✅ **Search by FileID** - Quick retrieval using WordPress search API  
✅ **Storage Statistics** - View file count and sizes from media library  
✅ **Direct URL Access** - Get public URLs to uploaded HTML files  

## Setup Instructions

### 1. WordPress Requirements
- WordPress 5.6 or higher (REST API support)
- HTTPS enabled (recommended for security)
- User account with `upload_files` capability (Editor or Administrator role)

### 2. Generate Application Password
Since WordPress 5.6, you can create application-specific passwords:

1. Log in to WordPress admin
2. Go to **Users → Profile**
3. Scroll to **Application Passwords** section
4. Enter application name (e.g., "Browser Automation API")
5. Click **Add New Application Password**
6. Copy the generated password (format: `xxxx xxxx xxxx xxxx xxxx xxxx`)

**Important:** Application passwords only work with HTTPS sites or localhost.

### 3. Environment Configuration

Add these variables to your `.env` file:

```env
# Storage Configuration
STORAGE_TYPE=wordpress

# WordPress Media API Configuration
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_USERNAME=your_username
WORDPRESS_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx  # Application password from step 2
```

### 4. Verify Connection

Test the connection:
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
  "storageType": "cloud",
  "cloudProvider": "wordpress",
  "note": "Stats limited to first 100 HTML files"
}
```

## Usage Examples

### Upload HTML to WordPress
```bash
# Visit a URL and save to WordPress Media Library
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=https://example.com"
```

**Response:**
```json
{
  "fileId": "a1b2c3d4e5f6g7h8",
  "fileName": "a1b2c3d4e5f6g7h8_1738368234567.html",
  "url": "https://example.com",
  "fileSizeKB": "45.67 KB",
  "fileSizeMB": "0.04 MB",
  "timestamp": 1738368234567,
  "storageType": "cloud",
  "cloudProvider": "wordpress",
  "cloudFileId": 123,
  "mediaUrl": "https://your-site.com/wp-content/uploads/2026/02/a1b2c3d4e5f6g7h8_1738368234567.html",
  "mediaLink": "https://your-site.com/?attachment_id=123",
  "downloadUrl": "/browser/download/a1b2c3d4e5f6g7h8",
  "viewUrl": "/browser/view/a1b2c3d4e5f6g7h8",
  "message": "HTML saved to WordPress Media Library. Media ID: 123, URL: ..."
}
```

### Download HTML from WordPress
```bash
# Using your API
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/download/a1b2c3d4e5f6g7h8" \
  -o page.html

# Or directly from WordPress (no auth needed if public)
curl "https://your-site.com/wp-content/uploads/2026/02/a1b2c3d4e5f6g7h8_1738368234567.html" \
  -o page.html
```

### View Storage Stats
```bash
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup/stats"
```

## WordPress REST API Details

### Endpoints Used

#### Upload File
```
POST /wp/v2/media
Content-Type: multipart/form-data

- file: HTML file buffer
- title: "Scraped HTML - {fileId}"
- caption: "Scraped from: {url}"
- description: "Timestamp: {ISO timestamp}"
```

#### Search Media
```
GET /wp/v2/media?search={fileId}&per_page=100&orderby=date&order=desc
```

#### Get Statistics
```
GET /wp/v2/media?mime_type=text/html&per_page=100&orderby=date&order=desc
```

## Authentication Methods

### Option 1: Application Passwords (Recommended)
```env
WORDPRESS_USERNAME=admin
WORDPRESS_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```
- Most secure
- Can be revoked without changing account password
- Requires HTTPS or localhost

### Option 2: Account Password (Not Recommended)
```env
WORDPRESS_USERNAME=admin
WORDPRESS_PASSWORD=your_account_password
```
- Less secure
- Uses your actual account password
- Should only be used for testing

## Limitations

### WordPress Media Library Constraints
- **File Type Restrictions**: WordPress must allow `.html` file uploads
  - Some hosts block HTML files for security
  - May need to add to allowed mime types
- **Upload Size Limit**: Controlled by WordPress/PHP settings
  - `upload_max_filesize` (default: 2MB-64MB)
  - `post_max_size` (must be larger than file size)
  - `memory_limit` (PHP memory)
- **Storage Quota**: Depends on hosting plan
- **Search Limit**: Stats limited to 100 most recent HTML files

### Enable HTML File Uploads

Add to your theme's `functions.php`:
```php
add_filter('upload_mimes', function($mimes) {
    $mimes['html'] = 'text/html';
    $mimes['htm'] = 'text/html';
    return $mimes;
});
```

Or use a plugin like "WP Extra File Types".

### No Automatic Cleanup
- WordPress storage adapter does NOT support cleanup operations
- Files must be manually deleted from WordPress Media Library
- Use WordPress's built-in media management tools

## Troubleshooting

### 401 Authentication Failed
```
WordPress authentication failed. Check username and password.
```
**Solutions:**
- Verify username is correct (case-sensitive)
- Ensure you're using an application password, not account password
- Check site has HTTPS enabled (required for app passwords)
- Try regenerating the application password

### 403 Upload Forbidden
```
WordPress upload forbidden. User may not have upload permissions.
```
**Solutions:**
- User needs Editor or Administrator role
- Check user has `upload_files` capability
- Verify HTML files are allowed (see "Enable HTML File Uploads" above)

### 413 Payload Too Large
```
WordPress upload failed: Payload Too Large
```
**Solutions:**
- Increase PHP `upload_max_filesize` setting
- Increase PHP `post_max_size` setting
- Contact hosting provider to adjust limits

### File Not Found
```
HTML file not found in WordPress Media Library for ID: xxx
```
**Solutions:**
- File may have been deleted from WordPress
- Search function may not find files immediately (indexing delay)
- Check WordPress Media Library manually

## Security Best Practices

1. **Use HTTPS** - Always use HTTPS for production WordPress sites
2. **Application Passwords** - Never use your main account password
3. **Limited User Account** - Create a dedicated user with only Editor role
4. **Firewall Rules** - Restrict API access to your server's IP
5. **Regular Audits** - Periodically review uploaded files in Media Library
6. **Revoke Unused Passwords** - Remove application passwords when not in use

## Comparison with Other Storage Options

| Feature | Local Storage | BeDrive | WordPress |
|---------|--------------|---------|-----------|
| Setup Complexity | Lowest | Medium | Low |
| Storage Cost | Disk space | Subscription | Hosting plan |
| Public URLs | No | Yes (shareable links) | Yes (direct URLs) |
| Auto Cleanup | Yes | No | No |
| File Size Limit | Disk space | Unlimited | PHP limits |
| Authentication | API key | API token | App password |
| Best For | Development | Large files | Existing WP sites |

## Example Workflow

Complete workflow using WordPress storage:

```bash
# 1. Configure environment
export STORAGE_TYPE=wordpress
export WORDPRESS_URL=https://mysite.com
export WORDPRESS_USERNAME=admin
export WORDPRESS_PASSWORD="xxxx xxxx xxxx xxxx xxxx xxxx"

# 2. Start server
npm start

# 3. Scrape and save to WordPress
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=https://example.com" \
  | jq '.mediaUrl'

# Output: "https://mysite.com/wp-content/uploads/2026/02/abc123_1738368234567.html"

# 4. Share the WordPress URL directly with users
# They can download without needing your API key!
```

## WordPress Plugin Integration

You can extend this further by creating a WordPress plugin that:
- Provides a custom UI for browsing scraped HTML files
- Adds custom metadata fields (scrape date, source URL, etc.)
- Implements expiration/cleanup rules
- Generates HTML preview thumbnails
- Creates automated backups

Contact the developer for plugin development assistance.
