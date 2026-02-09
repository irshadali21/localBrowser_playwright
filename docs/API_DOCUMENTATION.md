# LocalBrowser Playwright API Documentation

## Overview

LocalBrowser is a Node.js/Express API service powered by Playwright for browser automation, web scraping, and task processing. This document describes all available API endpoints, their parameters, request/response formats, and authentication requirements.

---

## Base URL

```
http://localhost:5000
```

**Note:** Port may vary based on environment configuration (`PORT` environment variable).

---

## Authentication

### API Key Authentication

All public API endpoints (except `/internal/*` and `/iaapa/*`) require a valid API key passed via the `x-api-key` header.

| Header | Value |
|--------|-------|
| `x-api-key` | Your API key (from `API_KEY` environment variable) |

**Example:**
```bash
curl -X GET http://localhost:5000/browser/search?q=example \
  -H "x-api-key: your-api-key-here"
```

### HMAC Signature (Internal Routes Only)

The `/internal/*` endpoints use HMAC-SHA256 signature verification for secure communication with Laravel backend.

Required Headers for `/internal/*`:
- `X-Signature`: HMAC signature of the request body
- `X-Timestamp`: Unix timestamp of the request

---

## Endpoints

### 1. Browser Operations (`/browser/*`)

#### 1.1 Execute Custom JavaScript Code

**Endpoint:** `POST /browser/execute`

Execute arbitrary JavaScript code in a browser context.

**Request:**
```json
{
  "code": "document.title"
}
```

**Response:**
```json
{
  "result": "Page Title"
}
```

---

#### 1.2 Google Search

**Endpoint:** `GET /browser/search`

Perform a Google search and return results.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |

**Example Request:**
```
GET /browser/search?q=playwright%20automation
```

**Response:**
```json
{
  "results": [
    {
      "title": "Playwright",
      "url": "https://playwright.dev/",
      "snippet": "Playwright enables reliable end-to-end testing..."
    }
  ]
}
```

---

#### 1.3 Visit URL

**Endpoint:** `GET /browser/visit`

