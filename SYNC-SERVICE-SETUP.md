# Hikvision Device Sync - HTTP/HTTPS Setup Guide

## Current Configuration

The Hikvision device sync service runs on **HTTP** (not HTTPS) for the following reasons:
1. Local development convenience
2. VPS doesn't have SSL certificate configured yet
3. Direct device access doesn't require encryption (internal network)

## How to Use Sync Features

### Option 1: Access Dashboard via HTTP (Recommended for Testing)

**URL:** `http://aiclock-82608.web.app` (note: **HTTP**, not HTTPS)

✅ **Advantages:**
- Works immediately
- No mixed content errors
- Direct access to VPS sync service

⚠️ **Note:** Most browsers will show "Not Secure" warning, but this is fine for internal business tools.

### Option 2: Use Localhost (For Development)

1. Make sure local sync service is running:
   ```bash
   cd hikvision-sync-service
   node server.js
   ```

2. Access dashboard via:
   ```
   http://localhost:5000
   ```
   or serve locally:
   ```bash
   cd src
   python3 -m http.server 8080
   # Then open: http://localhost:8080/pages/business-dashboard.html
   ```

### Option 3: Set Up HTTPS on VPS (Production Ready)

For production deployment with HTTPS:

```bash
# SSH into VPS
ssh -p 7660 root@69.62.109.168

# Install nginx and certbot
sudo apt-get update
sudo apt-get install nginx certbot python3-certbot-nginx -y

# Get SSL certificate (requires domain name)
sudo certbot --nginx -d sync.yourdomain.com

# Configure nginx reverse proxy
sudo nano /etc/nginx/sites-available/hikvision-sync
```

Add configuration:
```nginx
server {
    listen 443 ssl;
    server_name sync.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/sync.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sync.yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/hikvision-sync /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Then update dashboard to use HTTPS URL.

## Current Service Endpoints

| Environment | URL | Status |
|------------|-----|--------|
| Local Development | `http://localhost:3002` | ✅ Works |
| VPS Production | `http://69.62.109.168:3002` | ✅ Works |
| VPS HTTPS | `https://69.62.109.168:3002` | ❌ No SSL |
| Cloud Function | `https://us-central1-aiclock-82608.cloudfunctions.net/syncDevice` | ❌ Can't reach local device |

## Testing Sync Service

```bash
# Test VPS service health
curl http://69.62.109.168:3002/health

# Test device sync
curl "http://69.62.109.168:3002/device/sync-month?ip=192.168.7.2&username=admin&password=PASSWORD&month=2&year=2026"
```

## Troubleshooting

### Mixed Content Error
**Error:** "Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure resource 'http://...'"

**Solution:** Access dashboard via HTTP instead of HTTPS, or set up HTTPS on VPS (Option 3).

### Service Not Reachable
**Error:** "Failed to fetch" or "Connection refused"

**Solutions:**
1. Check if sync service is running: `curl http://69.62.109.168:3002/health`
2. Check VPS firewall allows port 3002
3. Verify device IP is correct (192.168.7.2)
4. Test from same network as device

### Device Authentication Failed
**Error:** "400 Bad Request" or "401 Unauthorized"

**Solutions:**
1. Verify device credentials in Firebase `/businesses/{id}/devices/{deviceId}`
2. Test device login manually: `curl --digest -u admin:password http://192.168.7.2/ISAPI/System/deviceInfo`
3. Check device IP hasn't changed

## Quick Access Links

- **Dashboard (HTTP):** http://aiclock-82608.web.app/pages/business-dashboard.html
- **Dashboard (HTTPS):** https://aiclock-82608.web.app/pages/business-dashboard.html (sync won't work until VPS has HTTPS)
- **VPS Sync Service:** http://69.62.109.168:3002/health
- **Firebase Console:** https://console.firebase.google.com/project/aiclock-82608

## Recommended Setup for Production

1. ✅ VPS with sync service running (DONE)
2. ✅ Dashboard deployed to Firebase Hosting (DONE)
3. ⏳ Get domain name for VPS (e.g., sync.smartclock.co.za)
4. ⏳ Configure SSL certificate with Let's Encrypt
5. ⏳ Update dashboard to use HTTPS sync service URL
6. ⏳ Enforce HTTPS on Firebase Hosting

**Estimated time:** 30 minutes for steps 3-6
