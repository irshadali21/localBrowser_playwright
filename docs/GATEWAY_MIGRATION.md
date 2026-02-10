# Unified API Gateway Migration Guide

## Migration Date: 2026-02-10

This document details the migration from legacy route-based architecture to the Unified API Gateway.

## Overview

The application has been migrated to use a command-based API Gateway system. All API requests are now routed through a single endpoint (`/api/v1`) with a standardized command pattern.

## Changes Made

### New Files Created

| File                        | Description                                         |
| --------------------------- | --------------------------------------------------- |
| `routes/unifiedRoutes.ts`   | Central route file that mounts gateway at `/api/v1` |
| `docs/GATEWAY_MIGRATION.md` | This migration documentation                        |

### Files Modified

| File       | Changes                                                        |
| ---------- | -------------------------------------------------------------- |
| `index.js` | Removed all legacy route imports, now uses unified routes only |

### Legacy Files (Marked for Removal)

**Routes (to be removed after verification):**

- `routes/browserRoutes.ts`
- `routes/chatRoutes.ts`
- `routes/iaapaRoutes.ts`
- `routes/internalRoutes.ts`
- `routes/jobRoutes.ts`
- `routes/pageRoutes.ts`
- `routes/cronRoutes.ts`
- `routes/cleanupRoutes.ts`
- `routes/errorRoutes.ts`

**Controllers (to be removed after verification):**

- `controllers/browserController.ts`
- `controllers/chatController.ts`
- `controllers/iaapaController.ts`
- `controllers/internalController.ts`
- `controllers/jobController.ts`
- `controllers/pageController.ts`
- `controllers/cronController.ts`
- `controllers/cleanupController.ts`
- `controllers/errorController.ts`

## New API Structure

### Gateway Endpoint

```
POST /api/v1
```

### Request Format

```json
{
  "command": "browser.launch",
  "payload": {
    // command-specific parameters
  }
}
```

### Available Commands

| Command                | Description               | Legacy Route          |
| ---------------------- | ------------------------- | --------------------- |
| `browser.launch`       | Launch a browser instance | `/browser/launch`     |
| `browser.close`        | Close a browser instance  | `/browser/close`      |
| `browser.navigate`     | Navigate to URL           | `/browser/navigate`   |
| `browser.evaluate`     | Evaluate JavaScript       | `/browser/evaluate`   |
| `chat.send`            | Send chat message         | `/chat/send`          |
| `chat.history`         | Get chat history          | `/chat/history`       |
| `job.create`           | Create a job              | `/jobs/create`        |
| `job.status`           | Get job status            | `/jobs/:id`           |
| `job.list`             | List all jobs             | `/jobs`               |
| `page.scrape`          | Scrape a page             | `/pages/scrape`       |
| `cleanup.run`          | Run cleanup               | `/cleanup/run`        |
| `cleanup.status`       | Get cleanup status        | `/cleanup/status`     |
| `cron.schedule`        | Schedule cron job         | `/cron/schedule`      |
| `cron.list`            | List cron jobs            | `/cron`               |
| `error.report`         | Report error              | `/error/report`       |
| `error.list`           | List errors               | `/error`              |
| `iaapa.scrape`         | Scrape IAAPA data         | `/iaapa/scrape`       |
| `iaappa.export`        | Export IAAPA data         | `/iaapa/export`       |
| `internal.task.submit` | Submit internal task      | `/internal/tasks`     |
| `internal.task.status` | Get internal task status  | `/internal/tasks/:id` |

### Management Endpoints

| Endpoint           | Method | Description                  |
| ------------------ | ------ | ---------------------------- |
| `/api/v1/commands` | GET    | List all registered commands |
| `/api/v1/health`   | GET    | Gateway health check         |
| `/api/v1/metrics`  | GET    | Gateway metrics              |
| `/health`          | GET    | Simple health check          |
| `/ready`           | GET    | Readiness check              |

## Middleware Stack

The gateway uses a comprehensive middleware stack:

1. **Request Logging** - Logs all incoming requests with correlation IDs
2. **HIPAA Compliance** - Detects and masks PHI data
3. **Rate Limiting** - Global and per-command rate limits
4. **Authentication** - API key authentication
5. **Validation** - Command and payload validation
6. **Response Logging** - Logs responses with timing
7. **Error Handling** - Centralized error handling

## Rollback Instructions

If you need to rollback to the legacy route structure:

