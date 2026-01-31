# LocalBrowser Playwright API - AI Coding Instructions

## Project Overview
REST API server for browser automation using Playwright with persistent browser contexts. Provides endpoints for web scraping, AI chat integration (Gemini/ChatGPT), and async job processing with webhook callbacks.

## Architecture Patterns

### Persistent Browser Context
- **Single persistent context** shared across all operations via `playwrightConfig.js`
- Browser profile stored in `profile-data/` directory (committed, preserves login sessions)
- Context initialized lazily on first request through `pageFactory.getBrowserContext()`
- **Never** launch multiple browser instances—reuse the singleton context

### Page Lifecycle Management
- Pages tracked in SQLite (`active_pages` table) with status: 'active' | 'closed'
- **Page types**: 'browser', 'chat', 'chatgpt', 'iaapa' determine initialization behavior
  - `chat` type auto-navigates to `https://gemini.google.com/app`
  - Other types start blank
- Request pages via `pageManager.requestPage(type)` which returns `{ id, page }`
- Pages automatically register cleanup on 'close' event to update DB status
- Example pattern in `helpers/browserHelper.js` and `helpers/chatManager.js`:
  ```javascript
  let browserPageId = null;
  let browserPage = null;
  
  async function getBrowserPage() {
    const { page, id } = await requestPage('browser');
    browserPage = page;
    browserPageId = id;
    return browserPage;
  }
  ```

### Job Queue System
- In-memory FIFO queue in `services/jobQueue.js` with single-threaded processing
- Jobs **must** include: `jobId`, `target.url`, `parser.mode`, `callbackUrl`
- Two parser modes:
  - `vendor`: Uses predefined scraping logic in `browserHelper.scrapeProduct(url, vendorKey)`
  - `script`: Executes custom JS via `new Function('page', userCode)`
- **Always** closes browser after job completion (`closeBrowser()` in finally block)
- Dispatches results via webhook with HMAC-SHA256 signature (`WEBHOOK_SECRET` env var)

## Key Conventions

### Error Handling
- All errors logged to SQLite via `logErrorToDB()` with structured fields: `type`, `message`, `stack`, `route`, `input`
- Error types follow pattern: `CHAT_PREPARE_FAILED`, `SCRAPE_JOB_FAILED`, etc.
- Controllers wrap operations in try/catch, log errors, then call `next(err)` for Express error handler
- Central error handler in `middleware/errorHandler.js` returns 500 with error message

### Route-Controller Pattern
- Routes in `routes/` define endpoints, delegate to controllers in `controllers/`
- All routes (except `/iaapa/*`) require `x-api-key` header matching `process.env.API_KEY`
- IAAPA routes bypass auth for external access (see middleware in `index.js`)

### Database Access
- Single SQLite database at `logs/database.db` via `utils/db.js` (better-sqlite3)
- Use synchronous `db.prepare().run|get|all()` pattern—no async needed
- Auto-creates `error_logs` and `active_pages` tables on startup

### Browser Navigation
- Use `gotoWithRetry()` helper for retry logic with exponential backoff
- IAAPA scraper adds randomized delays (`randDelayMs()`) to avoid detection
- Remove `<script>`, `<style>`, `<link>` tags via `page.evaluate()` before returning HTML

## Development Workflows

### Starting the Server
```bash
npm install
npx playwright install  # One-time: installs Chromium
npm start  # Runs on PORT=5000 (default)
```

### Environment Variables
Required: `API_KEY`, `WEBHOOK_SECRET` (for job callbacks)  
Optional: `PORT`, `HEADLESS` (false shows browser), WhatsApp API keys for error reporting

### Testing Endpoints
```bash
curl -H "x-api-key: YOUR_KEY" http://localhost:5000/browser/search?q=playwright
```

## Domain-Specific Logic

### IAAPA Expo Scraper (`controllers/iaapaController.js`)
- Scrapes exhibitor data from MapYourShow platform
- Reads JSON files from `Data/` directory with exhibitor IDs
- Background jobs tracked in-memory (`jobs` Map) with progress callbacks
- Uses dedicated 'iaapa' page type with aggressive retry logic (3 attempts, exponential backoff)
- Generates timestamped CSV files in `Data/` directory

### Chat Integration
- **Gemini**: Waits for `message-content` selector, dismisses popups via `dismissGeminiPopup()`
- **ChatGPT**: Monitors `/backend-api/conversation` network requests to detect response completion
- Both detect logged-out state and return appropriate status codes

## Critical Files
- `playwrightConfig.js`: Browser launch config (persistent context setup)
- `utils/pageFactory.js`: Singleton context + page configuration
- `utils/pageManager.js`: Page lifecycle DB tracking
- `services/jobQueue.js`: Async job processing with webhook dispatch
- `helpers/browserHelper.js`: Core scraping utilities (search, visit, execute)
- `controllers/iaapaController.js`: Domain-specific scraper with retry/delay logic
