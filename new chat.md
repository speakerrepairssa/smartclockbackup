# Device Sync Proxy - Current Status & Next Steps

**Date:** February 24, 2026  
**Issue:** Mixed content error blocking HTTPS → HTTP device sync calls

---

## 🎯 Goal

Enable remote monthly device sync from Firebase Hosting (HTTPS) to Hikvision device (HTTP on local network) without mixed content errors.

---

## 🏗️ Architecture Implemented

```
Browser (HTTPS - anywhere)
  ↓ fetch()
Firebase Hosting (https://aiclock-82608.web.app)
  ↓ HTTPS request
Firebase Function Proxy (devicesyncproxy) ✅ DEPLOYED
  ↓ axios HTTP request
VPS Relay (http://69.62.109.168:7660) ✅ WORKING
  ↓ curl --digest
Hikvision Device (192.168.7.2) ⚠️ TIMING OUT
```

---

## ✅ What's Working

### 1. VPS Relay (Port 7660)
- **Status:** Deployed and running via PM2
- **File:** `/root/http-relay-with-sync.js` (12KB, 350 lines)
- **Process ID:** 3345709
- **Health Check:** `http://69.62.109.168:7660/health` ✅ Returns JSON

**Test Command:**
```bash
curl http://69.62.109.168:7660/health
# Returns: {"status":"healthy","service":"VPS Webhook Relay + Device Sync",...}
```

### 2. Firebase Function Proxy
- **Status:** Deployed successfully
- **Function Name:** `deviceSyncProxy`
- **URL:** `https://us-central1-aiclock-82608.cloudfunctions.net/deviceSyncProxy`
- **Alternative URL:** `https://devicesyncproxy-4q7htrps4q-uc.a.run.app`
- **Code Location:** `functions/deviceSyncProxy.js`

### 3. Dashboard Updates
- **File:** `src/pages/business-dashboard.html`
- **Status:** Updated to use Firebase Function URL instead of direct VPS
- **Changes:** All 3 SYNC_SERVICE_URL declarations updated ✅

---

## ❌ Current Problem

### Firebase Function Timing Out

**Logs show:**
```
Proxying to VPS: http://69.62.109.168:7660/device-sync-month?ip=192.168.7.2...
Proxy error: timeout of 60000ms exceeded
```

**OR:**
```
Proxy error: Request failed with status code 500
```

### Root Cause
The VPS relay is receiving the request from Firebase Function, but when it tries to reach the Hikvision device at `192.168.7.2`, the curl command is failing.

**Possible reasons:**
1. ⚠️ **Device not on same network as VPS** - VPS at 69.62.109.168 might not be able to reach 192.168.7.2 local network
2. Device is offline or unreachable
3. Device credentials changed
4. Network routing issue between VPS and device

---

## 📡 Correct Hikvision Device API

### ✅ Working API Endpoint (DO NOT CHANGE)

**Endpoint:** `http://192.168.7.2/ISAPI/AccessControl/AcsEvent?format=json`

**Method:** POST

**Authentication:** Digest Auth (NOT Basic Auth)

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "AcsEventCond": {
    "searchID": "1",
    "searchResultPosition": 0,
    "maxResults": 1000,
    "major": 5,
    "minor": 75,
    "startTime": "2026-02-01 00:00:00",
    "endTime": "2026-02-28 23:59:59"
  }
}
```

**cURL Command:**
```bash
curl -s --digest -u "admin:Azam198419880001" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "AcsEventCond":{
      "searchID":"1",
      "searchResultPosition":0,
      "maxResults":1000,
      "major":5,
      "minor":75,
      "startTime":"2026-02-01 00:00:00",
      "endTime":"2026-02-28 23:59:59"
    }
  }' \
  "http://192.168.7.2/ISAPI/AccessControl/AcsEvent?format=json"
```

**Response Format:**
```json
{
  "AcsEvent": {
    "searchID": "1",
    "responseStatusStrg": "OK",
    "numOfMatches": 123,
    "matchList": [
      {
        "searchResultPosition": 0,
        "time": "2026-02-01T08:15:00+02:00",
        "employeeNoString": "1",
        "name": "Employee Name",
        "cardNo": "123456",
        "cardType": "normalCard",
        "doorName": "Main Entrance",
        "readerName": "Reader 1",
        "verifyMode": "cardOrFace",
        "eventType": "accessControlEvent"
      }
    ]
  }
}
```

---

## 🚀 Next Steps to Debug

### 1. Test VPS → Device Connection

SSH into VPS and test device connectivity:

```bash
# SSH into VPS
ssh root@69.62.109.168
# Password: Azam198419880001#

# Test if device is reachable
ping -c 4 192.168.7.2

# Test device API directly
curl -s --digest -u "admin:Azam198419880001" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"AcsEventCond":{"searchID":"1","searchResultPosition":0,"maxResults":10,"major":5,"minor":75,"startTime":"2026-02-01 00:00:00","endTime":"2026-02-28 23:59:59"}}' \
  "http://192.168.7.2/ISAPI/AccessControl/AcsEvent?format=json" | head -100
```

### 2. Check VPS Relay Logs

```bash
pm2 logs vps-relay --lines 50 --nostream
```

### 3. Options if VPS Can't Reach Device

**Option A: Device must be on same network as VPS**
- Move device to same network as VPS
- OR setup VPN between VPS and device network
- OR use port forwarding to expose device to VPS

**Option B: Keep service local-only**
- Run relay service locally on Mac (localhost:7660)
- Only works when on same network as device
- No remote access

**Option C: Hybrid approach**
- Firebase Function detects if device is on same network as VPS
- If yes: use VPS relay
- If no: return message "Device offline or unreachable remotely"

---

## 📂 Key Files Modified

### 1. `functions/deviceSyncProxy.js` (NEW)
HTTPS proxy that forwards requests to VPS relay.

```javascript
const { onRequest } = require("firebase-functions/v2/https");
const axios = require('axios');

