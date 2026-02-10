# LocalBrowser API Gateway - Complete Reference

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started](#2-getting-started)
3. [Authentication](#3-authentication)
4. [Command Reference](#4-command-reference)
5. [Error Handling](#5-error-handling)
6. [Rate Limiting](#6-rate-limiting)
7. [HIPAA Compliance](#7-hipaa-compliance)
8. [Migration Guide](#8-migration-guide)
9. [Versioning](#9-versioning)

---

## 1. Overview

The LocalBrowser API Gateway provides a unified entry point for all browser automation, web scraping, chat operations, job processing, and internal services. Instead of calling multiple endpoints, all operations are routed through a single command-based interface.

### Key Features

- **Single Endpoint**: `POST /api/v1/gateway` handles all commands
- **26 Supported Commands** across 9 categories
- **Type-Safe**: All payloads validated against Zod schemas
- **Extensible**: Easy to add new command types
- **Production Ready**: Rate limiting, caching, metrics, OpenAPI docs
- **Backward Compatible**: Legacy routes continue to work during migration

### Base URL

```
Production: https://api.localbrowser.io/v1
Development: http://localhost:5000/v1
```

---

## 2. Getting Started

### Your First Request

All requests use the same structure. Here's a simple example:

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "type": "browser.visit",
    "version": "v1",
    "payload": {
      "url": "https://example.com",
      "options": {
        "returnHtml": true,
        "waitUntil": "networkidle"
      }
    }
  }'
```

### Request Structure

| Field       | Type   | Required | Description                                        |
| ----------- | ------ | -------- | -------------------------------------------------- |
| `commandId` | string | No       | Unique command ID (auto-generated if not provided) |
| `type`      | string | Yes      | Command type (e.g., `browser.visit`)               |
| `version`   | string | No       | API version (default: `v1`)                        |
| `payload`   | object | Yes      | Command-specific payload                           |
| `metadata`  | object | No       | Optional request metadata                          |

### Response Structure

```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "commandId": "cmd_1707595200000_abc123",
    "processedAt": "2024-02-10T12:00:01.500Z",
    "durationMs": 1500
  }
}
```

---

## 3. Authentication

### 3.1 API Key Authentication

For most endpoints, use the `X-API-Key` header:

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com"}}'
```

### 3.2 HMAC Signature (Internal Routes)

For Laravel backend communication, use HMAC-SHA256 signatures:

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "X-Signature: your-hmac-signature" \
  -H "X-Timestamp: 1707595200" \
  -d '{"type": "internal.ping", "payload": {}}'
```

**Signature Generation:**

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', process.env.LOCALBROWSER_SECRET)
  .update(timestamp.toString())
  .digest('hex');
```

### 3.3 HIPAA Token

For HIPAA-sensitive operations:

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "X-HIPAA-Token: your-hipaa-token" \
  -d '{"type": "internal.submit_result", "payload": {...}}'
```

---

## 4. Command Reference

### 4.1 Browser Operations (6 commands)

#### `browser.execute` - Execute JavaScript

**Payload:**

```json
{
  "code": "document.title",
  "timeout": 30000
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "result": "Page Title"
  }
}
```

---

#### `browser.search` - Google Search

**Payload:**

```json
{
  "query": "Playwright automation",
  "numResults": 10
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "title": "Playwright",
        "url": "https://playwright.dev/",
        "snippet": "Playwright enables reliable end-to-end testing..."
      }
    ]
  }
}
```

---

#### `browser.visit` - Navigate to URL

**Payload:**

```json
{
  "url": "https://example.com",
  "options": {
    "waitUntil": "networkidle",
    "timeout": 60000,
    "returnHtml": true,
    "saveToFile": true,
    "handleCloudflare": false,
    "useProgressiveRetry": false
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "fileId": "file_abc123",
    "url": "https://example.com",
    "html": "<html>...</html>"
  }
}
```

---

#### `browser.scrape` - Scrape Product Data

**Payload:**

```json
{
  "url": "https://example.com/product/123",
  "vendor": "amazon"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "product": {
      "title": "Product Name",
      "price": 29.99,
      "description": "Product description...",
      "images": ["url1.jpg", "url2.jpg"]
    }
  }
}
```

---

#### `browser.download` - Download HTML File

**Payload:**

```json
{
  "fileId": "file_abc123"
}
```

**Response:**

- Content-Type: `text/html`
- Content-Disposition: `attachment`

---

#### `browser.view` - View HTML File

**Payload:**

```json
{
  "fileId": "file_abc123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "fileId": "file_abc123",
    "fileName": "example.com_1699999999.html",
    "html": "<html>...</html>",
    "fileSizeBytes": 12345,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 4.2 Chat Operations (3 commands)

#### `chat.prepare` - Prepare Chat Session

**Payload:**

```json
{
  "model": "gemini"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sessionId": "session_abc123",
    "status": "ready"
  }
}
```

---

#### `chat.message` - Send to Gemini

**Payload:**

```json
{
  "prompt": "Hello, how can you help me?",
  "sessionId": "session_abc123",
  "options": {
    "temperature": 0.7,
    "maxTokens": 1000,
    "stream": false
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "reply": "I'm here to help you with...",
    "sessionId": "session_abc123",
    "model": "gemini-pro"
  }
}
```

---

#### `chat.message_gpt` - Send to ChatGPT

**Payload:**

```json
{
  "prompt": "Explain quantum computing",
  "sessionId": "session_gpt_abc",
  "options": {
    "model": "gpt-3.5-turbo",
    "temperature": 0.5,
    "maxTokens": 500
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "reply": "Quantum computing is...",
    "sessionId": "session_gpt_abc",
    "model": "gpt-3.5-turbo"
  }
}
```

---

### 4.3 IAAPA Operations (3 commands)

#### `iaapa.run_all` - Run All IAAPA Jobs

**Payload:**

```json
{
  "batchSize": 5,
  "maxRetries": 3
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobsRun": 10,
    "jobsSucceeded": 9,
    "jobsFailed": 1
  }
}
```

---

#### `iaapa.status` - Get IAAPA Status

**Payload:**

```json
{
  "jobId": "iaapa_job_123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "iaapa_job_123",
    "status": "completed",
    "progress": 100,
    "results": [...]
  }
}
```

---

#### `iaapa.download_csv` - Download CSV

**Payload:**

```json
{
  "jobId": "iaapa_job_123"
}
```

**Response:**

- Content-Type: `text/csv`
- CSV file download

---

### 4.4 Internal Operations (5 commands)

#### `internal.ping` - Laravel Ping

**Headers:** Requires `X-Signature` and `X-Timestamp`

**Payload:**

```json
{
  "timestamp": 1707595200
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "pong": true,
    "timestamp": 1707595201
  }
}
```

---

#### `internal.request_work` - Request Tasks

**Headers:** Requires `X-Signature` and `X-Timestamp`

**Payload:**

```json
{
  "maxTasks": 10
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task_001",
        "type": "scrape",
        "url": "https://example.com/page1"
      }
    ],
    "count": 1
  }
}
```

---

#### `internal.submit_result` - Submit Task Result

**Headers:** Requires `X-Signature`, `X-Timestamp`, and `X-HIPAA-Token`

**Payload:**

```json
{
  "taskId": "task_001",
  "success": true,
  "result": { "data": "..." },
  "executedAt": "2024-02-10T12:00:00Z",
  "durationMs": 1500
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "acknowledged": true
  }
}
```

---

#### `internal.queue_stats` - Get Queue Stats

**Headers:** Requires `X-Signature`, `X-Timestamp`, and `X-HIPAA-Token`

**Payload:**

```json
{
  "includeWorkers": true
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "pending": 50,
    "processing": 5,
    "completed": 1000,
    "failed": 10,
    "workers": [...]
  }
}
```

---

#### `internal.queue_enqueue` - Enqueue Tasks

**Headers:** Requires `X-Signature` and `X-Timestamp`

**Payload:**

```json
{
  "tasks": [
    {
      "id": "task_001",
      "type": "scrape",
      "url": "https://example.com/page1",
      "payload": { "vendor": "amazon" }
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "enqueued": 1,
    "taskIds": ["task_001"]
  }
}
```

---

### 4.5 Job Operations (1 command)

#### `job.create` - Create Scraping Job

**Payload:**

```json
{
  "jobId": "job_custom_123",
  "target": {
    "url": "https://example.com/products",
    "metadata": { "category": "electronics" },
    "lead": { "company": "Acme Corp" }
  },
  "parser": {
    "slug": "product-parser",
    "mode": "batch",
    "definition": {
      "fields": ["title", "price", "description", "images"]
    }
  },
  "callbackUrl": "https://api.example.com/jobs/callback"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "job_custom_123",
    "status": "queued",
    "createdAt": "2024-02-10T12:00:00.000Z"
  }
}
```

---

### 4.6 Page Operations (3 commands)

#### `page.list` - List Pages

**Payload:** `{}`

**Response:**

```json
{
  "success": true,
  "data": {
    "pages": [
      {
        "id": "page_abc123",
        "type": "scraper",
        "url": "https://example.com",
        "status": "active",
        "createdAt": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

---

#### `page.request` - Request Page

**Payload:**

```json
{
  "type": "browser",
  "url": "https://example.com"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "pageId": "page_abc123",
    "status": "ready"
  }
}
```

---

#### `page.close` - Close Page

**Payload:**

```json
{
  "pageId": "page_abc123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "closed": true
  }
}
```

---

### 4.7 Cron Operations (2 commands)

#### `cron.cleanup_pages` - Cleanup Pages

**Payload:**

```json
{
  "maxAgeMs": 3600000,
  "maxPages": 3
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalPages": 5,
    "closedPages": 2,
    "finalPageCount": 3
  }
}
```

---

#### `cron.stats` - Get Statistics

**Payload:** `{}`

**Response:**

```json
{
  "success": true,
  "data": {
    "totalBrowserPages": 3,
    "activePagesInDB": 3,
    "pages": [...]
  }
}
```

---

### 4.8 Cleanup Operations (2 commands)

#### `cleanup.execute` - Execute Cleanup

**Payload:**

```json
{
  "maxAge": 24,
  "storageType": "local"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "deleted": 15,
    "freedBytes": 10485760,
    "storageType": "local"
  }
}
```

---

#### `cleanup.stats` - Get Statistics

**Payload:** `{}`

**Response:**

```json
{
  "success": true,
  "data": {
    "totalFiles": 150,
    "totalSizeBytes": 52428800,
    "oldestFileAgeHours": 72,
    "storageType": "local"
  }
}
```

---

### 4.9 Error Operations (1 command)

#### `error.report` - Report Error

**Payload:**

```json
{
  "type": "SCRAPE_FAILED",
  "message": "Failed to scrape page",
  "stack": "Error stack trace...",
  "route": "/gateway",
  "input": {
    "url": "https://example.com",
    "vendor": "test"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "logged_and_forwarded"
  }
}
```

---

## 5. Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERR_VALIDATION",
    "message": "Invalid command payload",
    "details": [
      {
        "field": "payload.url",
        "message": "Invalid URL format"
      }
    ],
    "correlationId": "corr_1707595200000_abc123",
    "timestamp": "2024-02-10T12:00:00.000Z"
  }
}
```

