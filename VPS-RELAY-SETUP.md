# Manual VPS Relay Update Instructions

## What We Changed

The VPS relay now has TWO roles:
1. **Webhook receiver** (existing) - receives live events from Hikvision
2. **Device sync proxy** (NEW) - relays sync requests from dashboard to local device

This solves the HTTPS/HTTP problem - dashboard (HTTPS) → VPS relay (HTTP) → Local device

## Quick Setup

### Option 1: Automatic (SSH required)
```bash
./deploy-vps-relay.sh
```

### Option 2: Manual Update (if SSH issues)

1. **SSH into VPS:**
   ```bash
   ssh -p 7660 root@69.62.109.168
   ```

2. **Upload new relay file:**
   From your local machine:
   ```bash
   scp -P 7660 vps/http-relay-with-sync.js root@69.62.109.168:/root/
   ```

3. **On VPS, restart service:**
   ```bash
   cd /root
   pm2 stop all
   pm2 start http-relay-with-sync.js --name vps-relay --port 7660
   pm2 save
   pm2 list
   ```

4. **Verify it's working:**
   ```bash
   curl http://localhost:7660/health
   # Should show JSON with endpoints list
   ```

## New Endpoints on VPS (Port 7660)

| Endpoint | Purpose | Example |
|----------|---------|---------|
| `/health` | Health check | `curl http://69.62.109.168:7660/health` |
| `/{deviceId}-webhook` | Live event webhooks | `POST http://69.62.109.168:7660/admin-webhook` |
| `/device-sync-month` | Monthly sync proxy | `GET http://69.62.109.168:7660/device-sync-month?ip=192.168.7.2&username=admin&password=XXX&month=2&year=2026` |

## Testing

### 1. Test Health
```bash
curl http://69.62.109.168:7660/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "VPS Webhook Relay + Device Sync",
  "endpoints": {
    "webhooks": "POST /{deviceId}-webhook",
    "sync": "GET /device-sync-month?...",
    "health": "GET /health"
  }
}
```

### 2. Test Sync
```bash
curl "http://69.62.109.168:7660/device-sync-month?ip=192.168.7.2&username=admin&password=Azam198419880001&month=2&year=2026"
```

Should return JSON with events array.

### 3. Test from Dashboard

1. Open: `http://aiclock-82608.web.app` (HTTP not HTTPS)
2. Go to Sync module
3. Click "🔍 Fetch Today's Events"
4. Should work without mixed content errors!

## Architecture

```
Browser (HTTPS)
  ↓
Dashboard (https://aiclock-82608.web.app)
  ↓ HTTP request (OK - outgoing)
VPS Relay (http://69.62.109.168:7660)
  ↓ curl --digest
Hikvision Device (192.168.7.2)
  ↓ JSON response
VPS Relay
  ↓ JSON with CORS headers
Dashboard (displays events)
```

## Advantages

✅ No HTTPS/HTTP mixed content errors
✅ Dashboard can use HTTPS
✅ VPS relays data between HTTPS web and HTTP local device
✅ Same server handles webhooks and sync (simpler)
✅ No SSL certificate needed on VPS

## Current Status

- ✅ Dashboard deployed (uses port 7660)
- ⏳ VPS relay needs manual update (SSH issues)
- ✅ Code ready in `vps/http-relay-with-sync.js`

## If SSH Still Has Issues

Alternative: Run relay locally for testing:
```bash
cd vps
node http-relay-with-sync.js
# Then access: http://localhost:7660
```