### Step 1: Restore index.js

Replace the contents of `index.js` with the following:

```javascript
// index.js (ROLLBACK VERSION)
require('ts-node/register/transpile-only');

const express = require('express');
const app = express();
const dotenv = require('dotenv');
dotenv.config();
const errorHandler = require('./middleware/errorHandler').default;
const hmacSignature = require('./middleware/hmacSignature').default;
const internalRoutes = require('./routes/internalRoutes');
const StartupWorkerHandshake = require('./bootstrap/startupWorkerHandshake');

app.use(express.json());

// API Key Auth Middleware (skip for internal routes)
app.use((req, res, next) => {
  if (req.path.startsWith('/internal')) return next();
  if (req.path.startsWith('/iaapa')) return next();
  if (req.headers['x-api-key'] !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Invalid API Key' });
  }
  next();
});

// Internal API Routes (HMAC-secured)
app.use('/internal', internalRoutes);

// Public Routes
app.use('/chat', require('./routes/chatRoutes'));
app.use('/browser', require('./routes/browserRoutes'));
app.use('/error', require('./routes/errorRoutes'));
app.use('/pages', require('./routes/pageRoutes'));
app.use('/jobs', require('./routes/jobRoutes'));
app.use('/cron', require('./routes/cronRoutes'));
app.use('/cleanup', require('./routes/cleanupRoutes'));

app.use('/iaapa', require('./routes/iaapaRoutes'));

app.get('/', (req, res) => {
  res.json({ status: 'LocalBrowser API (Playwright) is running' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`Playwright server running on port ${PORT}`);
  // ... rest of startup code
});

export default app;
```

### Step 2: Remove Unified Routes File

Delete `routes/unifiedRoutes.ts` (or move to archive).

### Step 3: Verify Legacy Routes Work

Test each legacy endpoint to ensure functionality:

- `GET /browser` endpoints
- `GET /chat` endpoints
- `GET /iaapa` endpoints
- `GET /internal` endpoints
- `GET /jobs` endpoints
- `GET /pages` endpoints
- `GET /cron` endpoints
- `GET /cleanup` endpoints
- `GET /error` endpoints

## Verification Checklist

After migration, verify:

- [ ] Gateway responds at `/api/v1`
- [ ] Commands execute correctly via POST `/api/v1`
- [ ] Health endpoint responds at `/health`
- [ ] Command list accessible at `/api/v1/commands`
- [ ] Rate limiting is applied
- [ ] Authentication is enforced
- [ ] Logging captures requests
- [ ] Background services start correctly
- [ ] Worker handshake completes

## Environment Variables

Ensure these environment variables are set:

| Variable                | Required | Description                      |
| ----------------------- | -------- | -------------------------------- |
| `API_KEY`               | Yes      | API key for authentication       |
| `PORT`                  | No       | Server port (default: 5000)      |
| `STORAGE_TYPE`          | No       | Storage type (local/cloud)       |
| `ENABLE_TASK_PROCESSOR` | No       | Enable background task processor |
| `LARAVEL_INTERNAL_URL`  | No       | Laravel internal API URL         |
| `LOCALBROWSER_SECRET`   | No       | Secret for Laravel communication |

## Breaking Changes

The following legacy endpoints are no longer available directly:

| Legacy Endpoint          | New Equivalent                                 |
| ------------------------ | ---------------------------------------------- |
| `POST /browser/launch`   | `POST /api/v1 { command: 'browser.launch' }`   |
| `POST /browser/navigate` | `POST /api/v1 { command: 'browser.navigate' }` |
| `GET /chat/history`      | `POST /api/v1 { command: 'chat.history' }`     |
| `POST /jobs/create`      | `POST /api/v1 { command: 'job.create' }`       |
| `GET /pages/scrape`      | `POST /api/v1 { command: 'page.scrape' }`      |

## Support

For issues related to the gateway migration:

1. Check logs with correlation IDs
2. Verify command syntax matches registry
3. Ensure API key is provided in headers
4. Check rate limit status at `/api/v1/metrics`

## Migration Checklist

- [x] Analyze existing route structure
- [x] Create unified route file
- [x] Update entry point (index.js)
- [x] Configure gateway middleware
- [x] Document legacy files for removal
- [x] Create rollback instructions
- [ ] Verify gateway functionality
- [ ] Remove legacy files (after verification)
- [ ] Update API documentation
- [ ] Update client integrations