### Error Codes

| Code                      | HTTP Status | Description                     |
| ------------------------- | ----------- | ------------------------------- |
| `ERR_VALIDATION`          | 400         | Invalid request payload         |
| `ERR_INVALID_PAYLOAD`     | 400         | Malformed payload               |
| `ERR_MISSING_FIELD`       | 400         | Required field missing          |
| `ERR_AUTH`                | 401         | Authentication failed           |
| `ERR_API_KEY_INVALID`     | 401         | Invalid or missing API key      |
| `ERR_SIGNATURE_INVALID`   | 401         | Invalid HMAC signature          |
| `ERR_TOKEN_EXPIRED`       | 401         | Token expired                   |
| `ERR_FORBIDDEN`           | 403         | Access denied                   |
| `ERR_HIPAA`               | 403         | HIPAA compliance required       |
| `ERR_NOT_FOUND`           | 404         | Resource not found              |
| `ERR_COMMAND_NOT_FOUND`   | 400         | Unknown command type            |
| `ERR_RATE_LIMIT`          | 429         | Too many requests               |
| `ERR_INTERNAL`            | 500         | Server error                    |
| `ERR_COMMAND_EXECUTION`   | 500         | Command failed                  |
| `ERR_SERVICE_UNAVAILABLE` | 503         | Service temporarily unavailable |
| `ERR_TIMEOUT`             | 408         | Operation timed out             |

