# Local Browser API (Playwright)

REST API server for browser automation using Playwright with persistent browser contexts. Provides endpoints for web scraping, AI chat integration (Gemini/ChatGPT), async job processing with webhook callbacks, and automated resource management via cron endpoints.

## Storage Options

The API supports three storage backends for saved HTML files:

### Local Storage (Default)
- Stores files in `./scraped_html/` directory
- Automatic cleanup of old files
- Best for: Small deployments, testing, VPS with adequate storage

### Cloud Storage (BeDrive)
- Stores files on BeDrive unlimited cloud hosting
- **Automatic shareable links** - Every uploaded file gets a public shareable link
- No storage limits, no automatic cleanup needed
- Best for: Production, large-scale scraping, limited VPS storage

### WordPress Media Storage
- Stores files in WordPress Media Library via REST API
- Direct public URLs to uploaded files
- Uses WordPress application passwords for secure authentication
- No storage limits (depends on hosting plan)
- Best for: Teams already using WordPress, need CMS integration

### Storage Configuration

Set storage type in `.env`:

```env
# Storage Configuration
STORAGE_TYPE=local          # 'local', 'cloud'/'bedrive', or 'wordpress'

# Local Storage Cleanup (only applies when STORAGE_TYPE=local)
ENABLE_LOCAL_CLEANUP=true   # Enable/disable automatic cleanup
CLEANUP_INTERVAL_HOURS=6    # Run cleanup every 6 hours
CLEANUP_MAX_AGE_HOURS=24    # Delete files older than 24 hours

# BeDrive Cloud Storage (only needed when STORAGE_TYPE=cloud or bedrive)
BEDRIVE_URL=https://your-bedrive-instance.com/api/v1
BEDRIVE_API_KEY=your_bedrive_api_key_here
BEDRIVE_FOLDER_ID=1  # Folder ID where files will be uploaded

# WordPress Media Storage (only needed when STORAGE_TYPE=wordpress)
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_USERNAME=your_username
WORDPRESS_PASSWORD=your_application_password
```

**Important:** 
- Cleanup only runs when `STORAGE_TYPE=local`. Cloud storage doesn't require cleanup.
- BeDrive storage automatically generates shareable links for each uploaded file.
- WordPress storage uses application passwords (generate in WordPress admin under Users → Profile).
- Shareable links allow public access to files without authentication.

## Features

- **Persistent Browser Context** - Single browser instance with saved sessions and login states
- **Flexible Storage** - Choose between local filesystem or BeDrive cloud storage with automatic shareable links
- **AI Chat Integration** - Send prompts to Gemini and ChatGPT with session management
- **Web Scraping** - Execute custom JavaScript, perform Google searches, visit URLs, and extract data
- **Job Queue System** - Async job processing with webhook callbacks and HMAC signing
- **Resource Management** - Automated cron endpoints to cleanup idle browser tabs
- **IAAPA Expo Scraper** - Domain-specific scraper for MapYourShow exhibitor data
- **SQLite Logging** - Error tracking and page lifecycle management in local database

## Requirements

- Node.js 18+
- Playwright browsers (Chromium)
- SQLite3 (via better-sqlite3)

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Install Playwright browsers
```bash
npx playwright install chromium
```

### 3. Configure environment variables
Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required variables:**
- `API_KEY` - Authentication key for API requests
- `WEBHOOK_SECRET` - Secret for signing webhook payloads (if using job queue)

**Optional variables:**
- `PORT` - Server port (default: 5000)
- `HEADLESS` - Run browser in headless mode (default: true)
- `WHATSAPP_API`, `WHATSAPP_APPKEY`, `WHATSAPP_AUTHKEY`, `WHATSAPP_TO` - For WhatsApp error notifications

### 4. Start the server
```bash
npm start
```

The server will:
- Create `logs/database.db` SQLite database automatically
- Store browser profile in `profile-data/` directory (preserves login sessions)
- Start listening on `http://localhost:5000` (or configured PORT)

## Architecture

### Persistent Browser Context
- Single browser instance shared across all operations
- Profile stored in `profile-data/` (committed to repo, preserves logins)
- Lazy initialization on first request
- Pages tracked in SQLite with lifecycle management

### Page Lifecycle Management
- Pages stored in `active_pages` table with status: `active` | `closed`
- `last_used` timestamp updated on every access
- Page types: `browser`, `chat`, `chatgpt`, `iaapa`
- Automatic cleanup on page close events

### Job Queue System
- In-memory FIFO queue with single-threaded processing
- Two parser modes: `vendor` (predefined scrapers) and `script` (custom JavaScript)
- Webhook dispatch with HMAC-SHA256 signature verification
- Always closes browser after job completion