exports.deviceSyncProxy = onRequest({ cors: true }, async (req, res) => {
  try {
    const { ip, username, password, month, year } = req.query;
    
    // Call VPS relay
    const vpsUrl = `http://69.62.109.168:7660/device-sync-month?ip=${ip}&username=${username}&password=${password}&month=${month}&year=${year}`;
    
    const response = await axios.get(vpsUrl, { timeout: 60000 });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

### 2. `functions/index.js`
Added export:
```javascript
const { deviceSyncProxy } = require('./deviceSyncProxy.js');
exports.deviceSyncProxy = deviceSyncProxy;
```

### 3. `src/pages/business-dashboard.html`
Updated SYNC_SERVICE_URL (3 locations):
```javascript
const SYNC_SERVICE_URL = isLocal 
  ? 'http://localhost:7660' 
  : 'https://us-central1-aiclock-82608.cloudfunctions.net/deviceSyncProxy';
```

### 4. `vps/http-relay-with-sync.js`
Deployed on VPS at `/root/http-relay-with-sync.js` via PM2.

---

## 🔧 VPS Management Commands

### SSH Access
```bash
ssh root@69.62.109.168
# Password: Azam198419880001#

# OR using sshpass
/usr/local/bin/sshpass -p 'Azam198419880001#' ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@69.62.109.168
```

### PM2 Commands
```bash
# Check status
pm2 list

# View logs
pm2 logs vps-relay --lines 50

# Restart
pm2 restart vps-relay

# Stop
pm2 stop vps-relay

# Start
pm2 start /root/http-relay-with-sync.js --name vps-relay
```

### Upload New Version
```bash
# From local machine
cd "/Users/azammacair/Dropbox/projects development/aiclock"

/usr/local/bin/sshpass -p 'Azam198419880001#' ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@69.62.109.168 'cd /root && rm -f http-relay-with-sync.js && cat > http-relay-with-sync.js' < vps/http-relay-with-sync.js

# Install dependencies (if needed)
/usr/local/bin/sshpass -p 'Azam198419880001#' ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@69.62.109.168 'cd /root && npm install axios'

# Restart PM2
/usr/local/bin/sshpass -p 'Azam198419880001#' ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@69.62.109.168 'pm2 restart vps-relay'
```

---

## 🧪 Testing Commands

### Test VPS Relay Health
```bash
curl http://69.62.109.168:7660/health
```

### Test VPS Relay Sync
```bash
curl "http://69.62.109.168:7660/device-sync-month?ip=192.168.7.2&username=admin&password=Azam198419880001&month=2&year=2026"
```

### Test Firebase Function Proxy
```bash
curl "https://us-central1-aiclock-82608.cloudfunctions.net/deviceSyncProxy?ip=192.168.7.2&username=admin&password=Azam198419880001&month=2&year=2026"
```

### Test from Browser Console
```javascript
fetch('https://us-central1-aiclock-82608.cloudfunctions.net/deviceSyncProxy?ip=192.168.7.2&username=admin&password=Azam198419880001&month=2&year=2026')
  .then(r => r.json())
  .then(data => console.log(data));
```

---

## 💡 Critical Notes

1. **Device IP:** 192.168.7.2 (must be reachable from VPS)
2. **Device Credentials:** admin / Azam198419880001
3. **VPS IP:** 69.62.109.168
4. **Relay Port:** 7660
5. **Authentication Type:** Digest Auth (not Basic)
6. **API Endpoint:** `/ISAPI/AccessControl/AcsEvent?format=json`
7. **Event Codes:** major=5, minor=75 (door access events)

---

## 🔍 Why Mixed Content Error Occurred

Browser security policy blocks HTTPS pages from making HTTP requests (called "mixed content blocking"). 

**Original attempt:**
```
Browser (HTTPS) → VPS (HTTP) ❌ BLOCKED
```

**Solution implemented:**
```
Browser (HTTPS) → Firebase Function (HTTPS) → VPS (HTTP) ✅ ALLOWED
```

Server-to-server HTTP requests are allowed, only browser → HTTP is blocked.

---

## 📝 TODO When Resuming

1. [ ] SSH to VPS and test if 192.168.7.2 is reachable
2. [ ] Check VPS relay logs for exact curl error
3. [ ] Verify device is online and accessible
4. [ ] Test device API directly from VPS
5. [ ] If device unreachable from VPS, decide on networking solution
6. [ ] Once working, deploy dashboard updates: `firebase deploy --only hosting`
7. [ ] Test end-to-end from browser
8. [ ] Commit to git

---

## 🔗 Deployment Commands

### Deploy Firebase Function Only
```bash
cd "/Users/azammacair/Dropbox/projects development/aiclock"
firebase deploy --only functions:deviceSyncProxy
```

### Deploy Dashboard Only
```bash
firebase deploy --only hosting
```

### Deploy Both
```bash
firebase deploy --only functions:deviceSyncProxy,hosting
```

### Check Function Logs
```bash
firebase functions:log
```

---

## ⚠️ Known Issues

- **Firebase Function timeout:** 60 seconds max (already at limit)
- **VPS can't reach device:** Networking issue between VPS (69.62.109.168) and device (192.168.7.2)
- **Local network required:** Device at 192.168.7.2 is on private network

---

**Status:** Waiting for VPS → Device connectivity debugging
**Last Updated:** February 24, 2026