---

## 6. Rate Limiting

### Default Limits

| Category | Requests | Window   |
| -------- | -------- | -------- |
| Global   | 100      | 1 minute |
| Browser  | 60       | 1 minute |
| Chat     | 30       | 1 minute |
| Job      | 20       | 1 minute |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1707595260
```

### Exceeded Rate Limit

```json
{
  "success": false,
  "error": {
    "code": "ERR_RATE_LIMIT",
    "message": "Too many requests, please try again later"
  }
}
```

---

## 7. HIPAA Compliance

### Protected Commands

The following commands require HIPAA compliance token:

- `internal.submit_result`
- `internal.queue_stats`

### Required Headers

```
X-HIPAA-Token: your-hipaa-token
```

### PHI Access Logging

All PHI (Protected Health Information) access is automatically logged with:

- Command type
- Timestamp
- IP address
- User agent

---

## 8. Migration Guide

### From Legacy Routes

#### Before (Legacy Routes)

```bash
# Multiple endpoints
curl http://localhost:5000/browser/visit?url=https://example.com
curl http://localhost:5000/chat/message -d '{"prompt": "Hello"}'
curl http://localhost:5000/jobs -d '{...}'
```

#### After (API Gateway)

```bash
# Single endpoint
curl http://localhost:5000/v1/gateway \
  -H "X-API-Key: your-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com"}}'