## API Endpoints

### Authentication
All endpoints except `/iaapa/*` require the `x-api-key` header:
```bash
curl -H "x-api-key: YOUR_API_KEY" http://localhost:5000/endpoint
```

### Chat Endpoints

#### `POST /chat/prepare`
Prepare a Gemini chat session (opens Gemini, checks login status).

**Response:**
```json
{
  "status": "ready",
  "pageId": 1
}
```

#### `POST /chat/message`
Send a prompt to Gemini and wait for response.

**Request body:**
```json
{
  "prompt": "What is the capital of France?"
}
```

**Response:**
```json
{
  "response": "The capital of France is Paris."
}
```

#### `POST /chatgpt/message`
Send a prompt to ChatGPT and wait for response.

**Request body:**
```json
{
  "prompt": "Explain quantum computing"
}
```

**Response:**
```json
{
  "response": "Quantum computing is..."
}
```

### Browser Automation Endpoints

#### `POST /browser/execute`
Execute arbitrary JavaScript code on a browser page.

**Request body:**
```json
{
  "code": "return await page.title();"
}
```

**Response:**
```json
{
  "result": "Example Domain"
}
```

#### `GET /browser/search?q=<query>`
Perform a Google search and return results.

**Example:**
```bash
GET /browser/search?q=playwright+automation
```

**Response:**
```json
{
  "results": [
    {
      "title": "Playwright: Fast and reliable end-to-end testing",
      "link": "https://playwright.dev/",
      "snippet": "Playwright enables reliable end-to-end testing..."
    }
  ]
}
```

#### `GET /browser/visit?url=<url>`
Visit a URL and save the HTML. Returns file metadata with download/view URLs.

**Example:**
```bash
GET /browser/visit?url=https://example.com
```

**Response (Local Storage):**
```json
{
  "fileId": "abc123...",
  "fileName": "abc123_1234567890.html",
  "url": "https://example.com",
  "fileSizeKB": "0.52 KB",
  "fileSizeMB": "0.00 MB",
  "timestamp": 1234567890,
  "storageType": "local",
  "downloadUrl": "/browser/download/abc123...",
  "viewUrl": "/browser/view/abc123...",
  "message": "HTML saved successfully to local storage."
}
```

**Response (BeDrive Cloud Storage):**
```json
{
  "fileId": "abc123...",
  "cloudFileId": 9,
  "shareableLink": "https://bedrive.wpulseapp.com/drive/shares/z4gGDq5A8A...",
  "shareableHash": "z4gGDq5A8A...",
  "storageType": "cloud",
  "cloudProvider": "bedrive",
  "downloadUrl": "/browser/download/abc123...",
  "viewUrl": "/browser/view/abc123...",
  "message": "HTML saved to BeDrive cloud storage. Shareable link: https://..."
}
```

**Note:** With BeDrive storage, you can use the `shareableLink` to directly access the file without authentication.

#### `GET /browser/scrape?url=<url>&vendor=<vendor>`
Scrape product data using predefined vendor strategy.

**Supported vendors:**
- `beddermattress`
- `helixsleep`

**Example:**
```bash
GET /browser/scrape?url=https://beddermattress.com/product&vendor=beddermattress
```

**Response:**
```json
{
  "vendorPrice": 1299.99,
  "vendorBeforeDiscount": 1699.99
}
```

### Page Management Endpoints

#### `GET /pages/list`
List all active pages with their types and timestamps.

**Response:**
```json
[
  {
    "id": 1,
    "type": "browser",
    "status": "active",
    "created_at": "2026-01-31 10:30:00",
    "last_used": "2026-01-31 10:35:00"
  }
]
```

#### `POST /pages/request?type=<type>`
Create a new page of specified type.

**Types:** `browser`, `chat`, `chatgpt`, `iaapa`

**Response:**
```json
{
  "id": 2,
  "type": "browser"
}
```

#### `POST /pages/close`
Close all active pages.

**Response:**
```json
{
  "message": "All pages closed"
}
```

### Job Queue Endpoints

#### `POST /jobs`
Create an async scraping job with webhook callback.

**Request body:**
```json
{
  "jobId": "job_123",
  "target": {
    "url": "https://example.com/product"
  },
  "parser": {
    "mode": "vendor",
    "slug": "beddermattress",
    "definition": {
      "vendor": "beddermattress"
    }
  },
  "callbackUrl": "https://your-server.com/webhook"
}
```

