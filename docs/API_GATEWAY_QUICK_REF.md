# API Gateway Quick Reference

## Quick Links

- **Full Documentation**: [`docs/UNIFIED_API_GATEWAY.md`](docs/UNIFIED_API_GATEWAY.md)
- **OpenAPI Spec**: [`docs/api-gateway-openapi.yaml`](docs/api-gateway-openapi.yaml)
- **Postman Collection**: [`docs/LocalBrowser_API_Gateway.postman_collection.json`](docs/LocalBrowser_API_Gateway.postman_collection.json)
- **Architecture Design**: [`plans/API_GATEWAY_ARCHITECTURE.md`](plans/API_GATEWAY_ARCHITECTURE.md)

---

## Base Endpoint

```
POST https://api.localbrowser.io/v1/gateway
```

---

## Authentication Quick Reference

| Use Case           | Headers Required                                             |
| ------------------ | ------------------------------------------------------------ |
| Public API         | `X-API-Key: your-key`                                        |
| Internal (Laravel) | `X-API-Key: your-key`, `X-Signature: sig`, `X-Timestamp: ts` |
| HIPAA Access       | `X-API-Key: your-key`, `X-HIPAA-Token: hipaa-token`          |

---

## All Commands at a Glance

### Browser (6 commands)

| Command            | Description    | Quick Payload                     |
| ------------------ | -------------- | --------------------------------- |
| `browser.execute`  | Run JS code    | `{"code": "..."}`                 |
| `browser.search`   | Google search  | `{"query": "..."}`                |
| `browser.visit`    | Navigate URL   | `{"url": "..."}`                  |
| `browser.scrape`   | Scrape product | `{"url": "...", "vendor": "..."}` |
| `browser.download` | Download file  | `{"fileId": "..."}`               |
| `browser.view`     | View file      | `{"fileId": "..."}`               |

### Chat (3 commands)

| Command            | Description     | Quick Payload         |
| ------------------ | --------------- | --------------------- |
| `chat.prepare`     | Start session   | `{"model": "gemini"}` |
| `chat.message`     | Send to Gemini  | `{"prompt": "..."}`   |
| `chat.message_gpt` | Send to ChatGPT | `{"prompt": "..."}`   |

### IAAPA (3 commands)

| Command              | Description  | Quick Payload      |
| -------------------- | ------------ | ------------------ |
| `iaapa.run_all`      | Run all jobs | `{}`               |
| `iaapa.status`       | Check status | `{"jobId": "..."}` |
| `iaapa.download_csv` | Download CSV | `{"jobId": "..."}` |

### Internal (5 commands)

| Command                  | Description   | Quick Payload                        |
| ------------------------ | ------------- | ------------------------------------ |
| `internal.ping`          | Laravel ping  | `{}`                                 |
| `internal.request_work`  | Get tasks     | `{"maxTasks": 10}`                   |
| `internal.submit_result` | Submit result | `{"taskId": "...", "success": true}` |
| `internal.queue_stats`   | Queue stats   | `{"includeWorkers": true}`           |
| `internal.queue_enqueue` | Enqueue tasks | `{"tasks": [...]}`                   |

### Job (1 command)

| Command      | Description | Quick Payload                        |
| ------------ | ----------- | ------------------------------------ |
| `job.create` | Create job  | `{"target": {...}, "parser": {...}}` |

### Page (3 commands)

| Command        | Description  | Quick Payload         |
| -------------- | ------------ | --------------------- |
| `page.list`    | List pages   | `{}`                  |
| `page.request` | Request page | `{"type": "browser"}` |
| `page.close`   | Close page   | `{"pageId": "..."}`   |

### Cron (2 commands)

| Command              | Description   | Quick Payload |
| -------------------- | ------------- | ------------- |
| `cron.cleanup_pages` | Cleanup pages | `{}`          |
| `cron.stats`         | Get stats     | `{}`          |

### Cleanup (2 commands)

| Command           | Description | Quick Payload    |
| ----------------- | ----------- | ---------------- |
| `cleanup.execute` | Run cleanup | `{"maxAge": 24}` |
| `cleanup.stats`   | Get stats   | `{}`             |

### Error (1 command)

| Command        | Description  | Quick Payload                       |
| -------------- | ------------ | ----------------------------------- |
| `error.report` | Report error | `{"type": "...", "message": "..."}` |

---

## cURL Examples by Category

### Browser Operations

```bash
# Execute JavaScript
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "browser.execute", "payload": {"code": "document.title"}}'

# Google Search
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "browser.search", "payload": {"query": "Playwright"}}'

# Visit URL (get HTML)
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com", "options": {"returnHtml": true}}}'

# Scrape Product
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "browser.scrape", "payload": {"url": "https://amazon.com/dp/B000", "vendor": "amazon"}}'
```

### Chat Operations

```bash
# Send to Gemini
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "chat.message", "payload": {"prompt": "Hello, how are you?"}}'

# Send to ChatGPT
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "chat.message_gpt", "payload": {"prompt": "Explain AI"}}'
```

### Job Operations

```bash
# Create Job
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{
    "type": "job.create",
    "payload": {
      "target": {"url": "https://example.com/products"},
      "parser": {"slug": "product-parser", "mode": "batch"}
    }
  }'
```

### Internal Routes (with HMAC)

```bash
# Generate HMAC signature
SIGNATURE=$(echo -n "1707595200" | openssl dgst -sha256 -hmac "your-secret" | cut -d' ' -f2)

# Ping
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -H "X-Signature: $SIGNATURE" \
  -H "X-Timestamp: 1707595200" \
  -d '{"type": "internal.ping", "payload": {}}'

# Submit Result (with HIPAA)
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -H "X-Signature: $SIGNATURE" \
  -H "X-Timestamp: 1707595200" \
  -H "X-HIPAA-Token: your-hipaa-token" \
  -d '{"type": "internal.submit_result", "payload": {"taskId": "task_123", "success": true}}'
```

