# Setup Guide - Browser Automation API

Complete setup guide for the LocalBrowser Playwright API server.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Storage Setup](#storage-setup)
6. [Testing](#testing)
7. [Running the Server](#running-the-server)
8. [API Authentication](#api-authentication)
9. [Troubleshooting](#troubleshooting)
10. [Production Deployment](#production-deployment)

---

## Quick Start

```bash
# 1. Clone and install
git clone <repository-url>
cd localBrowser_playwright
npm install

# 2. Install Playwright browsers
npx playwright install chromium

# 3. Configure environment
cp .env.example .env
# Edit .env and set API_KEY

# 4. Start server
npm start

# 5. Test
curl -H "x-api-key: YOUR_KEY" "http://localhost:5000/browser/visit?url=https://example.com"
```

---

## System Requirements

### Minimum Requirements
- **Node.js:** 18.x or higher
- **RAM:** 2GB minimum (4GB recommended)
- **Disk:** 2GB free space (browsers + profiles)
- **OS:** Windows, macOS, or Linux

### Required Software
- Node.js and npm
- Playwright (auto-installed via npm)
- SQLite3 (included via better-sqlite3)

### Optional
- Git (for cloning repository)
- PM2 (for process management)
- Nginx (for reverse proxy)

---

## Installation

### Step 1: Install Node.js

**Windows:**
```bash
# Download from https://nodejs.org/
# Or use Chocolatey:
choco install nodejs
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**macOS:**
```bash
brew install node
```

### Step 2: Clone Repository

```bash
git clone <repository-url>
cd localBrowser_playwright
```

### Step 3: Install Dependencies

```bash
npm install
```

**Packages installed:**
- `express` - Web server framework
- `playwright` - Browser automation
- `better-sqlite3` - SQLite database
- `dotenv` - Environment configuration
- `axios` - HTTP client (for cloud storage)
- `form-data` - Multipart form handling
- `crypto` - HMAC signing for webhooks

### Step 4: Install Playwright Browsers

```bash
# Install Chromium only (recommended)
npx playwright install chromium

# Or install all browsers (Chrome, Firefox, WebKit)
npx playwright install
```

**Note:** Chromium download is ~200MB. First-time installation may take a few minutes.

---

## Configuration

### Step 1: Create Environment File

```bash
cp .env.example .env
```

### Step 2: Configure Required Variables

Edit `.env` file:

```env
# Required: API authentication
API_KEY=your_secret_api_key_here

# Optional: Server port (default: 5000)
PORT=5000

# Optional: Browser mode (default: true)
HEADLESS=true

# Required for job queue webhooks
WEBHOOK_SECRET=your_webhook_secret_here
```

### Step 3: Configure Storage (Optional)

See [Storage Setup](#storage-setup) section below.

### Step 4: Configure Error Reporting (Optional)

For WhatsApp error notifications:

```env
WHATSAPP_API=https://your-whatsapp-api.com/send
WHATSAPP_APPKEY=your_app_key
WHATSAPP_AUTHKEY=your_auth_key
WHATSAPP_TO=recipient_phone_number
```

---

## Storage Setup

Choose one of three storage options:

### Option 1: Local Storage (Default)

**No configuration needed!** Files saved to `./scraped_html/`

```env
STORAGE_TYPE=local
ENABLE_LOCAL_CLEANUP=true
CLEANUP_INTERVAL_HOURS=6
CLEANUP_MAX_AGE_HOURS=24
```

**Advantages:**
- ✅ Zero setup
- ✅ Automatic cleanup
- ✅ Fast access

**Limitations:**
- ❌ Limited by disk space
- ❌ No public URLs

### Option 2: BeDrive Cloud Storage

**Prerequisites:**
1. BeDrive instance deployed
2. API key generated

**Configuration:**

```env
STORAGE_TYPE=bedrive
BEDRIVE_URL=https://your-bedrive.com
BEDRIVE_API_KEY=sk_live_abc123
BEDRIVE_FOLDER_ID=221
```

**Setup Steps:**

1. **Deploy BeDrive:**
   - Visit https://bedrive.net
   - Follow installation guide
   - Requires PHP 8.1+, MySQL

2. **Generate API Key:**
   - Log into BeDrive dashboard
   - Go to Settings → API Keys
   - Generate new key (starts with `sk_`)

3. **Get Folder ID:**
   - Use `scraped_html` for auto-creation
   - Or create folder and copy ID from URL

**Advantages:**
- ✅ Unlimited storage
- ✅ Shareable links
- ✅ Public URLs

**Limitations:**
- ❌ External service required
- ❌ Hosting costs

**See:** [STORAGE.md](./STORAGE.md#bedrive-cloud-storage) for detailed setup.

### Option 3: WordPress Media Storage

**Prerequisites:**
1. WordPress 5.6+ with HTTPS
2. Editor/Admin account
3. HTML uploads enabled

**Configuration:**

```env
STORAGE_TYPE=wordpress
WORDPRESS_URL=https://your-site.com
WORDPRESS_USERNAME=admin
WORDPRESS_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

**Setup Steps:**

1. **Generate Application Password:**
   - Log into WordPress admin
   - Users → Profile
   - Application Passwords section
   - Enter name: "Browser Automation API"
   - Click "Add New"
   - Copy password (format: `xxxx xxxx xxxx xxxx xxxx xxxx`)

2. **Enable HTML Uploads:**
   
   Add to `functions.php`:
   ```php
   add_filter('upload_mimes', function($mimes) {
       $mimes['html'] = 'text/html';
       return $mimes;
   });
   ```
   
   Or install "WP Extra File Types" plugin.

3. **Update Environment:**
   - Set credentials in `.env`
   - Use application password (not account password)

**Advantages:**
- ✅ WordPress integration
- ✅ CMS management
- ✅ Direct URLs

**Limitations:**
- ❌ HTTPS required
- ❌ PHP upload limits
- ❌ Manual cleanup

**See:** [STORAGE.md](./STORAGE.md#wordpress-media-storage) for detailed setup.

---

## Testing

### Test Storage Configuration

```bash
cd tests
node test-storage-adapter.js
```

**Expected output:**
```
Created storage adapter: local
--- Testing saveHtml() ---
✅ saveHtml() successful
--- Testing getHtml() ---
✅ getHtml() successful
--- Testing getStats() ---
✅ getStats() successful
✅ All tests passed!
```

### Test WordPress Storage

```bash
# Set WordPress credentials in .env first
cd tests
node test-wordpress-storage.js
```

### Test API Endpoints

Start server first:
```bash
npm start
```

Then test endpoints:

```bash
# Health check
curl http://localhost:5000

# Visit URL
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=https://example.com"

# Get stats
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup/stats"

# Download file (replace FILE_ID)
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/download/FILE_ID" \
  -o test.html
```

---

## Running the Server

### Development Mode

```bash
npm start
```

**Output:**
```
Playwright server running on port 5000
[Storage] Initializing local storage...
[Storage] Local file cleanup scheduled...
```

### Production Mode with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start server with PM2
pm2 start index.js --name "browser-api"

# View logs
pm2 logs browser-api

# Monitor
pm2 monit

# Restart
pm2 restart browser-api

# Stop
pm2 stop browser-api

# Auto-start on boot
pm2 startup
pm2 save
```

### Docker (Optional)

Create `Dockerfile`:
```dockerfile
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN npx playwright install --with-deps chromium

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t browser-api .
docker run -p 5000:5000 --env-file .env browser-api
```

### Environment-Specific Configuration

**.env.development**
```env
PORT=5000
HEADLESS=false
STORAGE_TYPE=local
ENABLE_LOCAL_CLEANUP=true
```

**.env.production**
```env
PORT=5000
HEADLESS=true
STORAGE_TYPE=bedrive
BEDRIVE_URL=https://bedrive.com
```

---

## API Authentication

### API Key Authentication

All endpoints (except `/iaapa/*`) require authentication:

```bash
curl -H "x-api-key: YOUR_KEY" http://localhost:5000/endpoint
```

### Generating API Keys

Use a strong random key:

```bash
# Generate random key (Linux/macOS)
openssl rand -hex 32

# Generate random key (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate random key (PowerShell)
[Convert]::ToBase64String((1..32|%{Get-Random -Max 256}))
```

Add to `.env`:
```env
API_KEY=your_generated_key_here
```

### Testing Authentication

```bash
# Valid key - should succeed
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup/stats"

# Invalid key - should return 401
curl -H "x-api-key: wrong_key" \
  "http://localhost:5000/cleanup/stats"

# No key - should return 401
curl "http://localhost:5000/cleanup/stats"
```

---

## Troubleshooting

### Server Won't Start

**Port already in use:**
```bash
# Change port in .env
PORT=5001

# Or kill process using port 5000
# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/macOS:
lsof -ti:5000 | xargs kill -9
```

**Missing dependencies:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Playwright not installed:**
```bash
npx playwright install chromium
```

### Browser Issues

**Browser won't launch:**
```bash
# Check Playwright installation
npx playwright --version

# Reinstall browsers
npx playwright install --force chromium
```

**Browser crashes:**
```bash
# Run in headed mode for debugging
# Set in .env:
HEADLESS=false

# Check system resources
free -h  # Linux
top      # Linux/macOS
```

### Storage Issues

**Permission errors (Local):**
```bash
mkdir -p scraped_html
chmod 755 scraped_html
```

**Disk space full:**
```bash
# Check available space
df -h

# Manual cleanup
curl -X POST -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/cleanup?maxAge=1"
```

**Cloud storage connection errors:**
```bash
# Test BeDrive connection
curl -H "Authorization: Bearer YOUR_KEY" \
  https://your-bedrive.com/api/v1/drive/file-entries

# Test WordPress connection
curl -u "username:app_password" \
  https://your-site.com/wp-json/wp/v2/media
```

### Database Issues

**Database locked:**
```bash
# Stop server
# Delete lock file
rm logs/database.db-wal logs/database.db-shm

# Restart server
npm start
```

**View errors:**
```bash
sqlite3 logs/database.db "SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT 10"
```

### Network Issues

**Timeout errors:**
```bash
# Increase timeout in request
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=https://example.com&timeout=120000"
```

**Firewall blocking:**
```bash
# Check if port is accessible
telnet localhost 5000

# Windows Firewall
netsh advfirewall firewall add rule name="Browser API" dir=in action=allow protocol=TCP localport=5000
```

---

## Production Deployment

### Prerequisites

- ✅ VPS or dedicated server
- ✅ Node.js 18+ installed
- ✅ PM2 for process management
- ✅ Nginx for reverse proxy (optional)
- ✅ SSL certificate (for HTTPS)

### Deployment Steps

**1. Clone and Setup:**
```bash
git clone <repository>
cd localBrowser_playwright
npm install --production
npx playwright install chromium
```

**2. Configure Environment:**
```bash
cp .env.example .env
nano .env
# Set production values
```

**3. Start with PM2:**
```bash
npm install -g pm2
pm2 start index.js --name browser-api
pm2 startup
pm2 save
```

**4. Configure Nginx (Optional):**

Create `/etc/nginx/sites-available/browser-api`:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable site:
```bash
ln -s /etc/nginx/sites-available/browser-api /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

**5. Setup SSL with Certbot:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

**6. Configure Firewall:**
```bash
# UFW (Ubuntu)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Monitoring

**PM2 Monitoring:**
```bash
pm2 monit
pm2 logs browser-api
pm2 status
```

**Check Logs:**
```bash
tail -f logs/*.log
```

**Resource Usage:**
```bash
# CPU/Memory
top
htop

# Disk space
df -h

# Storage stats
curl -H "x-api-key: KEY" http://localhost:5000/cleanup/stats
```

### Backup Strategy

**Database:**
```bash
# Backup
cp logs/database.db logs/database.db.backup

# Scheduled backup (crontab)
0 2 * * * cp /path/to/logs/database.db /path/to/backups/database-$(date +\%Y\%m\%d).db
```

**Browser Profile:**
```bash
# Backup profile data
tar -czf profile-backup.tar.gz profile-data/
```

**HTML Files (Local Storage):**
```bash
# Backup scraped HTML
tar -czf html-backup.tar.gz scraped_html/
```

### Security Best Practices

- ✅ Use strong API keys
- ✅ Enable HTTPS in production
- ✅ Keep Node.js and packages updated
- ✅ Use firewall to restrict access
- ✅ Regular security audits
- ✅ Monitor access logs
- ✅ Use environment variables (never commit secrets)
- ✅ Enable rate limiting (optional)
- ✅ Regular backups

### Performance Optimization

**1. Enable Headless Mode:**
```env
HEADLESS=true
```

**2. Configure Cleanup:**
```env
ENABLE_LOCAL_CLEANUP=true
CLEANUP_INTERVAL_HOURS=6
CLEANUP_MAX_AGE_HOURS=24
```

**3. Use Cloud Storage:**
```env
STORAGE_TYPE=bedrive
```

**4. Resource Limits (PM2):**
```bash
pm2 start index.js --name browser-api --max-memory-restart 1G
```

**5. Nginx Caching (if applicable):**
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=browser_cache:10m max_size=100m;
proxy_cache browser_cache;
```

---

## Support & Resources

### Documentation
- [Storage Guide](./STORAGE.md) - Storage configuration
- [API Reference](../README.md) - Complete API docs

### Common Commands

```bash
# Start server
npm start

# Run tests
cd tests && node test-storage-adapter.js

# Check stats
curl -H "x-api-key: KEY" http://localhost:5000/cleanup/stats

# Manual cleanup
curl -X POST -H "x-api-key: KEY" http://localhost:5000/cleanup?maxAge=24

# View logs
tail -f logs/*.log

# Check errors
sqlite3 logs/database.db "SELECT * FROM error_logs"
```

### Getting Help

1. Check logs: `tail -f logs/*.log`
2. View database errors: `sqlite3 logs/database.db`
3. Run tests: `cd tests && node test-storage-adapter.js`
4. Check documentation: [STORAGE.md](./STORAGE.md)
5. Review environment: `cat .env`

---

## Next Steps

After setup is complete:

1. ✅ Test API endpoints
2. ✅ Configure storage (if not using local)
3. ✅ Set up monitoring (PM2, logs)
4. ✅ Configure backups
5. ✅ Review security settings
6. ✅ Deploy to production (if applicable)
7. ✅ Read API documentation
