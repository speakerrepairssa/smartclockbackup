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

## 🔄 COMPLETE SYSTEM RECOVERY PROCEDURE

### When to Use This
If the system breaks completely and you need to restore to this exact working state (Feb 27-28, 2026).

### GitHub Backup Repositories
**Two complete backups exist**:
- **Primary**: https://github.com/speakerrepairssa/aiclock (commit: 2615e09e)
- **Backup**: https://github.com/speakerrepairssa/smartclockbackup (commit: 2615e09e)

Both contain identical code including:
- Fixed VPS relay (`vps/hikvision-relay.js`)
- Enhanced Firebase functions
- System diagnostic test tool
- All deployment and monitoring scripts

---

### 🎯 Step-by-Step Recovery Process

#### Step 1: Clone Repository
```bash
# Clone from primary repo (or use smartclockbackup if primary unavailable)
git clone https://github.com/speakerrepairssa/aiclock.git
cd aiclock

# Verify you have the working commit
git log --oneline -5
# Should see: 2615e09e Complete backup: All utility scripts...
#             8c024f93 Add system diagnostic test tool...
#             83f7adf3 Merge: VPS relay fix and working webhook system...

# Switch to main branch (if not already)
git checkout main
```

#### Step 2: Install Firebase Dependencies
```bash
cd functions
npm install
cd ..

# Login to Firebase (if needed)
firebase login

# Verify project connection
firebase use aiclock-82608
```

#### Step 3: Deploy Firebase Functions
```bash
# Deploy all functions (includes attendanceWebhook, registerDevice, checkSystemStatus)
firebase deploy --only functions

# Wait for deployment to complete (2-3 minutes)
# Should see: ✔ functions[checkSystemStatus(us-central1)] Successful create operation
#             ✔ functions[attendanceWebhook(us-central1)] Successful update operation
#             ✔ functions[registerDevice(us-central1)] Successful update operation
```

#### Step 4: Deploy VPS Relay Service
```bash
# Upload relay code to VPS
sshpass -p 'Azam198419880001#' scp -o StrictHostKeyChecking=no "vps/hikvision-relay.js" root@69.62.109.168:/root/

# SSH into VPS and start service
sshpass -p 'Azam198419880001#' ssh -o StrictHostKeyChecking=no root@69.62.109.168 << 'EOF'
  cd /root
  
  # Stop any existing relay
  pm2 stop vps-relay 2>/dev/null || true
  pm2 delete vps-relay 2>/dev/null || true
  
  # Start new relay
  pm2 start hikvision-relay.js --name vps-relay
  
  # Save PM2 process list
  pm2 save
  
  # Show status
  pm2 list
  pm2 logs vps-relay --lines 10 --nostream
EOF
```

**Expected Output**:
```
┌─────┬────────────────┬─────────┬─────────┬────────┬──────┐
│ id  │ name           │ mode    │ ↺      │ status │ cpu  │
├─────┼────────────────┼─────────┼─────────┼────────┼──────┤
│ 0   │ vps-relay      │ fork    │ 0       │ online │ 0%   │
└─────┴────────────────┴─────────┴─────────┴────────┴──────┘
```

#### Step 5: Verify Device Registration
```bash
# Check if device FC4349999 is registered to biz_speaker_repairs
node << 'EOF'
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

(async () => {
  const deviceSnap = await db.collection('devices').doc('fc4349999').get();
  if (deviceSnap.exists) {
    console.log('✅ Device registered:', deviceSnap.data());
  } else {
    console.log('❌ Device NOT registered - run registration:');
    console.log('curl "https://us-central1-aiclock-82608.cloudfunctions.net/registerDevice?deviceId=fc4349999&businessId=biz_speaker_repairs"');
  }
  process.exit(0);
})();
EOF
```

**If device not registered**, run:
```bash
curl "https://us-central1-aiclock-82608.cloudfunctions.net/registerDevice?deviceId=fc4349999&businessId=biz_speaker_repairs"
```

#### Step 6: Test Complete Webhook Flow

**Option A: Use Admin Diagnostic Tool (Recommended)**
1. Open admin dashboard: https://aiclock-82608.web.app/admin-dashboard.html
2. Scroll to "System Diagnostic Test" section
3. Select device: FC4349999
4. Select business: Speaker Repairs
5. Click "Start System Test"
6. Follow instructions to clock in 4 times (tests each layer)
7. Review test results - should show all 4 steps ✅