**Alternative with custom script:**
```json
{
  "jobId": "job_456",
  "target": {
    "url": "https://example.com"
  },
  "parser": {
    "mode": "script",
    "slug": "custom",
    "definition": {
      "script": "return await page.evaluate(() => document.title);"
    }
  },
  "callbackUrl": "https://your-server.com/webhook"
}
```

**Response:**
```json
{
  "jobId": "job_123",
  "position": 0
}
```

**Webhook payload** (sent to callbackUrl on completion):
```json
{
  "jobId": "job_123",
  "status": "succeeded",
  "startedAt": "2026-01-31T10:00:00Z",
  "finishedAt": "2026-01-31T10:00:15Z",
  "artifacts": [
    {
      "type": "raw",
      "format": "json",
      "payload": {
        "vendorPrice": 1299.99
      }
    }
  ],
  "error": null,
  "meta": {
    "parser": "beddermattress",
    "mode": "vendor"
  }
}
```

**Webhook headers:**
- `Content-Type: application/json`
- `X-Signature: <hmac-sha256-hash>` (if `WEBHOOK_SECRET` configured)

### Cron/Resource Management Endpoints

#### `POST /cron/cleanup-pages`
Automated endpoint to cleanup idle browser tabs. Designed to be called by cron jobs.

**Behavior:**
- Only acts if more than 3 pages are open
- Checks each page for activity (loading, pending network requests)
- Closes pages idle for more than 5 minutes
- Keeps pages that are actively processing
- Stops when back to 3 or fewer pages

**Response:**
```json
{
  "totalPages": 5,
  "activePagesInDB": 5,
  "threshold": 3,
  "action": "cleanup_attempted",
  "closedPages": [
    {
      "id": 12,
      "type": "browser",
      "reason": "idle",
      "idleTimeMs": 420000
    }
  ],
  "keptPages": [
    {
      "id": 15,
      "type": "chat",
      "reason": "busy",
      "idleTimeMs": 120000
    }
  ],
  "finalPageCount": 3
}
```

**Closure reasons:**
- `idle` - Page idle for >5 minutes
- `already_closed` - Page was already closed
- `busy` - Page kept because actively processing
- `recently_used` - Page kept because used within last 5 minutes
- `close_failed` - Attempted to close but failed

**Recommended cron schedule:**
```bash
# Every 5 minutes
*/5 * * * * curl -X POST -H "x-api-key: YOUR_KEY" http://localhost:5000/cron/cleanup-pages
```

#### `GET /cron/stats`
Get current page statistics and idle times.

**Response:**
```json
{
  "totalBrowserPages": 4,
  "activePagesInDB": 4,
  "pages": [
    {
      "id": 15,
      "type": "chat",
      "status": "active",
      "last_used": "2026-01-31 10:35:00",
      "created_at": "2026-01-31 10:30:00",
      "idleTimeMs": 180000,
      "ageMs": 480000
    }
  ],
  "urls": [
    "https://gemini.google.com/app",
    "https://example.com"
  ]
}
```

### IAAPA Expo Scraper Endpoints
*(No authentication required)*

#### `GET /iaapa/run-all?file=<filename>`
Start background job to scrape exhibitor data from IAAPA Expo.

**Example:**
```bash
GET /iaapa/run-all?file=iaapaexpo25_North_Concourse.json
```

**Response:**
```json
{
  "jobId": "job_1738339200000_abc12"
}
```

#### `GET /iaapa/status?id=<jobId>`
Check status of IAAPA scraping job.

**Response:**
```json
{
  "file": "iaapaexpo25_North_Concourse.json",
  "total": 150,
  "processed": 75,
  "startedAt": 1738339200000,
  "done": false,
  "error": null,
  "csvName": "iaapaexpo25_North_Concourse_all_1738339200000.csv"
}
```

#### `GET /iaapa/download-csv?file=<csvname>`
Download generated CSV file.

**Example:**
```bash
GET /iaapa/download-csv?file=iaapaexpo25_North_Concourse_all_1738339200000.csv
```

### Error Logging Endpoints

#### `POST /error/report`
Log an error to database and optionally send WhatsApp notification.

**Request body:**
```json
{
  "type": "CUSTOM_ERROR",
  "message": "Something went wrong",
  "stack": "Error: Something went wrong\n  at ...",
  "route": "/custom/endpoint",
  "input": {"data": "optional context"}
}
```

**Response:**
```json
{
  "message": "Error logged and notification sent"
}
```

## Database Schema

### `error_logs` Table
```sql
CREATE TABLE error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  message TEXT,
  stack TEXT,
  route TEXT,
  input TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### `active_pages` Table
```sql
CREATE TABLE active_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Development

### Running in Development Mode
```bash
# Run with visible browser
HEADLESS=false npm start

# Run on custom port
PORT=3000 npm start
```

