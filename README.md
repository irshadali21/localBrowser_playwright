# Local Browser API (Playwright)

This project exposes a REST API for controlling a Playwright browser locally. It supports running custom code, basic scraping, and sending messages to Gemini or ChatGPT.

## Requirements

- Node.js 18+
- Playwright browsers (installed via `npx playwright install`)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```
3. Create a `.env` file with at least the following variables:
   ```env
   API_KEY=your_api_key
   PORT=5000            # optional
   HEADLESS=false       # optional, run with a visible browser
   WHATSAPP_API=...
   WHATSAPP_APPKEY=...
   WHATSAPP_AUTHKEY=...
   WHATSAPP_TO=...
   ```
4. Start the server:
   ```bash
   npm start
   ```

The server uses a SQLite database in `logs/database.db` and stores Playwright profiles in `profile-data/`.

## Available Endpoints

- `POST /chat/prepare` – prepare a Gemini session.
- `POST /chat/message` – send a prompt to Gemini (`{ prompt: "..." }`).
- `POST /chatgpt/message` – send a prompt to ChatGPT (`{ prompt: "..." }`).
- `POST /browser/execute` – execute arbitrary code on a page (`{ code: "..." }`).
- `GET  /browser/search?q=` – perform a Google search.
- `GET  /browser/visit?url=` – visit a URL and return cleaned HTML.
- `GET  /browser/scrape?url=&vendor=` – scrape product pricing using a vendor strategy.
- `GET  /pages/list` – list active pages.
- `POST /pages/request?type=` – create a new page of the given type.
- `POST /pages/close` – close all pages.
- `POST /error/report` – log an error and forward it via WhatsApp.

All requests require the `x-api-key` header matching `API_KEY`.

## Development Notes

- The database and log directories are created automatically if they do not exist.
- To run in headless mode set `HEADLESS=true` (default). Set `HEADLESS=false` to see the browser.