Navigate to a URL and optionally return the HTML content.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | Yes | - | Target URL (must start with http:// or https://) |
| `returnHtml` | boolean | No | `false` | Return HTML content as string |
| `saveToFile` | boolean | No | `true` | Save HTML to file for later retrieval |
| `waitUntil` | string | No | `networkidle` | Wait until condition (load, domcontentloaded, networkidle, commit) |
| `timeout` | number | No | `60000` | Timeout in milliseconds |

**Example Request:**
```
GET /browser/visit?url=https://example.com&returnHtml=true
```

**Response (returnHtml=true):**
```json
{
  "html": "<html>...</html>"
}
```

**Response (returnHtml=false):**
```json
{
  "fileId": "uuid-string",
  "fileName": "example.com_1699999999.html",
  "fileSizeBytes": 12345,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

#### 1.4 Scrape Product Data

**Endpoint:** `GET /browser/scrape`

Scrape product information from a vendor URL.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Product page URL |
| `vendor` | string | Yes | Vendor name (e.g., "amazon", "ebay") |

**Example Request:**
```
GET /browser/scrape?url=https://example.com/product/123&vendor=custom
```

**Response:**
```json
{
  "product": {
    "title": "Product Name",
    "price": 29.99,
    "description": "Product description...",
    "images": ["url1.jpg", "url2.jpg"]
  }
}
```

---

#### 1.5 Download HTML File

**Endpoint:** `GET /browser/download/:fileId`

Download a previously saved HTML file.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `fileId` | string | File identifier UUID |

**Response:**
- Content-Type: `text/html`
- Content-Disposition: `attachment; filename="filename.html"`

---

#### 1.6 View HTML File

**Endpoint:** `GET /browser/view/:fileId`

View saved HTML file metadata and content.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `fileId` | string | File identifier UUID |

**Response:**
```json
{
  "fileId": "uuid-string",
  "fileName": "example.com_1699999999.html",
  "html": "<html>...</html>",
  "fileSizeBytes": 12345,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 2. Chat Operations (`/chat/*`)

#### 2.1 Prepare Chat Session

**Endpoint:** `POST /chat/prepare`

Initialize a new Gemini chat session.

**Request Body:** Empty

**Response:**
```json
{
  "sessionId": "session-uuid",
  "status": "ready"
}
```

---

#### 2.2 Send Message to Gemini

**Endpoint:** `POST /chat/message`

Send a message to the Gemini AI chatbot.

**Request:**
```json
{
  "prompt": "Hello, how are you?"
}
```

**Response:**
```json
{
  "reply": "I'm doing well, thank you for asking!"
}
```

---

#### 2.3 Send Message to ChatGPT

**Endpoint:** `POST /chatgpt/message`

Send a message to the ChatGPT AI chatbot.

**Request:**
```json
{
  "prompt": "Hello, how are you?"
}
```

**Response:**
```json
{
  "reply": "I'm doing well, thank you for asking!"
}
```

---

### 3. Cleanup Operations (`/cleanup/*`)

#### 3.1 Run Cleanup

**Endpoint:** `POST /cleanup`

Clean up old files based on maximum age.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `maxAge` | number | No | `24` | Maximum age in hours |

**Example Request:**
```
POST /cleanup?maxAge=48
```

**Response:**
```json
{
  "deleted": 15,
  "freedBytes": 10485760,
  "storageType": "local"
}
```

---

#### 3.2 Get Cleanup Stats

**Endpoint:** `GET /cleanup/stats`

Get current storage statistics.

**Response:**
```json
{
  "totalFiles": 150,
  "totalSizeBytes": 52428800,
  "oldestFileAgeHours": 72,
  "storageType": "local"
}
```

---

### 4. Cron Operations (`/cron/*`)

#### 4.1 Cleanup Pages

**Endpoint:** `POST /cron/cleanup-pages`

Cleanup idle browser pages. Closes pages that are idle (not being used) when more than 3 pages are open.

**Request Body:** Empty

**Response:**
```json
{
  "totalPages": 5,
  "activePagesInDB": 5,
  "threshold": 3,
  "action": "cleanup_completed",
  "closedPages": [
    {
      "id": "page-uuid",
      "type": "scraper",
      "reason": "idle",
      "idleTimeMs": 600000
    }
  ],
  "keptPages": [
    {
      "id": "page-uuid",
      "type": "browser",
      "reason": "busy"
    }
  ],
  "finalPageCount": 3
}
```

---

#### 4.2 Get Page Statistics

**Endpoint:** `GET /cron/stats`

Get current page statistics and health information.

**Response:**
```json
{
  "totalBrowserPages": 3,
  "activePagesInDB": 3,
  "pages": [
    {
      "id": "page-uuid",
      "type": "scraper",
      "status": "active",
      "last_used": "2024-01-15T10:25:00.000Z",
      "created_at": "2024-01-15T10:00:00.000Z",
      "idleTimeMs": 300000,
      "ageMs": 1800000
    }
  ],
  "urls": [
    "https://example.com"
  ]
}
```

---

### 5. Error Reporting (`/error/*`)

#### 5.1 Report Error

**Endpoint:** `POST /error/report`

Report an error for logging and notification.

**Request:**
```json
{
  "type": "SCRAPE_FAILED",
  "message": "Failed to scrape page",
  "stack": "Error stack trace...",
  "route": "/browser/scrape",
  "input": {
    "url": "https://example.com",
    "vendor": "test"
  }
}
```

**Response:**
```json
{
  "status": "logged_and_forwarded"
}
```

**Note:** Errors are logged to database and optionally forwarded via WhatsApp notification if configured.

---

### 6. Job Operations (`/jobs/*`)

#### 6.1 Create Job

**Endpoint:** `POST /jobs`

Create a new scraping job.

**Request:**
```json
{
  "jobId": "optional-job-id",
  "target": {
    "url": "https://example.com/product",
    "metadata": {
      "category": "electronics"
    },
    "lead": {
      "company": "Example Corp"
    }
  },
  "parser": {
    "id": "parser-id",
    "slug": "product-parser",
    "mode": "single",
    "definition": {
      "fields": ["title", "price", "description"]
    }
  },
  "callbackUrl": "https://your-app.com/callback"
}
```

**Response:**
```json
{
  "jobId": "generated-or-provided-job-id",
  "status": "queued"
}
```

---

### 7. Page Operations (`/pages/*`)

#### 7.1 List Pages

**Endpoint:** `GET /pages/list`

List all active browser pages.

**Response:**
```json
{
  "pages": [
    {
      "id": "page-uuid",
      "type": "scraper",
      "url": "https://example.com",
      "status": "active",
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

---

#### 7.2 Request Page

**Endpoint:** `POST /pages/request`

Request a new browser page.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | Yes | Page type (e.g., "scraper", "browser") |

**Example Request:**
```
POST /pages/request?type=scraper
```

**Response:**
```json
{
  "pageId": "page-uuid"
}
```

---

#### 7.3 Close Page

**Endpoint:** `POST /pages/close`

Close the current page/chat session.

**Response:**
```json
{
  "status": "pages closed"
}
```

---

### 8. IAAPA Expo Operations (`/iaapa/*`)

**Note:** These endpoints are public (no API key required) and designed for background scraping workflows.

#### 8.1 Run All Scraping Jobs

**Endpoint:** `GET /iaapa/run-all`

Start background scraping of all exhibitors from a JSON data file.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | string | Yes | JSON filename from `Data/` directory |

**Example Request:**
```
GET /iaapa/run-all?file=iaapaexpo25_North_Concourse.json
```

**Response:**
```json
{
  "jobId": "job_1699999999_abc12"
}
```

---

#### 8.2 Get Job Status

**Endpoint:** `GET /iaapa/status`

Get the status of a running scraping job.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Job ID from `/iaapa/run-all` |

**Example Request:**
```
GET /iaapa/status?id=job_1699999999_abc12
```

**Response:**
```json
{
  "file": "iaapaexpo25_North_Concourse.json",
  "total": 500,
  "processed": 250,
  "done": false,
  "error": null,
  "csvName": "iaapaexpo25_North_Concourse_all_1699999999.csv"
}
```

---

#### 8.3 Download CSV

**Endpoint:** `GET /iaapa/download-csv`

Download the scraped CSV file.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | CSV filename from status response |

**Response:**
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="filename.csv"`

---

### 9. Internal API (`/internal/*`)

**Note:** These endpoints are HMAC-secured and used for Laravel backend communication.

#### 9.1 Ping

**Endpoint:** `POST /internal/ping`

Laravel notifies Node that work is available. Node responds immediately and asynchronously fetches pending tasks.

**Request:** Empty

**Response:**
```json
{
  "status": "ok",
  "worker_id": "worker-12345",
  "timestamp": 1699999999,
  "uptime": 3600.5
}
```

---

#### 9.2 Request Work

**Endpoint:** `POST /internal/request-work`

Worker requests available tasks from Laravel.

**Request:**
```json
{
  "max_tasks": 5
}
```

**Response (tasks available):**
```json
{
  "status": "ok",
  "tasks": [
    {
      "id": "task-uuid",
      "type": "scrape",
      "url": "https://example.com",
      "payload": {}
    }
  ],
  "timestamp": 1699999999
}
```

**Response (no work):**
```json
{
  "status": "no_work",
  "tasks": [],
  "timestamp": 1699999999
}
```

---

#### 9.3 Submit Task Result

**Endpoint:** `POST /internal/task-result`

Worker submits completed task result.

**Request:**
```json
{
  "task_id": "task-uuid",
  "success": true,
  "result": {
    "data": "scraped content"
  },
  "executed_at": "2024-01-15T10:30:00.000Z",
  "duration_ms": 5000
}
```

**Response:**
```json
{
  "status": "accepted",
  "task_id": "task-uuid",
  "timestamp": 1699999999
}
```

---

#### 9.4 Queue Statistics

**Endpoint:** `GET /internal/queue/stats`

Get task queue statistics.

**Response:**
```json
{
  "status": "ok",
  "stats": {
    "pending": 10,
    "processing": 2,
    "completed": 100,
    "failed": 5
  },
  "worker_id": "worker-12345",
  "timestamp": 1699999999
}
```

---

#### 9.5 Enqueue Tasks

**Endpoint:** `POST /internal/queue/enqueue`

Add new tasks to the queue.

**Request:**
```json
{
  "tasks": [
    {
      "type": "scrape",
      "url": "https://example.com",
      "payload": {}
    }
  ]
}
```

**Response:**
```json
{
  "status": "ok",
  "task_ids": ["task-uuid-1"],
  "count": 1,
  "timestamp": 1699999999
}
```

---

#### 9.6 Queue Cleanup

**Endpoint:** `POST /internal/queue/cleanup`

Clean up old tasks from the queue.

**Request:**
```json
{
  "older_than_days": 7
}
```

**Response:**
```json
{
  "status": "ok",
  "deleted": 50,
  "timestamp": 1699999999
}
```

---

#### 9.7 Reset Stuck Tasks

**Endpoint:** `POST /internal/queue/reset-stuck`

Reset tasks that have been stuck in processing state.

**Request:**
```json
{
  "stuck_after_minutes": 30
}
```

**Response:**
```json
{
  "status": "ok",
  "reset": 3,
  "timestamp": 1699999999
}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Server port |
| `API_KEY` | Yes | - | API key for authentication |
| `LARAVEL_INTERNAL_URL` | No | - | Laravel backend URL for internal API |
| `LOCALBROWSER_SECRET` | No | - | Secret for HMAC signatures |
| `WORKER_ID` | No | `worker-{pid}` | Unique worker identifier |
| `STORAGE_TYPE` | No | `local` | Storage adapter (local, cloud, wordpress) |
| `ENABLE_LOCAL_CLEANUP` | No | `true` | Enable local file cleanup |
| `CLEANUP_INTERVAL_HOURS` | No | `6` | Cleanup job interval |
| `CLEANUP_MAX_AGE_HOURS` | No | `24` | Maximum file age for cleanup |
| `ENABLE_TASK_PROCESSOR` | No | `true` | Enable background task processor |
| `TASK_PROCESSOR_INTERVAL_MS` | No | `5000` | Task processor polling interval |
| `MAX_CONCURRENT_TASKS` | No | `3` | Maximum concurrent tasks |
| `WHATSAPP_API` | No | - | WhatsApp API endpoint for notifications |
| `WHATSAPP_APPKEY` | No | - | WhatsApp app key |
| `WHATSAPP_AUTHKEY` | No | - | WhatsApp auth key |
| `WHATSAPP_TO` | No | - | WhatsApp recipient number |

---

## Error Responses

All endpoints return standardized error responses:

```json
{
  "error": "Error message description"
}
```

**HTTP Status Codes:**
| Code | Description |
|------|-------------|
| `400` | Bad Request - Invalid parameters |
| `401` | Unauthorized - Invalid or missing API key |
| `404` | Not Found - Resource not found |
| `500` | Internal Server Error |

---

## Rate Limiting

No built-in rate limiting is implemented. Client applications should implement appropriate throttling to avoid overwhelming the server.

---

## Support

For issues or questions, please check the existing documentation in the `docs/` directory or open an issue.
