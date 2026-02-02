# Cloud Storage Integration - Implementation Summary

## Overview
Implemented flexible storage backend with support for both local filesystem and BeDrive cloud storage. The system uses the **Adapter Pattern** to abstract storage operations and the **Factory Pattern** to instantiate the correct adapter based on environment configuration.

## Architecture

### Storage Adapter Pattern
```
StorageAdapter (Base Interface)
    ├── LocalStorageAdapter (Filesystem implementation)
    ├── BedriveStorageAdapter (Cloud API implementation)
    └── WordPressStorageAdapter (WordPress Media API implementation)
```

### Key Components

#### 1. StorageAdapter.js (Base Interface)
- Defines contract that all storage implementations must follow
- Methods: `saveHtml()`, `getHtml()`, `getStats()`, `cleanup()`, `getType()`

#### 2. LocalStorageAdapter.js
- Stores files in `./scraped_html/` directory
- Supports automatic cleanup of old files
- Returns file metadata with download/view URLs

#### 3. BedriveStorageAdapter.js
- Integrates with BeDrive REST API
- Uploads files via `/api/v1/uploads` endpoint
- Downloads files via `/api/v1/files/:id/download`
- Auto-creates `scraped_html` folder on BeDrive
- No cleanup support (unlimited storage)

#### 4. WordPressStorageAdapter.js
- Integrates with WordPress REST API Media Library
- Uploads files via `/wp/v2/media` endpoint
- Uses WordPress application passwords for authentication
- Downloads files directly from WordPress media URLs
- Adds metadata (title, caption, description) to uploads
- No cleanup support (managed by WordPress)

#### 5. StorageFactory.js
- Creates appropriate storage adapter based on `STORAGE_TYPE` env variable
- Reads configuration from environment variables
- Single point of adapter instantiation

## Environment Configuration

```env
# Storage Configuration
STORAGE_TYPE=local          # 'local', 'cloud'/'bedrive', or 'wordpress'

# Local Storage Cleanup (only applies when STORAGE_TYPE=local)
ENABLE_LOCAL_CLEANUP=true   # Enable/disable automatic cleanup
CLEANUP_INTERVAL_HOURS=6    # Run cleanup every 6 hours
CLEANUP_MAX_AGE_HOURS=24    # Delete files older than 24 hours

# BeDrive Cloud Storage (only needed when STORAGE_TYPE=cloud or bedrive)
BEDRIVE_URL=https://your-bedrive-instance.com
BEDRIVE_API_KEY=your_bedrive_api_key_here
BEDRIVE_FOLDER_ID=scraped_html

# WordPress Media Storage (only needed when STORAGE_TYPE=wordpress)
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_USERNAME=your_username
WORDPRESS_PASSWORD=your_application_password
```

## Code Changes

### helpers/browserHelper.js
**Before:**
```javascript
// Direct file operations
const fs = require('fs');
fs.writeFileSync(filePath, html, 'utf8');
```

**After:**
```javascript
// Uses storage adapter
const StorageFactory = require('../utils/storage/StorageFactory');
const storage = StorageFactory.createStorage();
return await storage.saveHtml(fileId, html, url);
```

### controllers/cleanupController.js
**Before:**
```javascript
const { cleanupOldFiles } = require('../utils/fileCleanup');
const result = cleanupOldFiles(maxAge);
```

**After:**
```javascript
const StorageFactory = require('../utils/storage/StorageFactory');
const storage = StorageFactory.createStorage();
const result = await storage.cleanup(maxAge);
```

### index.js (Server Startup)
**Before:**
```javascript
// Always scheduled cleanup
const { scheduleCleanup } = require('./utils/fileCleanup');
scheduleCleanup(6, 24);
```