curl http://localhost:5000/v1/gateway \
  -H "X-API-Key: your-key" \
  -d '{"type": "chat.message", "payload": {"prompt": "Hello"}}'

curl http://localhost:5000/v1/gateway \
  -H "X-API-Key: your-key" \
  -d '{"type": "job.create", "payload": {...}}'
```

### Migration Timeline

| Phase   | Timeline | Description                               |
| ------- | -------- | ----------------------------------------- |
| Phase 1 | Week 1-2 | Dual support - both old and new endpoints |
| Phase 2 | Week 3-4 | Traffic shift - 10% via gateway           |
| Phase 3 | Week 5-6 | Full migration - all via gateway          |
| Phase 4 | Week 7+  | Legacy routes deprecated                  |

---

## 9. Versioning

### API Versions

| Version | Status  | Description         |
| ------- | ------- | ------------------- |
| `v1`    | Current | Initial release     |
| `v2`    | Planned | Future enhancements |

### Version Header

```bash
curl http://localhost:5000/v1/gateway \
  -H "X-API-Version: v1" \
  -d '{"type": "...", "payload": {...}}'
```

### Version Deprecation

When a version is deprecated:

- `X-Deprecation-Warning: true` header is added
- `X-Deprecation-Message: "Use v2 instead"` header provides guidance
- Legacy version continues to work for 90 days

---

## Support

- **Documentation**: See `docs/API_GATEWAY_QUICK_REF.md` for quick examples
- **OpenAPI Spec**: See `docs/api-gateway-openapi.yaml`
- **Postman Collection**: See `docs/LocalBrowser_API_Gateway.postman_collection.json`
