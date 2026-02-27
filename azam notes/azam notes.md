You're now at commit 5d6eaeae calculator price change
---

## 🔧 VPS Relay & Webhook Fix - Feb 27, 2026

### Problem Summary
Clock in/out events from Hikvision devices were not appearing in the dashboard. Investigation revealed:
1. VPS relay service was completely down (PM2 had no processes)
2. Multipart/form-data from Hikvision devices was not being parsed correctly
3. Device FC4349999 was not registered to any business
4. Device ID mismatch: webhook URL had "admin" but payload contained "fc4349999"

### Root Causes
1. **VPS Service Failure**: PM2 process manager had no running instances, relay completely offline
2. **Parsing Issues**: Simple regex couldn't handle Hikvision's multipart boundary format
3. **Missing Device Registration**: Device fc4349999 existed but wasn't linked to biz_speaker_repairs
4. **Data Structure Mismatch**: VPS wrapped data in nested structure, Firebase expected flat format

### Solutions Implemented

#### 1. VPS Relay Complete Rewrite (`vps/hikvision-relay.js`)
**File**: [vps/hikvision-relay.js](vps/hikvision-relay.js)

Created a robust relay service with:
- **Proper Multipart Parsing**: Extracts `event_log` field from MIME boundaries correctly
- **Attendance Event Filtering**: Only processes events with `subEventType: 75` or employee data
- **Device ID Prioritization**: Uses `deviceID` from payload instead of URL parameter
- **No External Dependencies**: Uses native Node.js (http, https) - no axios needed
- **Better Error Handling**: Comprehensive logging at each parsing step

Key code sections:
```javascript
// Parse multipart boundaries
function parseHikvisionWebhook(body, contentType) {
  const boundaryMatch = contentType.match(/boundary=([^;,\s]+)/);
  const parts = body.split(new RegExp(`--${boundary}...`));
  // Extracts event_log JSON field cleanly
}

// Prioritize payload deviceID over URL
const actualDeviceId = eventPayload.deviceID || deviceId;

// Filter attendance events only
if (!hasEmployeeData && !isAttendanceEvent) {
  // Skip system events (door locks, network activity)
}
```

**Deployment**:
```bash
# Upload to VPS
sshpass -p 'PASSWORD' scp vps/hikvision-relay.js root@69.62.109.168:/root/

# Start with PM2
ssh root@69.62.109.168 'cd /root && pm2 start hikvision-relay.js --name vps-relay'
```

#### 2. Firebase Function Enhancements (`functions/index.js`)
**File**: [functions/index.js](functions/index.js) (Lines ~151-170)

Added nested data structure flattening:
```javascript
// Extract nested data from VPS relay wrapper
if (eventData.data && typeof eventData.data === 'object') {
  eventData = {
    ...eventData,
    ...eventData.data,
    deviceId: eventData.data.deviceID || eventData.deviceId,
    AccessControllerEvent: eventData.data.AccessControllerEvent
  };
}

// Normalize attendance status
if (statusStr === 'checkin' || statusStr === '1') attendanceStatus = 'in';
else if (statusStr === 'checkout' || statusStr === '2') attendanceStatus = 'out';
```

#### 3. Device Registration Function
**File**: [functions/index.js](functions/index.js) (Lines ~1803-1875)

Added new Cloud Function `registerDevice` for easy device-to-business linking:
```javascript
exports.registerDevice = onRequest(async (req, res) => {
  // Registers device in both:
  // 1. Global devices collection (/devices/{deviceId})
  // 2. Business devices subcollection (/businesses/{businessId}/devices/{deviceId})
});
```

**Usage**:
```bash
curl "https://us-central1-aiclock-82608.cloudfunctions.net/registerDevice?deviceId=fc4349999&businessId=biz_speaker_repairs"
```

### Data Flow Architecture
```
Hikvision Device (192.168.0.114)
  ↓ POST multipart/form-data
  ↓ http://69.62.109.168:7660/admin-webhook
VPS Relay (hikvision-relay.js)
  ↓ Parse multipart boundaries
  ↓ Extract event_log JSON
  ↓ Filter attendance events (subEventType 75)
  ↓ Use deviceID from payload: "fc4349999"
  ↓ POST JSON to Firebase
Firebase Cloud Function (attendanceWebhook)
  ↓ Flatten nested data structure
  ↓ Extract AccessControllerEvent
  ↓ Map deviceId → businessId (fc4349999 → biz_speaker_repairs)
  ↓ Map employeeNoString → slot number
  ↓ Write to Firestore
Firestore Database
  ↓ /businesses/{businessId}/staff/{slot}/status
  ↓ /businesses/{businessId}/attendance_events/{date}/{slot}/{eventId}
Dashboard (Real-time listeners)
  ↓ Updates IN/OUT status instantly
```

### Critical Configuration

**VPS Settings**:
- Server: 69.62.109.168:7660
- Process: PM2 managed as "vps-relay"
- File location: `/root/hikvision-relay.js`
- Check status: `pm2 status vps-relay`
- View logs: `pm2 logs vps-relay --lines 20`

**Device Settings** (in Hikvision device web interface):
- URL: `http://69.62.109.168:7660/admin-webhook`
- Method: POST
- Content-Type: multipart/form-data
- Device sends: deviceID="fc4349999" in payload

**Firebase Functions**:
- attendanceWebhook: `https://attendancewebhook-4q7htrps4q-uc.a.run.app`
- registerDevice: `https://us-central1-aiclock-82608.cloudfunctions.net/registerDevice`

### Device-Business Mappings
- **FC4349999** (192.168.0.114) → Speaker Repairs (biz_speaker_repairs)
- **admin** (192.168.7.2) → Machine 2, SR Components (biz_machine_2)

### Troubleshooting Commands

**Check VPS Status**:
```bash
ssh root@69.62.109.168 'pm2 status'
```

**Monitor VPS Logs**:
```bash
ssh root@69.62.109.168 'pm2 logs vps-relay --lines 20 --nostream'
```

**Check Firebase Logs**:
```bash
firebase functions:log --only attendanceWebhook
```

**Test Device Registration**:
```bash
curl "https://us-central1-aiclock-82608.cloudfunctions.net/registerDevice?deviceId=NEW_DEVICE&businessId=TARGET_BUSINESS"
```

**Restart VPS Relay**:
```bash
ssh root@69.62.109.168 'pm2 restart vps-relay'
```

### Deployment Process

1. **Deploy Firebase Functions**:
```bash
firebase deploy --only functions:attendanceWebhook,functions:registerDevice
```

2. **Deploy VPS Relay**:
```bash
sshpass -p 'Azam198419880001#' scp vps/hikvision-relay.js root@69.62.109.168:/root/
sshpass -p 'Azam198419880001#' ssh root@69.62.109.168 'pm2 restart vps-relay'
```

3. **Verify System**:
```bash
# Check VPS health
curl http://69.62.109.168:7660/health

# Monitor logs
ssh root@69.62.109.168 'pm2 logs vps-relay --lines 0'
```

### System Status: ✅ FULLY OPERATIONAL
- VPS relay: Running (PM2 PID 4786)
- Firebase functions: Deployed and processing
- Device FC4349999: Registered to Speaker Repairs
- Webhook flow: End-to-end working
- Dashboard: Real-time updates confirmed

---