---

## Common Pitfalls & Solutions

### ❌ Pitfall 1: Missing Content-Type Header

```bash
# WRONG - Will get 400 error
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "X-API-Key: your-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com"}}'

# RIGHT - Include Content-Type
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com"}}'
```

---

### ❌ Pitfall 2: Invalid URL Format

```bash
# WRONG - Missing protocol
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "browser.visit", "payload": {"url": "example.com"}}'

# RIGHT - Include http:// or https://
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com"}}'
```

---

### ❌ Pitfall 3: Missing HMAC Headers for Internal Routes

```bash
# WRONG - Will get 401 error
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "internal.ping", "payload": {}}'

# RIGHT - Include signature and timestamp
TIMESTAMP=$(date +%s)
SIGNATURE=$(echo -n "$TIMESTAMP" | openssl dgst -sha256 -hmac "your-secret" | cut -d' ' -f2)

curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -H "X-Signature: $SIGNATURE" \
  -H "X-Timestamp: $TIMESTAMP" \
  -d '{"type": "internal.ping", "payload": {}}'
```

---

### ❌ Pitfall 4: Rate Limit Exceeded

```json
// Response when rate limited
{
  "success": false,
  "error": {
    "code": "ERR_RATE_LIMIT",
    "message": "Too many requests, please try again later"
  }
}

// SOLUTION: Add exponential backoff
// - Wait 1 second, retry
// - If still limited, wait 2 seconds
// - If still limited, wait 4 seconds
// - Max 5 retries
```

---

### ❌ Pitfall 5: Validation Errors

```json
// Response with validation errors
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
    ]
  }
}

// SOLUTION: Check payload against schema
// - Ensure required fields are present
// - Check field types (string, number, boolean)
// - Verify URL format (must start with http:// or https://)
```

---

### ❌ Pitfall 6: HIPAA Token Missing

```bash
# WRONG - Will get 403 error
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "internal.submit_result", "payload": {...}}'

# RIGHT - Include HIPAA token
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -H "X-HIPAA-Token: your-hipaa-token" \
  -d '{"type": "internal.submit_result", "payload": {...}}'
```

---

### ❌ Pitfall 7: Unknown Command Type

```json
// Response for unknown command
{
  "success": false,
  "error": {
    "code": "ERR_COMMAND_NOT_FOUND",
    "message": "Unknown command type: browser.invalid_command",
    "supportedCommands": [
      "browser.execute",
      "browser.search",
      "browser.visit",
      "browser.scrape",
      "browser.download",
      "browser.view",
      "..."
    ]
  }
}

// SOLUTION: Check supported commands list
// Use "browser.visit" not "browser.invalid_command"
```

---

## Request/Response Templates

### Standard Request Template

```json
{
  "commandId": "cmd_{{timestamp}}_{{guid}}",
  "type": "CATEGORY.COMMAND",
  "version": "v1",
  "payload": {
    // Command-specific payload here
  },
  "metadata": {
    "requestId": "req_{{timestamp}}",
    "priority": 5
  }
}
```

### Success Response Template

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "metadata": {
    "commandId": "cmd_...",
    "processedAt": "2024-02-10T12:00:00.000Z",
    "durationMs": 1500
  }
}
```

### Error Response Template

```json
{
  "success": false,
  "error": {
    "code": "ERR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional details
    },
    "correlationId": "corr_...",
    "timestamp": "2024-02-10T12:00:00.000Z"
  }
}
```

---

## Environment Variables Reference

| Variable              | Required            | Description                |
| --------------------- | ------------------- | -------------------------- |
| `API_KEY`             | Yes                 | API key for authentication |
| `LOCALBROWSER_SECRET` | For internal routes | HMAC secret for Laravel    |
| `HIPAA_TOKEN`         | For HIPAA routes    | HIPAA compliance token     |
| `ALLOWED_ORIGINS`     | No                  | CORS allowed origins       |
| `GATEWAY_PORT`        | No (default: 5001)  | Gateway server port        |

---

## Debugging Tips

### 1. Enable Verbose Logging

```bash
curl -v -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com"}}'
```

### 2. Check Correlation ID

All responses include a `correlationId` - use this to trace requests in logs.

### 3. Test Health Endpoint

```bash
curl https://api.localbrowser.io/v1/gateway/health
```

---

## Quick Test Commands

### Health Check

```bash
curl https://api.localbrowser.io/v1/gateway/health
```

### List Commands

```bash
curl https://api.localbrowser.io/v1/gateway/commands
```

### Simple Browser Test

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "browser.visit", "payload": {"url": "https://example.com", "options": {"returnHtml": true}}}'
```

### Simple Chat Test

```bash
curl -X POST https://api.localbrowser.io/v1/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"type": "chat.message", "payload": {"prompt": "Hi"}}'
```

---

## File References

| File                                                                                                             | Purpose                       |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| [`docs/api-gateway-openapi.yaml`](docs/api-gateway-openapi.yaml)                                                 | OpenAPI/Swagger specification |
| [`docs/UNIFIED_API_GATEWAY.md`](docs/UNIFIED_API_GATEWAY.md)                                                     | Complete API reference        |
| [`docs/LocalBrowser_API_Gateway.postman_collection.json`](docs/LocalBrowser_API_Gateway.postman_collection.json) | Postman collection            |
| [`plans/API_GATEWAY_ARCHITECTURE.md`](plans/API_GATEWAY_ARCHITECTURE.md)                                         | Architecture design document  |