**After:**
```javascript
// Conditional cleanup (local only)
const storageType = process.env.STORAGE_TYPE || 'local';
const enableCleanup = process.env.ENABLE_LOCAL_CLEANUP !== 'false';

if (storageType === 'local' && enableCleanup) {
  const { scheduleCleanup } = require('./utils/fileCleanup');
  scheduleCleanup(intervalHours, maxAgeHours);
  console.log(`[Storage] Local file cleanup scheduled...`);
} else {
  console.log(`[Storage] Using ${storageType} storage - cleanup disabled`);
}
```

## API Response Changes

All responses now include `storageType` field:

```json
{
  "fileId": "abc123...",
  "fileName": "abc123_1234567890.html",
  "url": "http://example.com",
  "fileSizeKB": "0.52 KB",
  "fileSizeMB": "0.00 MB",
  "storageType": "local",
  "downloadUrl": "/browser/download/abc123...",
  "viewUrl": "/browser/view/abc123...",
  "message": "HTML saved successfully to local storage..."
}
```

## Testing

### Test Scripts

1. **test-storage-adapter.js** - Unit tests for storage adapters
   ```bash
   node test-storage-adapter.js
   ```

2. **test-api-storage.ps1** - API integration tests
   ```powershell
   .\test-api-storage.ps1
   ```

### Test Results (Local Storage)
✅ saveHtml() - Successfully saves HTML files
✅ getHtml() - Successfully retrieves HTML files
✅ getStats() - Returns file count and size statistics
✅ cleanup() - Deletes old files correctly
✅ API endpoints work with storage adapter
✅ Cleanup scheduling only activates for local storage

### BeDrive Cloud Storage Testing
To test with BeDrive:
1. Set up BeDrive instance
2. Generate API key
3. Update .env:
   ```env
   STORAGE_TYPE=cloud
   BEDRIVE_URL=https://your-instance.com
   BEDRIVE_API_KEY=your_key_here
   ```
4. Run tests: `node test-storage-adapter.js`

## Benefits

1. **Flexibility** - Easy switching between local and cloud storage
2. **Scalability** - Cloud storage removes VPS storage limitations
3. **Maintainability** - Clean separation of concerns via adapter pattern
4. **Cost Optimization** - Use local storage for testing, cloud for production
5. **Zero Downtime** - Change storage type without code changes
6. **Conditional Cleanup** - Automatic cleanup only when needed (local storage)

## Migration Guide

### Switching from Local to Cloud

1. Set up BeDrive instance and obtain API key
2. Update `.env`:
   ```env
   STORAGE_TYPE=cloud
   BEDRIVE_URL=https://your-bedrive.com
   BEDRIVE_API_KEY=your_api_key
   ```
3. Restart server
4. Old local files remain untouched (can be manually cleaned up)

### Switching from Cloud to Local

1. Update `.env`:
   ```env
   STORAGE_TYPE=local
   ENABLE_LOCAL_CLEANUP=true
   ```
2. Restart server
3. Cloud files remain on BeDrive (can be manually downloaded if needed)

## Notes

- **Cleanup Behavior**: Cleanup ONLY runs when `STORAGE_TYPE=local`
- **Cloud Storage**: No cleanup needed due to unlimited storage
- **Backward Compatibility**: Existing local files work without migration
- **API Compatibility**: All endpoints work identically with both storage types
- **Error Handling**: Storage errors logged to SQLite database
- **Security**: BeDrive API key should be kept secure (never commit to repo)

## Future Enhancements

Possible additions:
- Amazon S3 adapter
- Azure Blob Storage adapter
- Google Cloud Storage adapter
- Storage migration utility (local ↔ cloud)
- Webhook notifications for storage events
- Automatic storage type selection based on available space

## Related Documentation

- **WordPress Setup Guide**: [WORDPRESS_STORAGE_SETUP.md](./WORDPRESS_STORAGE_SETUP.md)
- **BeDrive Setup Guide**: [BEDRIVE_SETUP.md](./BEDRIVE_SETUP.md)
- **File Storage API**: [FILE_STORAGE_API.md](./FILE_STORAGE_API.md)