**Option B: Manual Testing**
```bash
# 1. Monitor VPS logs in one terminal
ssh root@69.62.109.168 'pm2 logs vps-relay --lines 0'

# 2. Monitor Firebase logs in another terminal
firebase functions:log --only attendanceWebhook

# 3. Clock in on device (192.168.0.114)

# 4. Verify data flow:
# - VPS log should show: "📤 Forwarding to Firebase..."
# - Firebase log should show: "Processing attendance webhook..."
# - Dashboard should update in real-time (status badge changes)
```

#### Step 7: Deploy Admin Dashboard (if UI updated)
```bash
# Deploy hosting (includes updated admin dashboard with diagnostic tool)
firebase deploy --only hosting

# Access dashboard
open https://aiclock-82608.web.app/admin-dashboard.html
```

---

### 🚨 Quick Troubleshooting After Recovery

**If nothing is working:**
```bash
# 1. Check VPS relay health
curl http://69.62.109.168:7660/health
# Should return: {"status":"healthy","relay":"vps-hikvision","port":7660}

# 2. Check VPS is running
ssh root@69.62.109.168 'pm2 list'
# Should show vps-relay as "online"

# 3. Test Firebase function directly
curl -X POST "https://us-central1-aiclock-82608.cloudfunctions.net/debugWebhook" \
  -H "Content-Type: application/json" \
  -d '{"test": true, "deviceId": "fc4349999"}'

# 4. Check Firebase project
firebase projects:list
# Should show aiclock-82608 as active
```

**If VPS relay crashes:**
```bash
ssh root@69.62.109.168
pm2 restart vps-relay
pm2 logs vps-relay --lines 50
```

**If device not receiving events:**
```bash
# Re-configure Hikvision device webhook
# Device Web Interface → Configuration → Network → Advanced Settings → HTTP Listening
# URL: http://69.62.109.168:7660/admin-webhook
```

**If Firebase function errors:**
```bash
# Redeploy functions
firebase deploy --only functions:attendanceWebhook,functions:registerDevice,functions:checkSystemStatus

# Check logs immediately
firebase functions:log --only attendanceWebhook --lines 50
```

---

### 📋 Critical Files for Recovery

**Files you MUST have for system to work**:
1. ✅ `vps/hikvision-relay.js` (263 lines) - VPS relay service
2. ✅ `functions/index.js` (6500+ lines) - Firebase functions with webhook handler
3. ✅ `src/modules/admin/dashboard.js` - Admin dashboard with diagnostic tool
4. ✅ `src/pages/admin-dashboard.html` - Admin UI with test interface
5. ✅ `firebase.json` - Firebase configuration

**All backed up in**:
- https://github.com/speakerrepairssa/aiclock
- https://github.com/speakerrepairssa/smartclockbackup

---

### 🎯 Success Verification Checklist

After recovery, verify these are working:

- [ ] VPS relay responding: `curl http://69.62.109.168:7660/health` returns JSON
- [ ] PM2 shows online: `ssh root@69.62.109.168 'pm2 list'` shows vps-relay
- [ ] Device registered: Check in Firestore `/devices/fc4349999` exists
- [ ] Firebase functions deployed: `firebase functions:list` shows all functions
- [ ] Clock in on device → dashboard updates within 5 seconds
- [ ] Admin diagnostic tool loads: Open admin-dashboard.html, scroll to "System Diagnostic Test"
- [ ] Diagnostic test passes all 4 steps when you clock in

**If all checkboxes pass → System is fully operational ✅**

---

### 💾 Recovery Time Estimate
- Clone repo: 1-2 minutes
- Install dependencies: 2-3 minutes  
- Deploy Firebase functions: 3-5 minutes
- Deploy VPS relay: 1 minute
- Verify and test: 2-3 minutes
- **Total: ~10-15 minutes to full recovery**

---

### 📞 Emergency Quick Commands

**Fastest recovery path** (if you have git credentials ready):
```bash
# 1. Clone and setup (3 mins)
git clone https://github.com/speakerrepairssa/smartclockbackup.git aiclock
cd aiclock
cd functions && npm install && cd ..

# 2. Deploy everything (4 mins)
firebase use aiclock-82608
firebase deploy --only functions,hosting

# 3. Setup VPS (1 min)
sshpass -p 'Azam198419880001#' scp vps/hikvision-relay.js root@69.62.109.168:/root/
sshpass -p 'Azam198419880001#' ssh root@69.62.109.168 'pm2 restart vps-relay || pm2 start /root/hikvision-relay.js --name vps-relay'

# 4. Test (30 secs)
curl http://69.62.109.168:7660/health
# Clock in on device → check dashboard updates
```

---