### File Structure
```
├── controllers/        # Request handlers
├── helpers/           # Business logic (browser, chat)
├── middleware/        # Express middleware
├── routes/            # Route definitions
├── services/          # Background services (job queue)
├── utils/             # Utilities (DB, logging, page management)
├── Data/              # IAAPA JSON/CSV files
├── logs/              # SQLite database
├── profile-data/      # Browser profile storage
└── index.js           # Express app entry point
```

### Adding Custom Scrapers

To add a new vendor scraper, edit `helpers/browserHelper.js`:

```javascript
const scraperStrategies = {
  yournewvendor: async (page) => {
    return await page.evaluate(() => {
      // Your scraping logic here
      return {
        vendorPrice: parseFloat(document.querySelector('.price').innerText),
        vendorBeforeDiscount: parseFloat(document.querySelector('.original').innerText)
      };
    });
  }
};
```

## Production Deployment

### Recommended Setup

1. **Use a process manager:**
   ```bash
   npm install -g pm2
   pm2 start index.js --name localbrowser
   pm2 save
   pm2 startup
   ```

2. **Set up cron for resource management:**
   - Linux/Mac: Add to crontab
   - Windows: Use Task Scheduler
   ```bash
   */5 * * * * curl -X POST -H "x-api-key: YOUR_KEY" http://localhost:5000/cron/cleanup-pages
   ```

3. **Configure reverse proxy (nginx):**
   ```nginx
   server {
     listen 80;
     server_name your-domain.com;
     
     location / {
       proxy_pass http://localhost:5000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```

4. **Enable HTTPS with Let's Encrypt:**
   ```bash
   certbot --nginx -d your-domain.com
   ```

### Security Considerations

- Keep `API_KEY` strong and secure (32+ random characters)
- Use HTTPS in production
- Keep `WEBHOOK_SECRET` secure for webhook signature verification
- Regularly backup `logs/database.db`
- Monitor disk space for `profile-data/` directory
- Consider rate limiting at reverse proxy level

## Troubleshooting

### Browser doesn't close after tasks
- Check cron endpoint is running: `GET /cron/stats`
- Manually trigger cleanup: `POST /cron/cleanup-pages`
- Verify pages are properly closing in job queue finally blocks

### "Navigation timeout" errors
- Increase timeout in `gotoWithRetry()` helper
- Check network connectivity
- Verify target website is accessible

### Database locked errors
- SQLite uses file-based locking
- Ensure no other processes are accessing the database
- Consider connection pooling if scaling horizontally

### WhatsApp notifications not working
- Verify all `WHATSAPP_*` environment variables are set
- Check API endpoint is accessible
- Review error logs in database

## Documentation

Comprehensive guides are available in the `docs/` folder:

### Core Documentation
- **[SETUP.md](docs/SETUP.md)** - Complete setup and installation guide
  - System requirements
  - Installation steps
  - Configuration
  - Testing
  - Production deployment
  
- **[STORAGE.md](docs/STORAGE.md)** - Storage configuration guide
  - Local, BeDrive, and WordPress storage options
  - Setup instructions for each storage type
  - API usage examples
  - Troubleshooting
  - Comparison and recommendations

### Additional Documentation
- **[COMMON_ISSUES.md](docs/COMMON_ISSUES.md)** - Common errors and solutions
- **[FILE_STORAGE_API.md](docs/FILE_STORAGE_API.md)** - API endpoints reference
- **[IMPROVEMENTS.md](docs/IMPROVEMENTS.md)** - Enhancement suggestions
- **[SOLUTION_SUMMARY.md](docs/SOLUTION_SUMMARY.md)** - Implementation details

### Testing
All test scripts are located in the `tests/` folder:
- `test-storage-adapter.js` - Test storage configuration
- `test-wordpress-storage.js` - Test WordPress integration
- `test-shareable-link.js` - Test BeDrive shareable links

Run tests:
```bash
cd tests
node test-storage-adapter.js
```

## License

ISC

## Support

For issues and questions:

1. **Check Documentation:**
   - [Setup Guide](docs/SETUP.md)
   - [Storage Guide](docs/STORAGE.md)

2. **Review Logs:**
   ```bash
   # Application logs
   tail -f logs/*.log
   
   # Database errors
   sqlite3 logs/database.db "SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT 10;"
   ```

3. **Run Tests:**
   ```bash
   cd tests
   node test-storage-adapter.js
   ```

4. **Check Configuration:**
   ```bash
   # Verify environment
   cat .env
   
   # Test API
   curl -H "x-api-key: YOUR_KEY" http://localhost:5000/cleanup/stats
   ```
