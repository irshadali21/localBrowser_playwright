# Unified API Gateway Documentation Guide

Complete reference guide for the LocalBrowser Unified API Gateway.

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Endpoint Structure and Base URL](#2-endpoint-structure-and-base-url)
3. [Request Format and Protocol](#3-request-format-and-protocol)
4. [Available Commands and Capabilities](#4-available-commands-and-capabilities)
5. [Authentication and Security](#5-authentication-and-security)
6. [Request Validation](#6-request-validation)
7. [Rate Limiting and Quotas](#7-rate-limiting-and-quotas)
8. [HIPAA Compliance Features](#8-hipaa-compliance-features)
9. [Logging and Monitoring](#9-logging-and-monitoring)
10. [Error Handling](#10-error-handling)
11. [Response Format](#11-response-format)
12. [Code Examples](#12-code-examples)
13. [Integration Steps](#13-integration-steps)
14. [Testing and Development](#14-testing-and-development)

---

## 1. System Overview

### What is the Unified API Gateway?

The Unified API Gateway is a centralized entry point for all browser automation, web scraping, chat operations, job processing, and internal services. Instead of managing multiple endpoints, all operations are routed through a single, unified command-based interface.

### Problems It Solves

Before the Unified API Gateway, clients had to:

- **Manage multiple endpoints**: Each service had its own route (e.g., `/api/browser/visit`, `/api/chat/message`, `/api/job/create`)
- **Handle different authentication methods**: Various auth schemes across endpoints
- **Track multiple rate limits**: Different limits per endpoint
- **Parse varied response formats**: Inconsistent response structures
- **Implement complex error handling**: Different error codes and formats

The Unified API Gateway solves these challenges by providing:

- **Single endpoint**: One URL handles all commands
- **Consistent interface**: Uniform request/response format across all operations
- **Centralized security**: Authentication, authorization, and compliance in one place
- **Unified monitoring**: Single correlation ID tracks requests across all services
- **Extensible architecture**: Easy to add new commands without changing the API surface

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Application                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Unified API Gateway                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Auth        │  │ Validation  │  │ Rate Limit  │              │
│  │ Middleware  │  │ Middleware  │  │ Middleware  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ HIPAA       │  │ Logging     │  │ Correlation │              │
│  │ Compliance  │  │ Middleware  │  │ Tracking    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Command Registry                             │
│            Routes commands to appropriate handlers              │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Browser Handler │ │ Chat Handler    │ │ Job Handler     │
│ (Playwright)    │ │ (AI Models)     │ │ (Queue)         │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Response Formatter                          │
│              Standardizes responses for all commands             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Client                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

| Feature                 | Description                                       |
| ----------------------- | ------------------------------------------------- |
| **Single Endpoint**     | `POST /api/v1/gateway` handles all commands       |
| **50+ Commands**        | Across 10 functional categories                   |
| **Type-Safe**           | All payloads validated against Zod schemas        |
| **Extensible**          | Easy to add new command types                     |
| **Production Ready**    | Rate limiting, caching, metrics, OpenAPI docs     |
| **Backward Compatible** | Legacy routes continue to work during migration   |
| **HIPAA Compliant**     | PHI detection, audit logging, data classification |

---

## 2. Endpoint Structure and Base URL

### Base URL

| Environment | Base URL                         |
| ----------- | -------------------------------- |
| Production  | `https://api.localbrowser.io/v1` |
| Development | `http://localhost:5000/v1`       |

### Main Gateway Endpoint

**POST** `/api/v1/gateway`

The primary endpoint for executing all gateway commands.

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com"}}'
```

### Supporting Endpoints

#### List Available Commands

**GET** `/api/v1/gateway/commands`

Returns a list of all available commands with their metadata, rate limits, and descriptions.

```bash
curl https://api.localbrowser.io/v1/gateway/commands \
  -H "X-API-Key: your-api-key"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "commands": [...],
    "stats": {
      "browser": 5,
      "chat": 4,
      "iaapa": 4,
      "internal": 4,
      "job": 4,
      "page": 4,
      "cron": 4,
      "cleanup": 4,
      "error": 4,
      "storage": 6
    },
    "totalCommands": 50
  }
}
```

#### Health Check

**GET** `/api/v1/gateway/health`

Check if the gateway service is healthy and operational.

```bash
curl https://api.localbrowser.io/v1/gateway/health
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-02-10T12:00:00.000Z",
    "gateway": {
      "version": "v1",
      "totalCommands": 50,
      "categories": {
        "browser": 5,
        "chat": 4,
        "iaapa": 4,
        "internal": 4,
        "job": 4,
        "page": 4,
        "cron": 4,
        "cleanup": 4,
        "error": 4,
        "storage": 6
      }
    }
  }
}
```

#### Get Metrics

**GET** `/api/v1/gateway/metrics`

Retrieve service metrics including command statistics and resource usage.

```bash
curl https://api.localbrowser.io/v1/gateway/metrics \
  -H "X-API-Key: your-api-key"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "timestamp": "2024-02-10T12:00:00.000Z",
    "commands": {
      "total": 50,
      "byCategory": {
        "browser": 5,
        "chat": 4,
        "iaapa": 4,
        "internal": 4,
        "job": 4,
        "page": 4,
        "cron": 4,
        "cleanup": 4,
        "error": 4,
        "storage": 6
      }
    },
    "browser": {...},
    "chat": {...},
    "internal": {...}
  }
}
```

---

## 3. Request Format and Protocol

### HTTP Method Requirements

| Endpoint                   | Method | Description             |
| -------------------------- | ------ | ----------------------- |
| `/api/v1/gateway`          | POST   | Execute a command       |
| `/api/v1/gateway/commands` | GET    | List available commands |
| `/api/v1/gateway/health`   | GET    | Health check            |
| `/api/v1/gateway/metrics`  | GET    | Get metrics             |

### URL Structure

```
POST https://api.localbrowser.io/v1/gateway
```

Query parameters are supported for simple commands:

```
GET https://api.localbrowser.io/v1/gateway?command=browser.visit&url=https://example.com
```

### Header Requirements

| Header              | Required           | Description                      |
| ------------------- | ------------------ | -------------------------------- |
| `Content-Type`      | Yes (for POST)     | Must be `application/json`       |
| `X-API-Key`         | Yes                | Your API key for authentication  |
| `X-Correlation-ID`  | No                 | Client-provided correlation ID   |
| `X-Signature`       | No (Internal only) | HMAC-SHA256 signature            |
| `X-Timestamp`       | No (Internal only) | Unix timestamp for HMAC          |
| `X-HIPAA-Token`     | No (HIPAA only)    | HIPAA compliance token           |
| `X-HIPAA-Compliant` | No                 | Set to `true` for HIPAA requests |

### Request Body Schema

The gateway accepts JSON requests with the following structure:

```json
{
  "commandId": "cmd_1707595200000_abc123",
  "type": "browser.visit",
  "version": "v1",
  "payload": {
    "url": "https://example.com",
    "options": {
      "waitUntil": "networkidle",
      "timeout": 30000,
      "returnHtml": true
    }
  },
  "metadata": {
    "requestId": "req_1707595200000",
    "clientTimestamp": "2024-02-10T12:00:00.000Z",
    "callbackUrl": "https://your-callback.com/webhook",
    "priority": 5
  }
}
```

#### Request Fields

| Field       | Type   | Required | Description                                          |
| ----------- | ------ | -------- | ---------------------------------------------------- |
| `commandId` | string | No       | Unique command ID (auto-generated if not provided)   |
| `type`      | string | Yes      | Command type (e.g., `browser.visit`, `chat.message`) |
| `version`   | string | No       | API version (default: `v1`)                          |
| `payload`   | object | Yes      | Command-specific payload                             |
| `metadata`  | object | No       | Optional request metadata                            |

#### Metadata Fields

| Field             | Type   | Description                                |
| ----------------- | ------ | ------------------------------------------ |
| `requestId`       | string | Client-provided request ID for idempotency |
| `clientTimestamp` | string | Client timestamp                           |
| `callbackUrl`     | string | Webhook URL for async responses            |
| `priority`        | number | Priority level (1-10, default: 5)          |

---

## 4. Available Commands and Capabilities

### 4.1 Browser Automation Commands

Browser automation commands for web navigation, scraping, and interaction.

| Command                                    | Description          | Payload                 |
| ------------------------------------------ | -------------------- | ----------------------- |
| [`browser.visit`](#browservisit)           | Navigate to a URL    | `{url, options}`        |
| [`browser.execute`](#browserexecute)       | Execute JavaScript   | `{code, timeout}`       |
| [`browser.screenshot`](#browserscreenshot) | Take a screenshot    | `{selector, options}`   |
| [`browser.navigate`](#browsernavigate)     | Navigate within page | `{url, action}`         |
| [`browser.evaluate`](#browserevaluate)     | Evaluate expression  | `{expression, timeout}` |

#### `browser.visit`

Navigate to a URL and optionally capture page content.

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

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `waitUntil` | string | "networkidle" | When to consider navigation complete |
| `timeout` | number | 60000 | Timeout in milliseconds |
| `returnHtml` | boolean | false | Return HTML content |
| `saveToFile` | boolean | false | Save HTML to storage |
| `handleCloudflare` | boolean | false | Handle Cloudflare protection |
| `useProgressiveRetry` | boolean | false | Use progressive retry strategy |

**Response:**

```json
{
  "success": true,
  "data": {
    "fileId": "file_abc123",
    "url": "https://example.com",
    "html": "<html>...</html>",
    "title": "Example Domain"
  },
  "metadata": {
    "processingTimeMs": 1500,
    "timestamp": "2024-02-10T12:00:01.500Z",
    "commandId": "browser.visit"
  }
}
```

#### `browser.execute`

Execute JavaScript code in the browser context.

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

#### `browser.screenshot`

Capture a screenshot of the current page or a specific element.

**Payload:**

```json
{
  "selector": "#main-content",
  "options": {
    "fullPage": false,
    "format": "png",
    "quality": 85
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "imageId": "img_abc123",
    "format": "png",
    "sizeBytes": 45678
  }
}
```

#### `browser.navigate`

Navigate to a URL within an existing page context.

**Payload:**

```json
{
  "url": "https://example.com/page2",
  "action": "goto"
}
```

#### `browser.evaluate`

Evaluate a JavaScript expression and return the result.

**Payload:**

```json
{
  "expression": "document.querySelectorAll('.product').length",
  "timeout": 10000
}
```

---

### 4.2 Chat Commands

AI chat operations for Gemini and other chat models.

| Command                                  | Description        | Payload                        |
| ---------------------------------------- | ------------------ | ------------------------------ |
| [`chat.message`](#chatmessage)           | Send message to AI | `{prompt, sessionId, options}` |
| [`chat.conversation`](#chatconversation) | Get conversation   | `{sessionId, options}`         |
| [`chats.history`](#chathistory)          | Get chat history   | `{sessionId, options}`         |
| [`chat.clear`](#chatclear)               | Clear chat history | `{sessionId, all}`             |

#### `chat.message`

Send a message to the chat assistant.

**Payload:**

```json
{
  "prompt": "Hello, how can you help me?",
  "sessionId": "session_abc123",
  "options": {
    "temperature": 0.7,
    "maxTokens": 1000,
    "stream": false,
    "model": "gemini-pro"
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
    "model": "gemini-pro",
    "usage": {
      "promptTokens": 15,
      "completionTokens": 50
    }
  }
}
```

#### `chat.conversation`

Retrieve a specific conversation by session ID.

**Payload:**

```json
{
  "sessionId": "session_abc123",
  "options": {
    "includeMetadata": true,
    "limit": 50
  }
}
```

#### `chat.history`

Retrieve chat history for a session.

**Payload:**

```json
{
  "sessionId": "session_abc123",
  "options": {
    "limit": 20,
    "offset": 0
  }
}
```

#### `chat.clear`

Clear chat history for a session.

**Payload:**

```json
{
  "sessionId": "session_abc123",
  "all": false
}
```

---

### 4.3 IAAPA Commands

IAAPA expo data operations.

| Command                          | Description       | Payload             |
| -------------------------------- | ----------------- | ------------------- |
| [`iaapa.search`](#iaappasearch)  | Search IAAPA data | `{query, filters}`  |
| [`iaappa.filter`](#iaappafilter) | Filter IAAPA data | `{filters}`         |
| [`iaapa.export`](#iaapaexport)   | Export data       | `{format, filters}` |
| [`iaapa.import`](#iaapaimport)   | Import data       | `{data, options}`   |

#### `iaapa.search`

Search the IAAPA expo database.

**Payload:**

```json
{
  "query": "food",
  "filters": {
    "building": "North",
    "category": "Attraction"
  },
  "options": {
    "limit": 100,
    "offset": 0
  }
}
```

#### `iaapa.filter`

Filter IAAPA expo data by criteria.

**Payload:**

```json
{
  "filters": {
    "building": "South",
    "category": "Food & Beverage"
  }
}
```

#### `iaapa.export`

Export IAAPA data to various formats.

**Payload:**

```json
{
  "format": "csv",
  "filters": {
    "building": "North"
  },
  "options": {
    "includeHeaders": true
  }
}
```

#### `iaapa.import`

Import external data into the IAAPA database.

**Payload:**

```json
{
  "data": [...],
  "options": {
    "updateExisting": true
  }
}
```

---

### 4.4 Internal Commands

Internal Laravel backend communication commands.

| Command                                | Description       | Payload              |
| -------------------------------------- | ----------------- | -------------------- |
| [`internal.health`](#internalhealth)   | Health check      | `{}`                 |
| [`internal.metrics`](#internalmetrics) | Get metrics       | `{}`                 |
| [`internal.config`](#internalconfig)   | Get config        | `{keys}`             |
| [`internal.worker`](#internalworker)   | Worker management | `{action, workerId}` |

#### `internal.health`

Check the health status of services.

**Payload:** `{}`

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "database": "connected",
      "cache": "connected",
      "queue": "running"
    }
  }
}
```

#### `internal.metrics`

Retrieve system metrics.

**Payload:** `{}`

**Response:**

```json
{
  "success": true,
  "data": {
    "memory": {
      "heapUsed": "256MB",
      "heapTotal": "512MB",
      "rss": "1024MB"
    },
    "cpu": 45.5,
    "uptime": 86400
  }
}
```

#### `internal.config`

Retrieve configuration values.

**Payload:**

```json
{
  "keys": ["maxRetries", "timeout"]
}
```

#### `internal.worker`

Manage worker processes.

**Payload:**

```json
{
  "action": "restart",
  "workerId": "worker_001"
}
```

---

### 4.5 Job Commands

Job creation and management commands.

| Command                    | Description    | Payload            |
| -------------------------- | -------------- | ------------------ |
| [`job.create`](#jobcreate) | Create job     | `{target, parser}` |
| [`job.status`](#jobstatus) | Get job status | `{jobId}`          |
| [`job.cancel`](#jobcancel) | Cancel job     | `{jobId}`          |
| [`job.list`](#joblist)     | List jobs      | `{filters}`        |
| [`job.retry`](#jobretry)   | Retry job      | `{jobId}`          |

#### `job.create`

Create a new scraping job.

**Payload:**

```json
{
  "jobId": "job_custom_123",
  "target": {
    "url": "https://example.com/products",
    "metadata": {
      "category": "electronics"
    },
    "lead": {
      "name": "John Doe"
    }
  },
  "parser": {
    "slug": "product-parser",
    "mode": "batch",
    "definition": {
      "fields": {
        "title": ".product-title",
        "price": ".price"
      }
    }
  },
  "callbackUrl": "https://your-callback.com/webhook",
  "priority": 5
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "job_custom_123",
    "status": "created",
    "createdAt": "2024-02-10T12:00:00.000Z"
  }
}
```

#### `job.status`

Retrieve the status of a job.

**Payload:**

```json
{
  "jobId": "job_abc123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "status": "completed",
    "progress": 100,
    "results": [...],
    "startedAt": "2024-02-10T12:00:01.000Z",
    "completedAt": "2024-02-10T12:05:00.000Z"
  }
}
```

#### `job.cancel`

Cancel a running or pending job.

**Payload:**

```json
{
  "jobId": "job_abc123"
}
```

#### `job.list`

List all jobs with optional filtering.

**Payload:**

```json
{
  "filters": {
    "status": "running",
    "parser": "product-parser"
  },
  "options": {
    "limit": 20,
    "offset": 0
  }
}
```

#### `job.retry`

Retry a failed job.

**Payload:**

```json
{
  "jobId": "job_abc123"
}
```

---

### 4.6 Page Commands

Page session management commands.

| Command                      | Description | Payload             |
| ---------------------------- | ----------- | ------------------- |
| [`page.create`](#pagecreate) | Create page | `{type, options}`   |
| [`page.read`](#pageread)     | Read page   | `{pageId}`          |
| [`page.update`](#pageupdate) | Update page | `{pageId, updates}` |
| [`page.delete`](#pagedelete) | Delete page | `{pageId}`          |
| [`page.list`](#pagelist)     | List pages  | `{filters}`         |

#### `page.create`

Create a new page instance.

**Payload:**

```json
{
  "type": "browser",
  "options": {
    "headless": true,
    "viewport": {
      "width": 1920,
      "height": 1080
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "pageId": "page_abc123",
    "status": "created"
  }
}
```

#### `page.read`

Read page content or metadata.

**Payload:**

```json
{
  "pageId": "page_abc123"
}
```

#### `page.update`

Update page content or settings.

**Payload:**

```json
{
  "pageId": "page_abc123",
  "updates": {
    "settings": {
      "javascriptEnabled": false
    }
  }
}
```

#### `page.delete`

Delete a page instance.

**Payload:**

```json
{
  "pageId": "page_abc123"
}
```

#### `page.list`

List all pages.

**Payload:**

```json
{
  "filters": {
    "status": "active"
  }
}
```

---

### 4.7 Cron Commands

Scheduled operations commands.

| Command                                  | Description     | Payload                       |
| ---------------------------------------- | --------------- | ----------------------------- |
| [`cron.schedule`](#cronschedule)         | Schedule job    | `{cronExpression, commandId}` |
| [`cron.unschedule`](#cronunschedule)     | Unschedule job  | `{taskId}`                    |
| [`cron.list`](#cronlist)                 | List scheduled  | `{filters}`                   |
| [`cron.trigger`](#crontrigger)           | Trigger job     | `{taskId, commandId}`         |
| [`cron.cleanupPages`](#croncleanuppages) | Cleanup pages   | `{maxAge}`                    |
| [`cron.pageStats`](#cronpagestats)       | Page statistics | `{}`                          |

#### `cron.schedule`

Schedule a command to run on a cron pattern.

**Payload:**

```json
{
  "cronExpression": "0 */6 * * *",
  "commandId": "browser.visit",
  "payload": {
    "url": "https://example.com"
  },
  "options": {
    "enabled": true,
    "timezone": "UTC",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "taskId": "cron_abc123",
    "status": "scheduled"
  }
}
```

#### `cron.unschedule`

Remove a scheduled cron job.

**Payload:**

```json
{
  "taskId": "cron_abc123"
}
```

#### `cron.list`

List all scheduled cron jobs.

**Payload:**

```json
{
  "filters": {
    "enabled": true
  },
  "options": {
    "limit": 50,
    "offset": 0
  }
}
```

#### `cron.trigger`

Manually trigger a scheduled cron job.

**Payload:**

```json
{
  "taskId": "cron_abc123",
  "payload": {
    "url": "https://example.com"
  }
}
```

#### `cron.cleanupPages`

Clean up old page sessions.

**Payload:**

```json
{
  "maxAge": 24
}
```

#### `cron.pageStats`

Get page session statistics.

**Payload:** `{}`

---

### 4.8 Cleanup Commands

Storage cleanup operations.

| Command                                | Description      | Payload             |
| -------------------------------------- | ---------------- | ------------------- |
| [`cleanup.logs`](#cleanuplogs)         | Cleanup logs     | `{maxAge, force}`   |
| [`cleanup.cache`](#cleanupcache)       | Cleanup cache    | `{pattern, maxAge}` |
| [`cleanup.temp`](#cleanuptemp)         | Cleanup temp     | `{pattern, maxAge}` |
| [`cleanup.sessions`](#cleanupsessions) | Cleanup sessions | `{maxAge}`          |
| [`cleanup.stats`](#cleanupstats)       | Get stats        | `{}`                |
| [`cleanup.all`](#cleanupall)           | Run all cleanup  | `{maxAge}`          |

#### `cleanup.logs`

Clean up old log files.

**Payload:**

```json
{
  "maxAge": 7,
  "force": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "deleted": 150,
    "freedBytes": 10485760
  }
}
```

#### `cleanup.cache`

Clean up cached files.

**Payload:**

```json
{
  "pattern": "*.cache",
  "maxAge": 24,
  "force": true
}
```

#### `cleanup.temp`

Clean up temporary files.

**Payload:**

```json
{
  "maxAge": 24
}
```

#### `cleanup.sessions`

Clean up expired sessions.

**Payload:**

```json
{
  "maxAge": 24
}
```

#### `cleanup.stats`

Get storage statistics.

**Payload:** `{}`

**Response:**

```json
{
  "success": true,
  "data": {
    "fileCount": 1000,
    "totalSizeBytes": 52428800,
    "storageType": "local"
  }
}
```

#### `cleanup.all`

Run all cleanup operations.

**Payload:**

```json
{
  "maxAge": 24
}
```

---

### 4.9 Error Commands

Error reporting and tracking commands.

| Command                          | Description       | Payload                    |
| -------------------------------- | ----------------- | -------------------------- |
| [`error.report`](#errorreport)   | Report error      | `{type, message, details}` |
| [`error.status`](#errorstatus)   | Get error status  | `{}`                       |
| [`error.history`](#errorhistory) | Get error history | `{filters}`                |
| [`error.resolve`](#errorresolve) | Resolve error     | `{errorId, resolution}`    |

#### `error.report`

Report an error occurrence.

**Payload:**

```json
{
  "type": "SCRAPING_ERROR",
  "message": "Failed to extract price",
  "details": {
    "url": "https://example.com",
    "selector": ".price",
    "attempts": 3
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "errorId": "err_abc123",
    "status": "recorded"
  }
}
```

#### `error.status`

Get current error status and statistics.

**Payload:** `{}`

**Response:**

```json
{
  "success": true,
  "data": {
    "totalErrors": 50,
    "resolvedErrors": 45,
    "openErrors": 5,
    "byType": {...}
  }
}
```

#### `error.history`

Get error history with filtering.

**Payload:**

```json
{
  "filters": {
    "type": "SCRAPING_ERROR",
    "resolved": false
  },
  "options": {
    "limit": 20,
    "offset": 0
  }
}
```

#### `error.resolve`

Mark an error as resolved.

**Payload:**

```json
{
  "errorId": "err_abc123",
  "resolution": "Fixed selector",
  "resolvedBy": "admin"
}
```

---

### 4.10 Storage Commands

File storage operations.

| Command                                    | Description   | Payload           |
| ------------------------------------------ | ------------- | ----------------- |
| [`storage.upload`](#storageupload)         | Upload file   | `{file, path}`    |
| [`storage.download`](#storagedownload)     | Download file | `{fileId}`        |
| [`storage.list`](#storagelist)             | List files    | `{path, filters}` |
| [`storage.delete`](#storagedelete)         | Delete file   | `{fileId}`        |
| [`storage.getUrl`](#storagegeturl)         | Get file URL  | `{fileId}`        |
| [`storage.makePublic`](#storagemakepublic) | Make public   | `{fileId}`        |

#### `storage.upload`

Upload a file to storage.

**Payload:**

```json
{
  "file": "base64_encoded_content",
  "path": "uploads/example.txt",
  "options": {
    "overwrite": true
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "fileId": "file_abc123",
    "url": "https://storage.localbrowser.io/file_abc123"
  }
}
```

#### `storage.download`

Download a file from storage.

**Payload:**

```json
{
  "fileId": "file_abc123"
}
```

#### `storage.list`

List files in storage.

**Payload:**

```json
{
  "path": "uploads",
  "filters": {
    "extension": "txt"
  }
}
```

#### `storage.delete`

Delete a file from storage.

**Payload:**

```json
{
  "fileId": "file_abc123"
}
```

#### `storage.getUrl`

Get a shareable URL for a file.

**Payload:**

```json
{
  "fileId": "file_abc123",
  "options": {
    "expiresIn": 3600
  }
}
```

#### `storage.makePublic`

Make a file publicly accessible.

**Payload:**

```json
{
  "fileId": "file_abc123"
}
```

---

## 5. Authentication and Security

### 5.1 API Key Authentication

For most endpoints, use the `X-API-Key` header:

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com"}}'
```

**Getting an API Key:**

API keys are issued through the LocalBrowser dashboard. Each key can have:

- Scopes: Limit access to specific command categories
- Rate limits: Custom rate limits per key
- Expiration: Optional expiration date

### 5.2 HMAC Signature Authentication (Internal Routes)

For Laravel backend communication, use HMAC-SHA256 signatures:

```bash
TIMESTAMP=$(date +%s)
SIGNATURE=$(echo -n "$TIMESTAMP" | openssl dgst -sha256 -hmac "your-secret" | cut -d' ' -f2)

curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "X-Signature: $SIGNATURE" \
  -H "X-Timestamp: $TIMESTAMP" \
  -d '{"type": "internal.ping", "payload": {}}'
```

**Signature Generation:**

```javascript
const crypto = require('crypto');

function generateSignature(timestamp, secret) {
  return crypto.createHmac('sha256', secret).update(timestamp.toString()).digest('hex');
}
```

**Signature Validation:**

1. Extract `X-Timestamp` from request
2. Check timestamp is within 5 minutes of server time
3. Generate HMAC-SHA256 signature using secret
4. Compare with `X-Signature` header

### 5.3 HIPAA Token

For HIPAA-sensitive operations:

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "X-HIPAA-Token: your-hipaa-token" \
  -H "X-HIPAA-Compliant: true" \
  -d '{"type": "internal.submit_result", "payload": {...}}'
```

### 5.4 Security Best Practices

1. **Keep API Keys Secure**
   - Never commit API keys to version control
   - Use environment variables
   - Rotate keys regularly

2. **Use HTTPS Always**
   - All API requests must use HTTPS
   - Certificate validation is enforced

3. **Validate Payloads**
   - Validate all input on the client side
   - Check required fields and data types

4. **Implement Retry Logic**
   - Use exponential backoff for retries
   - Handle rate limit errors gracefully

5. **Monitor Usage**
   - Track API key usage
   - Set up alerts for unusual patterns

---

## 6. Request Validation

### Validation Middleware

The gateway uses Zod schemas for payload validation. All commands have defined schemas that validate:

- Required fields
- Data types
- String formats (URLs, emails)
- Numeric ranges
- Enum values

### Required vs Optional Fields

| Field       | Type   | Required | Description               |
| ----------- | ------ | -------- | ------------------------- |
| `type`      | string | Yes      | Command type identifier   |
| `payload`   | object | Yes      | Command-specific payload  |
| `commandId` | string | No       | Unique command ID         |
| `version`   | string | No       | API version (default: v1) |

### Common Validation Errors

```json
{
  "success": false,
  "error": {
    "code": "ERR_VALIDATION",
    "message": "Invalid payload",
    "details": {
      "errors": [
        {
          "field": "payload.url",
          "message": "Invalid URL format"
        },
        {
          "field": "payload.timeout",
          "message": "Must be a positive number"
        }
      ]
    },
    "correlationId": "corr_abc123"
  }
}
```

### Validation Best Practices

1. **Validate Early**: Validate payloads before sending to API
2. **Check Required Fields**: Ensure all required fields are present
3. **Verify Data Types**: Confirm field types match expected types
4. **Test URL Formats**: Validate URLs include protocol (http/https)
5. **Check Ranges**: Verify numeric values are within acceptable ranges

---

## 7. Rate Limiting and Quotas

### Global Rate Limit

| Limit        | Window   |
| ------------ | -------- |
| 100 requests | 1 minute |

### Per-Command Rate Limits

| Category     | Command              | Limit (req/min) |
| ------------ | -------------------- | --------------- |
| **Browser**  | `browser.visit`      | 60              |
|              | `browser.execute`    | 30              |
|              | `browser.screenshot` | 30              |
|              | `browser.navigate`   | 60              |
|              | `browser.evaluate`   | 30              |
| **Chat**     | `chat.message`       | 50              |
|              | `chat.conversation`  | 30              |
|              | `chat.history`       | 30              |
|              | `chat.clear`         | 10              |
| **IAAPA**    | `iaapa.search`       | 30              |
|              | `iaapa.filter`       | 30              |
|              | `iaapa.export`       | 10              |
|              | `iaapa.import`       | 10              |
| **Internal** | `internal.health`    | 120             |
|              | `internal.metrics`   | 60              |
|              | `internal.config`    | 20              |
|              | `internal.worker`    | 30              |
| **Job**      | `job.create`         | 30              |
|              | `job.status`         | 60              |
|              | `job.cancel`         | 20              |
|              | `job.list`           | 60              |
| **Page**     | `page.create`        | 30              |
|              | `page.read`          | 60              |
|              | `page.update`        | 30              |
|              | `page.delete`        | 10              |
| **Cron**     | `cron.schedule`      | 20              |
|              | `cron.unschedule`    | 20              |
|              | `cron.list`          | 60              |
|              | `cron.trigger`       | 10              |
| **Cleanup**  | `cleanup.logs`       | 10              |
|              | `cleanup.cache`      | 10              |
|              | `cleanup.temp`       | 10              |
|              | `cleanup.sessions`   | 20              |
| **Error**    | `error.report`       | 30              |
|              | `error.status`       | 60              |
|              | `error.history`      | 30              |
|              | `error.resolve`      | 20              |
| **Storage**  | `storage.upload`     | 20              |
|              | `storage.download`   | 60              |
|              | `storage.list`       | 60              |
|              | `storage.delete`     | 10              |
|              | `storage.getUrl`     | 120             |
|              | `storage.makePublic` | 10              |

### Rate Limit Headers

All responses include rate limit headers:

| Header                  | Description                             |
| ----------------------- | --------------------------------------- |
| `X-RateLimit-Limit`     | Maximum requests allowed                |
| `X-RateLimit-Remaining` | Remaining requests in window            |
| `X-RateLimit-Reset`     | Unix timestamp when limit resets        |
| `Retry-After`           | Seconds until retry (when rate limited) |

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "code": "ERR_RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "details": {
      "limit": 100,
      "windowMs": 60000,
      "retryAfter": 45
    },
    "correlationId": "corr_abc123"
  }
}
```

### Handling Rate Limits

1. **Implement Backoff**

   ```javascript
   async function withRetry(fn, maxRetries = 5) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.code === 'ERR_RATE_LIMIT_EXCEEDED') {
           const waitTime = Math.pow(2, i) * 1000;
           await new Promise(resolve => setTimeout(resolve, waitTime));
         } else {
           throw error;
         }
       }
     }
     throw new Error('Max retries exceeded');
   }
   ```

2. **Monitor Usage**: Track `X-RateLimit-Remaining` header
3. **Batch Requests**: Combine multiple operations where possible
4. **Cache Responses**: Cache GET requests to reduce API calls

---

## 8. HIPAA Compliance Features

### PHI Detection

The gateway automatically detects Protected Health Information (PHI) in request payloads:

**Detected PHI Types:**

- Social Security Numbers (SSN)
- Credit Card Numbers
- Medical Record Numbers
- Dates of Birth
- Health Insurance Information

**Detection Method:**

- Field name analysis (e.g., `patient_id`, `diagnosis`)
- Pattern matching (e.g., SSN: `\d{3}-\d{2}-\d{4}`)

### Audit Logging

All PHI access is logged with:

```json
{
  "auditId": "audit_1707595200000_abc123",
  "timestamp": "2024-02-10T12:00:00.000Z",
  "correlationId": "corr_abc123",
  "commandId": "internal.submit_result",
  "classification": "phi",
  "phiAccessed": true,
  "phiTypes": ["ssn", "date_of_birth"],
  "action": "read",
  "success": true,
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

### HIPAA Headers

| Header                  | Value                        | Description               |
| ----------------------- | ---------------------------- | ------------------------- |
| `X-HIPAA-Compliant`     | `true`                       | Request contains PHI      |
| `X-Data-Classification` | `phi`, `sensitive`, `public` | Data classification level |
| `X-PHI-Detected`        | `true`                       | PHI detected in request   |
| `X-Audit-Required`      | `true`                       | Audit logging required    |

### Data Masking

Sensitive fields are masked in logs:

| Field Type  | Masked As                 |
| ----------- | ------------------------- |
| SSN         | `***-**-1234`             |
| Credit Card | `****-****-****-1234`     |
| Password    | `********`                |
| API Key     | `sk_********************` |

### Retention Periods

| Classification | Retention           |
| -------------- | ------------------- |
| PHI            | 6 years (2190 days) |
| Confidential   | 3 years (1095 days) |
| Sensitive      | 1 year (365 days)   |
| Public         | 90 days             |

---

## 9. Logging and Monitoring

### Correlation ID Usage

The correlation ID (`X-Correlation-ID`) is used to track requests across all services:

1. **Client-Side**: Include `X-Correlation-ID` header for request tracking
2. **Server-Side**: Gateway generates ID if not provided
3. **Response**: Same ID is returned in all related logs

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -H "X-Correlation-ID: corr_12345_abc" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com"}}'
```

### Log Format

```json
{
  "timestamp": "2024-02-10T12:00:00.000Z",
  "level": "INFO",
  "correlationId": "corr_abc123",
  "commandId": "browser.visit",
  "clientId": "apikey:user123",
  "ip": "192.168.1.1",
  "processingTimeMs": 1500,
  "message": "Command executed successfully"
}
```

### Monitoring Endpoints

#### Health Check

```bash
GET /api/v1/gateway/health
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-02-10T12:00:00.000Z",
    "gateway": {
      "version": "v1",
      "totalCommands": 50,
      "categories": {...}
    }
  }
}
```

#### Metrics

```bash
GET /api/v1/gateway/metrics
```

**Response:**

```json
{
  "success": true,
  "data": {
    "timestamp": "2024-02-10T12:00:00.000Z",
    "commands": {
      "total": 50,
      "byCategory": {...}
    },
    "browser": {...},
    "chat": {...}
  }
}
```

### Debugging Tips

1. **Enable Verbose Logging**: Set `DEBUG=gateway:*` environment variable
2. **Check Correlation ID**: Use correlation ID to trace requests in logs
3. **Monitor Rate Limits**: Check `X-RateLimit-*` headers
4. **Validate Payloads**: Test payloads before production use

---

## 10. Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERR_VALIDATION",
    "message": "Invalid payload",
    "details": {
      "errors": [...]
    },
    "correlationId": "corr_abc123",
    "suggestions": ["browser.visit", "browser.execute"]
  },
  "metadata": {
    "processingTimeMs": 50,
    "timestamp": "2024-02-10T12:00:00.000Z",
    "version": "v1"
  }
}
```

### Error Codes Table

| Code                              | HTTP Status | Description                          |
| --------------------------------- | ----------- | ------------------------------------ |
| `ERR_MISSING_API_KEY`             | 401         | API key is missing                   |
| `ERR_INVALID_API_KEY`             | 401         | API key is invalid                   |
| `ERR_API_KEY_INACTIVE`            | 403         | API key is inactive                  |
| `ERR_API_KEY_EXPIRED`             | 403         | API key has expired                  |
| `ERR_INSUFFICIENT_SCOPES`         | 403         | Insufficient API key scopes          |
| `ERR_MISSING_HMAC_SIGNATURE`      | 401         | HMAC signature is missing            |
| `ERR_INVALID_HMAC_SIGNATURE`      | 401         | HMAC signature is invalid            |
| `ERR_HMAC_TIMESTAMP_EXPIRED`      | 401         | HMAC timestamp is expired            |
| `ERR_INVALID_REQUEST_STRUCTURE`   | 400         | Invalid request structure            |
| `ERR_MISSING_COMMAND_ID`          | 400         | Command ID is missing                |
| `ERR_INVALID_PAYLOAD`             | 400         | Invalid payload                      |
| `ERR_UNKNOWN_COMMAND`             | 400         | Unknown command type                 |
| `ERR_RATE_LIMIT_EXCEEDED`         | 429         | Global rate limit exceeded           |
| `ERR_COMMAND_RATE_LIMIT_EXCEEDED` | 429         | Command-specific rate limit exceeded |
| `ERR_COMMAND_NOT_FOUND`           | 404         | Command not found                    |
| `ERR_HANDLER_NOT_FOUND`           | 500         | Handler not found                    |
| `ERR_HANDLER_EXECUTION_FAILED`    | 500         | Handler execution failed             |
| `ERR_TIMEOUT`                     | 504         | Request timeout                      |
| `ERR_INTERNAL`                    | 500         | Internal server error                |
| `ERR_SERVICE_UNAVAILABLE`         | 503         | Service unavailable                  |

### Troubleshooting Guide

| Issue                 | Solution                                      |
| --------------------- | --------------------------------------------- |
| 400 Bad Request       | Check request body format and required fields |
| 401 Unauthorized      | Verify API key or HMAC signature              |
| 403 Forbidden         | Check API key scopes and HIPAA token          |
| 404 Not Found         | Verify command type is correct                |
| 429 Too Many Requests | Implement exponential backoff                 |
| 500 Internal Error    | Check server logs with correlation ID         |

### Common Error Solutions

#### Authentication Errors

```json
// Missing API Key
{ "error": { "code": "ERR_MISSING_API_KEY", "message": "API key is required" } }
// Solution: Add X-API-Key header
```

#### Validation Errors

```json
// Invalid Payload
{ "error": { "code": "ERR_INVALID_PAYLOAD", "message": "Invalid URL format" } }
// Solution: Ensure URL includes http:// or https://
```

#### Rate Limit Errors

```json
// Rate Limited
{ "error": { "code": "ERR_RATE_LIMIT_EXCEEDED", "retryAfter": 60 } }
// Solution: Wait before retrying with exponential backoff
```

#### Unknown Command

```json
// Unknown Command
{ "error": { "code": "ERR_UNKNOWN_COMMAND", "suggestions": ["browser.visit"] } }
// Solution: Use suggested command or check spelling
```

---

## 11. Response Format

### Success Response Structure

```json
{
  "success": true,
  "data": {
    "result": {...}
  },
  "metadata": {
    "commandId": "browser.visit",
    "processingTimeMs": 1500,
    "timestamp": "2024-02-10T12:00:01.500Z",
    "version": "v1"
  }
}
```

### Error Response Structure

```json
{
  "success": false,
  "error": {
    "code": "ERR_VALIDATION",
    "message": "Invalid payload",
    "details": {
      "errors": [...]
    },
    "correlationId": "corr_abc123",
    "suggestions": ["browser.visit"]
  },
  "metadata": {
    "processingTimeMs": 50,
    "timestamp": "2024-02-10T12:00:00.500Z",
    "version": "v1"
  }
}
```

### Response Headers

| Header                  | Description                 |
| ----------------------- | --------------------------- |
| `Content-Type`          | Always `application/json`   |
| `X-Correlation-ID`      | Correlation ID for tracking |
| `X-RateLimit-Limit`     | Rate limit maximum          |
| `X-RateLimit-Remaining` | Remaining requests          |
| `X-RateLimit-Reset`     | Rate limit reset timestamp  |
| `X-HIPAA-Compliance`    | HIPAA compliance status     |

### Pagination for List Endpoints

List endpoints support pagination:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "total": 100,
      "limit": 20,
      "offset": 40,
      "hasMore": true
    }
  },
  "metadata": {
    "commandId": "job.list"
  }
}
```

**Pagination Parameters:**

- `limit`: Number of items per page (default: 20, max: 100)
- `offset`: Number of items to skip

---

## 12. Code Examples

### 12.1 cURL Examples

#### Basic Request

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com"}}'
```

#### With Correlation ID

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "X-Correlation-ID: corr_12345_abc" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com"}}'
```

#### With HMAC Signature

```bash
TIMESTAMP=$(date +%s)
SIGNATURE=$(echo -n "$TIMESTAMP" | openssl dgst -sha256 -hmac "your-secret" | cut -d' ' -f2)

curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "X-Signature: $SIGNATURE" \
  -H "X-Timestamp: $TIMESTAMP" \
  -d '{"type": "internal.ping", "payload": {}}'
```

### 12.2 JavaScript/Node.js Examples

#### Basic Client

```javascript
const fetch = require('node-fetch');

class LocalBrowserClient {
  constructor(apiKey, baseUrl = 'https://api.localbrowser.io/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async execute(commandType, payload, options = {}) {
    const commandId = options.commandId || `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const response = await fetch(`${this.baseUrl}/gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Correlation-ID': options.correlationId || commandId,
        'X-HIPAA-Compliant': options.hipaaCompliant ? 'true' : 'false',
      },
      body: JSON.stringify({
        commandId,
        type: commandType,
        version: 'v1',
        payload,
        metadata: options.metadata,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Command failed: ${result.error.message}`);
    }

    return result;
  }

  // Convenience methods
  async visit(url, options = {}) {
    return this.execute('browser.visit', { url, options }, options);
  }

  async executeScript(code, timeout = 30000) {
    return this.execute('browser.execute', { code, timeout });
  }

  async sendChatMessage(prompt, sessionId, options = {}) {
    return this.execute('chat.message', { prompt, sessionId, options }, options);
  }

  async createJob(target, parser, options = {}) {
    return this.execute('job.create', { target, parser }, options);
  }

  async getJobStatus(jobId) {
    return this.execute('job.status', { jobId });
  }

  async healthCheck() {
    const response = await fetch(`${this.baseUrl}/gateway/health`);
    return response.json();
  }
}

// Usage
const client = new LocalBrowserClient('your-api-key');

(async () => {
  try {
    const result = await client.visit('https://example.com', {
      options: { returnHtml: true },
    });
    console.log('Page title:', result.data.title);
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
```

#### With HMAC Authentication

```javascript
const crypto = require('crypto');
const fetch = require('node-fetch');

class InternalClient {
  constructor(apiKey, secret, baseUrl = 'https://api.localbrowser.io/v1') {
    this.apiKey = apiKey;
    this.secret = secret;
    this.baseUrl = baseUrl;
  }

  async execute(commandType, payload) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto.createHmac('sha256', this.secret).update(timestamp.toString()).digest('hex');

    const response = await fetch(`${this.baseUrl}/gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Signature': signature,
        'X-Timestamp': timestamp.toString(),
      },
      body: JSON.stringify({
        type: commandType,
        version: 'v1',
        payload,
      }),
    });

    return response.json();
  }

  async ping() {
    return this.execute('internal.ping', {});
  }

  async submitResult(taskId, success, result) {
    return this.execute('internal.submit_result', { taskId, success, result });
  }
}

// Usage
const client = new InternalClient('your-api-key', 'your-secret');
await client.ping();
```

### 12.3 Python Examples

#### Basic Client

```python
import requests
import uuid
import time

class LocalBrowserClient:
    def __init__(self, api_key, base_url="https://api.localbrowser.io/v1"):
        self.api_key = api_key
        self.base_url = base_url

    def execute(self, command_type, payload, correlation_id=None):
        command_id = f"cmd_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"

        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
            "X-Correlation-ID": correlation_id or command_id,
        }

        response = requests.post(
            f"{self.base_url}/gateway",
            json={
                "commandId": command_id,
                "type": command_type,
                "version": "v1",
                "payload": payload,
            },
            headers=headers,
        )

        return response.json()

    # Convenience methods
    def visit(self, url, options=None):
        return self.execute("browser.visit", {"url": url, "options": options or {}})

    def execute_script(self, code, timeout=30000):
        return self.execute("browser.execute", {"code": code, "timeout": timeout})

    def send_message(self, prompt, session_id=None, options=None):
        return self.execute("chat.message", {
            "prompt": prompt,
            "sessionId": session_id,
            "options": options or {},
        })

    def create_job(self, target, parser):
        return self.execute("job.create", {"target": target, "parser": parser})

    def job_status(self, job_id):
        return self.execute("job.status", {"jobId": job_id})

    def health_check(self):
        response = requests.get(f"{self.base_url}/gateway/health")
        return response.json()


# Usage
client = LocalBrowserClient(api_key="your-api-key")

try:
    result = client.visit("https://example.com", {"returnHtml": True})
    print(f"Page title: {result['data']['title']}")
except Exception as e:
    print(f"Error: {e}")
```

#### With Retry Logic

```python
import time
import requests

def execute_with_retry(client, command_type, payload, max_retries=5):
    for attempt in range(max_retries):
        try:
            result = client.execute(command_type, payload)
            if result.get("success"):
                return result
            if result.get("error", {}).get("code") == "ERR_RATE_LIMIT_EXCEEDED":
                retry_after = result.get("error", {}).get("details", {}).get("retryAfter", 60)
                time.sleep(retry_after)
                continue
            return result
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)

    return None
```

---

## 13. Integration Steps

### 13.1 Migration from Legacy Endpoints

#### Before (Legacy)

```bash
# Multiple endpoints
curl -X POST https://api.localbrowser.io/api/browser/visit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

curl -X POST https://api.localbrowser.io/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello"}'

curl -X POST https://api.localbrowser.io/api/job/create \
  -H "Content-Type: application/json" \
  -d '{"target": {...}, "parser": {...}}'
```

#### After (Unified Gateway)

```bash
# Single endpoint
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com"}}'

curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"type": "chat.message", "payload": {"prompt": "Hello"}}'

curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"type": "job.create", "payload": {"target": {...}, "parser": {...}}}'
```

### 13.2 Client Update Guide

#### Step 1: Update Endpoint URL

```javascript
// Before
const BASE_URL = 'https://api.localbrowser.io/api';

// After
const BASE_URL = 'https://api.localbrowser.io/v1/gateway';
```

#### Step 2: Add Authentication Header

```javascript
// Before (might be in URL or different header)
const response = await fetch(`${BASE_URL}/browser/visit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url }),
});

// After
const response = await fetch(`${BASE_URL}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key',
  },
  body: JSON.stringify({
    type: 'browser.visit',
    payload: { url },
  }),
});
```

#### Step 3: Update Request Format

```javascript
// Before (legacy format)
{
  "url": "https://example.com",
  "timeout": 30000
}

// After (unified format)
{
  "type": "browser.visit",
  "payload": {
    "url": "https://example.com",
    "options": {
      "timeout": 30000
    }
  }
}
```

#### Step 4: Update Response Handling

```javascript
// Before (legacy response)
{
  "success": true,
  "html": "<html>...</html>",
  "url": "https://example.com"
}

// After (unified response)
{
  "success": true,
  "data": {
    "result": {
      "html": "<html>...</html>",
      "url": "https://example.com"
    }
  },
  "metadata": {
    "processingTimeMs": 1500,
    "commandId": "browser.visit"
  }
}
```

### 13.3 Backward Compatibility

The gateway maintains backward compatibility with legacy endpoints during migration:

| Legacy Endpoint        | Unified Command   | Status |
| ---------------------- | ----------------- | ------ |
| `/api/browser/visit`   | `browser.visit`   | Active |
| `/api/browser/execute` | `browser.execute` | Active |
| `/api/chat/message`    | `chat.message`    | Active |
| `/api/job/create`      | `job.create`      | Active |

---

## 14. Testing and Development

### 14.1 Test Commands

#### Health Check

```bash
curl https://api.localbrowser.io/v1/gateway/health
```

#### List Commands

```bash
curl https://api.localbrowser.io/v1/gateway/commands \
  -H "X-API-Key: your-api-key"
```

#### Simple Browser Test

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com", "options": {"returnHtml": true}}}'
```

#### Simple Chat Test

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"type": "chat.message", "payload": {"prompt": "Hi"}}'
```

### 14.2 Debugging Tips

#### Enable Verbose Logging

```bash
DEBUG=gateway:* npm start
```

#### Check Correlation ID

All responses include a correlation ID. Use it to trace requests in logs:

```json
{
  "correlationId": "corr_abc123"
}
```

#### Test Rate Limits

Monitor rate limit headers:

```bash
curl -i -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com"}}'
```

Response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1707595800
```

### 14.3 Common Issues and Solutions

#### Issue: 400 Bad Request

**Cause**: Invalid request structure or missing required fields.

**Solution**:

1. Check `Content-Type` header is `application/json`
2. Validate payload against command schema
3. Ensure `type` field is present

#### Issue: 401 Unauthorized

**Cause**: Missing or invalid API key.

**Solution**:

1. Add `X-API-Key` header
2. Verify API key is valid
3. Check API key hasn't expired

#### Issue: 429 Too Many Requests

**Cause**: Rate limit exceeded.

**Solution**:

1. Implement exponential backoff
2. Check `Retry-After` header
3. Reduce request frequency

#### Issue: Unknown Command

**Cause**: Command type not found or misspelled.

**Solution**:

1. Check spelling of `type` field
2. Verify command exists using `/gateway/commands`
3. Look for suggestions in error response

### 14.4 Testing Best Practices

1. **Use Test API Key**: Create a test API key with limited scopes
2. **Test Error Cases**: Test invalid payloads, missing headers
3. **Verify Rate Limits**: Test rate limit behavior
4. **Check Correlation IDs**: Verify correlation ID propagation
5. **Test HIPAA Flow**: If applicable, test PHI detection

---

## Quick Reference

### Base URLs

| Environment | URL                              |
| ----------- | -------------------------------- |
| Production  | `https://api.localbrowser.io/v1` |
| Development | `http://localhost:5000/v1`       |

### Authentication Quick Reference

| Use Case           | Headers                                                 |
| ------------------ | ------------------------------------------------------- |
| Public API         | `X-API-Key: your-key`                                   |
| Internal (Laravel) | `X-API-Key`, `X-Signature`, `X-Timestamp`               |
| HIPAA Access       | `X-API-Key`, `X-HIPAA-Token`, `X-HIPAA-Compliant: true` |

### Rate Limits

| Limit Type | Value               |
| ---------- | ------------------- |
| Global     | 100 requests/minute |
| Default    | 30 requests/minute  |
| Health     | 120 requests/minute |

### Response Status

| Field      | Description                            |
| ---------- | -------------------------------------- |
| `success`  | `true` for success, `false` for errors |
| `data`     | Response data (on success)             |
| `error`    | Error information (on failure)         |
| `metadata` | Processing metadata                    |

---

## Related Documentation

- [Full API Reference](UNIFIED_API_GATEWAY.md)
- [Quick Reference](API_GATEWAY_QUICK_REF.md)
- [OpenAPI Specification](api-gateway-openapi.yaml)
- [Postman Collection](LocalBrowser_API_Gateway.postman_collection.json)
- [Migration Guide](GATEWAY_MIGRATION.md)
- [Architecture Design](../plans/API_GATEWAY_ARCHITECTURE.md)
