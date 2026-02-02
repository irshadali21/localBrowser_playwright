# Common Issues and Solutions

Quick troubleshooting guide for frequently encountered errors.

---

## WordPress Upload Errors

### Socket Hang Up / Connection Timeout

**Error Message:**
```
[WordPress] Upload error: socket hang up
Error: WordPress upload failed: Connection timeout. File size: 298KB.
```

**Cause:**
Large HTML files (>200KB) exceed PHP execution time limits on your WordPress server.

**Solutions:**

#### 1. Increase PHP Limits (Recommended)

Edit your WordPress site's `php.ini` or `.htaccess`:

**Option A: php.ini** (if you have server access)
```ini
max_execution_time = 300
max_input_time = 300
upload_max_filesize = 64M
post_max_size = 64M
memory_limit = 256M
```

**Option B: .htaccess** (if php.ini not accessible)
```apache
php_value max_execution_time 300
php_value max_input_time 300
php_value upload_max_filesize 64M
php_value post_max_size 64M
php_value memory_limit 256M
```

**Option C: wp-config.php** (WordPress specific)
```php
@ini_set('max_execution_time', 300);
@ini_set('max_input_time', 300);
@ini_set('upload_max_filesize', '64M');
@ini_set('post_max_size', '64M');
```

#### 2. Use Different Storage

If you can't modify PHP settings, switch to a different storage backend:

```bash
# .env file - Use BeDrive or Local storage instead
STORAGE_TYPE=local
# or
STORAGE_TYPE=bedrive
```

#### 3. Contact Your Hosting Provider

If on shared hosting, ask them to increase:
- `max_execution_time`
- `upload_max_filesize`
- `post_max_size`

#### 4. Verify WordPress Accessibility

Test if your WordPress site is reachable:
```bash
curl -I https://bedrive.wpulseapp.com
```

Should return `200 OK`. If not, check:
- WordPress site is online
- Domain name is correct
- Firewall isn't blocking access

---

## Page Navigation Timeout

**Error Message:**
```
page.goto: Timeout 60000ms exceeded.
navigating to "https://hangar21heli.com/", waiting until "networkidle"
```

**Cause:**
Website takes longer than 60 seconds to load, or has continuous network activity.

**Solutions:**

#### 1. Increase Timeout

Modify the API request:
```bash
# Add timeout parameter (in milliseconds)
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=https://hangar21heli.com/&timeout=120000"
```

#### 2. Change Wait Strategy

Use different `waitUntil` option:
```bash
# Wait for DOM content loaded (faster)
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=https://hangar21heli.com/&waitUntil=domcontentloaded"

# Or wait for page load only (doesn't wait for network)
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:5000/browser/visit?url=https://hangar21heli.com/&waitUntil=load"
```

**Options:**
- `networkidle` (default) - Wait until no network activity for 500ms
- `load` - Wait for page load event
- `domcontentloaded` - Wait for DOMContentLoaded event (fastest)

#### 3. Check Website Accessibility

Test if site is accessible:
```bash
curl -I https://hangar21heli.com/
```

If site is slow or has issues:
- Website may have heavy JavaScript
- Website may have slow external resources
- Website may be blocking automated browsers
- Network connection may be slow

---

## WhatsApp Notification Errors

**Error Message:**
```
[logError] Failed: getaddrinfo ENOTFOUND your-whatsapp-api-endpoint.com
```

**Cause:**
WhatsApp notification settings are using placeholder values from `.env.example`.

**Solutions:**

#### 1. Comment Out WhatsApp Settings (Recommended)

Edit your `.env` file:
```env
# WhatsApp Error Reporting (Optional) - DISABLED
# WHATSAPP_API=https://your-whatsapp-api-endpoint.com/send
# WHATSAPP_APPKEY=your_app_key
# WHATSAPP_AUTHKEY=your_auth_key
# WHATSAPP_TO=phone_number_to_send_errors
```

#### 2. Remove WhatsApp Variables

Delete these lines from `.env`:
```env
# Remove these lines:
WHATSAPP_API=...
WHATSAPP_APPKEY=...
WHATSAPP_AUTHKEY=...
WHATSAPP_TO=...
```

#### 3. Configure Properly (If Using WhatsApp)

If you want WhatsApp notifications, configure with real values:
```env
WHATSAPP_API=https://your-actual-api.com/send
WHATSAPP_APPKEY=your_real_app_key
WHATSAPP_AUTHKEY=your_real_auth_key
WHATSAPP_TO=+1234567890
```

**Note:** The WhatsApp notification is only for error alerts. The application works fine without it.

---

## WordPress Authentication Issues

**Error Message:**
```
WordPress authentication failed. Check username and password.
```

**Solutions:**

#### 1. Use Application Password

Generate a new application password:
1. WordPress Admin → Users → Your Profile
2. Scroll to "Application Passwords"
3. Enter name: "Browser API"
4. Click "Add New Application Password"
5. Copy password (format: `xxxx xxxx xxxx xxxx xxxx xxxx`)

Update `.env`:
```env
WORDPRESS_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

**Important:** Use application password, NOT your account password!

#### 2. Verify HTTPS

Application passwords require HTTPS:
```bash
# Check if site uses HTTPS
curl -I https://your-site.com | grep "HTTP"
```

Should return `HTTP/2 200` or `HTTP/1.1 200`.

If HTTP only, you need to:
- Enable SSL on WordPress
- Or use localhost for testing
- Or use different authentication

#### 3. Check Username

Username is case-sensitive:
```env
# Correct
WORDPRESS_USERNAME=admin

# Wrong
WORDPRESS_USERNAME=Admin
```

---

## Quick Diagnostics

### Test WordPress Connection
```bash
# Test WordPress REST API
curl -u "username:app_password" \
  https://your-site.com/wp-json/wp/v2/media | jq '.'
```

Should return JSON response with media items.

### Test Storage Configuration
```bash
cd tests
node test-storage-adapter.js
```

### Check Server Logs
```bash
# Application logs
tail -f logs/*.log

# Error database
sqlite3 logs/database.db "SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT 5"
```

### Verify Environment
```bash
# Check .env file
cat .env

# Check storage type
grep STORAGE_TYPE .env
```

---

## Getting Help

If issues persist:

1. **Check Documentation:**
   - [Setup Guide](docs/SETUP.md)
   - [Storage Guide](docs/STORAGE.md)

2. **Enable Debug Mode:**
   ```env
   HEADLESS=false  # See browser window
   ```

3. **Test with Smaller Pages:**
   ```bash
   curl -H "x-api-key: KEY" \
     "http://localhost:5000/browser/visit?url=https://example.com"
   ```

4. **Try Different Storage:**
   ```env
   STORAGE_TYPE=local  # Simplest option
   ```

5. **Check System Resources:**
   ```bash
   # Check disk space
   df -h
   
   # Check memory
   free -h
   
   # Check processes
   ps aux | grep node
   ```
