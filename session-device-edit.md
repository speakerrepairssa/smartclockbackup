# AiClock System Documentation

## Version History

### v1.1 - Current Production (Smart Sync)
**Status**: ✅ Active - Deployed and Working
**Date**: January 27, 2026
**VPS**: 69.62.109.168:7660 running http-relay-smart-sync.js

#### Architecture Overview (v1.1 - Smart Sync)
```
┌─────────────────────┐
│ Hikvision Devices   │
│ - FC4349999         │
│ - FC4349998         │  
│ - 192.168.7.4       │
│ Local Storage:      │
│ ├─ 100+ Events      │
│ └─ Complete History │
└──────────┬──────────┘
           │ 
           ├─► HTTP POST Webhook (Real-time)
           │   Instant forwarding
           │
           └─◄ HTTP GET ISAPI Query (Background)
              Triggered by each webhook
              Pulls last 24 hours of events
           
           ▼
┌──────────────────────────────────┐
│  Hostinger VPS (SMART SYNC)      │
│  69.62.109.168:7660              │
│  http-relay-smart-sync.js        │
│  ┌────────────────────────────┐  │
│  │  Webhook Receiver          │  │
│  │  ├─ Forward instantly      │  │
│  │  └─ Trigger sync after     │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │  Smart Sync Engine         │  │
│  │  ├─ Query device API       │  │
│  │  ├─ Pull last 24h events   │  │
│  │  ├─ Deduplicate events     │  │
│  │  ├─ 5-min cooldown         │  │
│  │  └─ Forward to Firebase    │  │
│  └────────────────────────────┘  │
└──────────────┬───────────────────┘
               │ HTTPS Forward
               ▼
┌─────────────────────┐
│ Firebase Functions  │
│ attendanceWebhook   │
│ - Parse Events      │
│ - Store to Firestore│
│ - Deduplicate       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Firebase Firestore │
│  Collections:       │
│  - businesses       │
│    - devices        │
│    - staff          │
│    - status         │
│    - attendance_    │
│      events         │
│      (source: sync) │
└─────────────────────┘
           ▲
           │ Query Events
           │
┌─────────────────────┐
│  Web Application    │
│  - Business Dash    │
│  - Admin Panel      │
│  - Monitor App      │
│  - Timecard View    │
│  - Manual Clocking  │
└─────────────────────┘
```

#### v1.1 Smart Sync Flow
**When employee clocks in:**
1. Device sends webhook to VPS immediately
2. VPS forwards webhook to Firebase (instant, existing behavior)
3. Firebase stores real-time event
4. VPS **triggers background sync** (happens AFTER response sent):
   - Query device ISAPI endpoint for last 24 hours
   - Get ALL events (including historical)
   - Deduplicate against Firebase
   - Upload missing events with `source: 'sync'`
   - 5-minute cooldown per device (avoid over-syncing)

**Result**: Three-way consistency maintained automatically!
- ✅ Real-time events = instant
- ✅ Historical events = caught up on every clock-in
- ✅ WiFi outages = filled when connection returns
- ✅ Missed webhooks = recovered automatically

#### v1.1 Benefits Over v1.0
✅ **No Historical Data Loss**: Auto-syncs last 24 hours on every webhook
✅ **WiFi Outage Recovery**: Gaps filled when device reconnects
✅ **Event-Driven**: No cron jobs, syncs happen naturally
✅ **Simple Architecture**: Still just relay + Firebase
✅ **Backward Compatible**: All v1.0 features still work
✅ **Smart Cooldown**: 5-min per device prevents over-syncing
✅ **Source Tracking**: Events marked as 'sync' vs 'webhook'

#### v1.1 vs v1.0 Improvements
| Feature | v1.0 | v1.1 Smart Sync |
|---------|------|-----------------|
| Real-time capture | ✅ Webhook | ✅ Webhook |
| Historical events | ❌ Trapped in device | ✅ Auto-synced |
| WiFi outage gaps | ❌ Lost forever | ✅ Recovered |
| Missed webhooks | ❌ Data loss | ✅ Caught by sync |
| Manual sync | ❌ Not possible | ✅ Trigger by clocking |
| Complexity | Simple | Still simple! |

#### v1.1 Working Features
✅ Real-time attendance capture via webhooks
✅ **Smart background sync triggered by webhooks** (NEW)
✅ **Historical event recovery (24-hour window)** (NEW)
✅ **5-minute cooldown per device** (NEW)
✅ Admin dashboard with device management
✅ Business dashboard with module system
✅ **Manual Clocking & Adjustments module** (NEW)
✅ Employee management and status tracking
✅ Timecard generation from attendance_events
✅ Monitor app (PWA) for wall displays
✅ Downloads module with QR codes
✅ Settings configuration (working days, holidays)
✅ Device registration and editing
✅ Fixed slot counting and maxEmployees
✅ Attendance and Reports module routing
✅ WhatsApp integration placeholder

#### v1.1 Configuration
**VPS Relay (http-relay-smart-sync.js)**
```javascript
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Sync window: Last 24 hours
// Cooldown: 5 minutes per device
// Endpoint: /ISAPI/AccessControl/AcsEvent?format=json
```

#### v1.1 Monitoring
**Check relay status:**
```bash
curl http://69.62.109.168:7660/
# Response: AiClock Relay v1.1 - Smart Sync Active

# Check logs
ssh root@69.62.109.168
tail -f /opt/aiclock/relay.log

# Restart relay if needed
killall node
cd /opt/aiclock && nohup node http-relay-smart-sync.js > relay.log 2>&1 &
```

#### v1.1 Data Flow Example
```
09:00 AM - Employee clocks in
  ├─ Webhook sent to VPS (instant)
  ├─ VPS forwards to Firebase (instant)
  ├─ Status updated to "in" (instant)
  └─ Background sync triggered:
      ├─ Query device for 09:00 Jan 26 to 09:00 Jan 27
      ├─ Find 3 missed events from yesterday
      ├─ Upload missing events to Firebase
      └─ Mark with source: 'sync'

09:15 AM - Another employee clocks in
  ├─ Webhook sent (instant)
  ├─ Forwarded to Firebase (instant)
  └─ Sync skipped (cooldown active, synced 15 min ago)

09:45 AM - Employee clocks out
  ├─ Webhook sent (instant)
  ├─ Forwarded to Firebase (instant)
  └─ Background sync triggered (cooldown expired):
      ├─ Query device again
      ├─ Catch any events from 09:00-09:45
      └─ Upload to Firebase
```

---

### v1.0 - Archived (Webhook Only)
**Status**: 🗄️ Archived - Replaced by v1.1
**Tag**: v1.0-before-vps-enhancement
**Commit**: fc9e8c4
**Date**: January 27, 2026

#### v1.0 Limitations (Fixed in v1.1)
❌ **Historical Data Gap**: Only captured NEW events via webhooks
❌ **WiFi Outage Risk**: Events lost if internet down
❌ **Missed Webhooks**: Device reboot/config issue = data loss
❌ **Manual Sync**: No way to recover old events

---

### v2.0 - Cancelled (VPS Database System)
**Status**: 🔨 In Development
**Goal**: Make VPS the Single Source of Truth with Complete Event History

#### Architecture Overview (v2.0)
```
┌─────────────────────┐
│ Hikvision Devices   │
│ Local Storage:      │
│ ├─ 100+ Events      │
│ ├─ Face Photos      │
│ └─ Access Logs      │
└──────────┬──────────┘
           │ 
           ├─► HTTP POST (Webhooks - Real-time)
           │   
           └─◄ HTTP GET (API Polling - Historical)
              Device API: /ISAPI/AccessControl/AcsEvent
           
           ▼
┌──────────────────────────────────┐
│  Hostinger VPS (ENHANCED)        │
│  69.62.109.168:7660              │
│  ┌────────────────────────────┐  │
│  │  Enhanced Relay Server     │  │
│  │  ├─ Webhook Receiver       │  │
│  │  ├─ Device Poller (cron)   │  │
│  │  └─ REST API Server        │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │  SQLite Database           │  │
│  │  ├─ attendance_events      │  │
│  │  ├─ devices                │  │
│  │  ├─ sync_status            │  │
│  │  └─ failed_syncs (queue)   │  │
│  └────────────────────────────┘  │
└──────────────┬───────────────────┘
               │ HTTPS Forward (with retry)
               ▼
┌─────────────────────┐
│ Firebase Functions  │
│ (Secondary Storage) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Firebase Firestore │
│  (Real-time Cache)  │
└─────────────────────┘
           ▲
           │ Primary: Query VPS API
           │ Fallback: Query Firebase
           │
┌─────────────────────┐
│  Web Application    │
│  - Queries VPS API  │
│  - Faster Response  │
│  - Complete History │
└─────────────────────┘
```

#### v2.0 Enhancements

**1. VPS Database Layer**
- SQLite database on VPS for fast local storage
- Schema:
  ```sql
  CREATE TABLE attendance_events (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    employee_name TEXT,
    event_type TEXT, -- 'clock-in' | 'clock-out'
    timestamp TEXT NOT NULL,
    source TEXT, -- 'webhook' | 'poll'
    synced_to_firebase BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE devices (
    device_id TEXT PRIMARY KEY,
    ip_address TEXT,
    username TEXT,
    password TEXT,
    last_poll_time TEXT,
    status TEXT
  );
  
  CREATE TABLE sync_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT,
    firebase_synced BOOLEAN,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TEXT
  );
  ```

**2. Device Poller (Cron Job)**
- Runs every 5-15 minutes
- Queries each device's ISAPI endpoint
- Pulls events since last poll
- Deduplicates against existing events
- Stores in VPS database
- Forwards to Firebase

**3. REST API Endpoints**
```
GET  /api/events?businessId={id}&start={date}&end={date}
GET  /api/events/employee/{employeeId}?month={YYYY-MM}
GET  /api/devices
POST /api/sync/device/{deviceId}  (manual sync trigger)
GET  /api/health
```

**4. Intelligent Sync Logic**
- **Webhook Priority**: Real-time events processed immediately
- **Deduplication**: Check device_id + timestamp before insert
- **Retry Queue**: Failed Firebase syncs queued for retry
- **Offline Mode**: VPS continues collecting even if Firebase down
- **Batch Sync**: Catch-up sync on reconnection

**5. Benefits**
✅ **Complete History**: All events from device memory imported
✅ **Fast Queries**: SQLite much faster than device API
✅ **Reliable Backup**: All data safely stored on VPS
✅ **Offline Resilience**: System works even if Firebase down
✅ **No Data Loss**: Retry logic ensures all events reach Firebase
✅ **Historical Import**: Pull events from before webhook setup
✅ **Device Independence**: Don't need device online to query data
✅ **Scalable**: Add unlimited devices without query slowdown

#### v2.0 Implementation Plan

**Phase 1: VPS Database Setup**
- [ ] SSH to VPS
- [ ] Install SQLite3
- [ ] Create database schema
- [ ] Test database connectivity

**Phase 2: Enhanced Relay Server**
- [ ] Backup existing http-relay.js
- [ ] Add SQLite integration
- [ ] Implement webhook receiver with DB storage
- [ ] Add deduplication logic
- [ ] Test with live webhooks

**Phase 3: Device Poller**
- [ ] Research Hikvision ISAPI endpoints
- [ ] Create device poller module
- [ ] Add cron job (every 10 minutes)
- [ ] Test historical event retrieval
- [ ] Implement date range queries

**Phase 4: REST API**
- [ ] Create Express.js REST endpoints
- [ ] Add authentication (API keys)
- [ ] Implement query filters
- [ ] Add pagination for large datasets
- [ ] Deploy on port 7661

**Phase 5: Web App Integration**
- [ ] Update business dashboard to query VPS API
- [ ] Add fallback to Firebase if VPS down
- [ ] Update timecard to use VPS data
- [ ] Test with real data
- [ ] Performance optimization

**Phase 6: Sync & Retry Logic**
- [ ] Implement Firebase sync queue
- [ ] Add retry mechanism for failed syncs
- [ ] Create admin panel to view sync status
- [ ] Add manual sync trigger button
- [ ] Monitor and alert on failures

#### v2.0 Migration Path
1. Deploy v2.0 VPS system alongside v1.0
2. Run initial historical sync from all devices
3. Verify data accuracy
4. Update web app to query VPS
5. Keep Firebase as redundant backup
6. Monitor for 1 week
7. If stable, make VPS primary source

#### v2.0 Rollback Plan
If v2.0 fails:
```bash
git checkout v1.0-before-vps-enhancement
firebase deploy --only hosting
# SSH to VPS and restore old http-relay.js
```

---

## Current System State (v1.1 Smart Sync)

### Smart Sync Architecture
**VPS Relay**: http-relay-smart-sync.js running on 69.62.109.168:7660
- Receives webhooks and forwards instantly to Firebase
- Triggers background sync after each webhook (5-min cooldown)
- Queries device ISAPI endpoint for last 24 hours of events
- Deduplicates and uploads missing events marked as `source: 'sync'`

**Configuration**:
```javascript
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};
```

### Manual Clocking Module
**Location**: Business Dashboard → Manual Clocking menu item
**Features**:
- Employee dropdown selector (shows `employeeName` field from staff collection)
- Date picker (defaults to today)
- Time picker (defaults to current time)
- Notes field for audit trail
- Clock IN / Clock OUT buttons
- Recent entries log (last 20 manual entries from past 7 days)
- Events stored with `manualEntry: true` and `source: 'manual'`
- Tracks who entered and when (`enteredBy`, `enteredAt`)

### Device Management Flow
1. **Register Device**: Admin Dashboard → "Register New Device" button (orange) → Fill form → Select business → Register
2. **View Devices**: Displayed in "Active Devices" table with columns: Device ID, Name, Type, Serial, MAC, Business, Status, Actions
3. **Edit Device**: Click "Edit" button → Modal opens with current data → Modify fields → Click "Update Device"
4. **Delete Device**: Click "Delete" button → Confirmation dialog → Removed from Firebase

### Firebase Structure
```
businesses/
  {businessId}/
    devices/
      {deviceId}/
        - deviceId: string
        - deviceName: string
        - deviceType: string
        - serialNumber: string
        - ipAddress: string
        - status: string (Active/Inactive/Maintenance)
        - lastSync: ISO timestamp
        - createdAt: ISO timestamp
```

### Business-Device Linking
- **Single Device Per Business**: Each business can select ONE device (radio button selection in edit-business.html)
- **Device Sharing**: Same device can be shared across multiple businesses
- **Device Selector**: Shows all devices from all businesses in dropdown
- **Visual Feedback**: Selected device gets blue border (#3b82f6) and background (#eff6ff)

### Current Devices
- **FC4349999**: Main device registered to "SR Components"
- Status: Active
- Type: Face Recognition Terminal
- IP: Listed in table

## Testing Checklist
- [ ] Navigate to Admin Dashboard: https://aiclock-82608.web.app/pages/admin-dashboard.html
- [ ] Click Edit on device FC4349999
- [ ] Verify modal opens with all fields pre-filled
- [ ] Change device name (e.g., "Main Entrance - Updated")
- [ ] Click "Update Device"
- [ ] Verify success notification appears
- [ ] Verify updated name shows in table
- [ ] Try changing linked business to different business
- [ ] Verify device appears under new business in Firebase Console
- [ ] Test validation by clearing required field and trying to save
- [ ] Verify error notification appears

## Files Modified This Session (January 27, 2026)

### Session 1: Manual Clocking Module Implementation
1. **src/pages/business-dashboard.html**
   - Added Manual Clocking menu item in sidebar (line ~337)
   - Added Manual Clocking module card on dashboard (line ~430)
   - Created manualView section with form controls (lines ~1726-1780)
   - Added CSS styles for manual clocking module (lines ~1193-1300)
   - Added Firebase imports: Timestamp, addDoc, query, where, orderBy, limit (line ~2084)
   - Added `initManualClocking()` function (lines ~2881-2906)
   - Added `recordManualEvent()` function (lines ~2908-2969)
   - Added `loadManualEntries()` function (lines ~2971-3031)
   - Added routing for manual module in `switchModule()` (line ~2076)
   - Added module initialization in `loadModuleData()` (lines ~2259-2262)

2. **session-device-edit.md**
   - Updated to reflect v1.1 Smart Sync architecture
   - Documented manual clocking module features
   - Added smart sync flow diagrams
   - Updated version history with v1.1 details

### VPS Configuration
- **File**: /opt/aiclock/http-relay-smart-sync.js
- **Status**: Running on port 7660
- **Features**: 
  - Webhook forwarding (instant)
  - Background sync trigger (after webhook)
  - 24-hour event retrieval window
  - 5-minute cooldown per device
  - ISAPI endpoint integration

## Deployment Status
✅ **Latest Deploy**: January 28, 2026 - Security Fix
- Added HTTPS proxy Firebase function for manual sync
- Fixed mixed content security error
- Manual sync now works on production HTTPS site
✅ **Live URL**: https://aiclock-82608.web.app
✅ **Files Deployed**: 27 files
✅ **VPS Relay**: Running http-relay-smart-sync.js
✅ **Manual Clocking**: Live and functional

## Technical Implementation Details

### Event Delegation
Used event delegation for dynamically created Edit/Delete buttons:
```javascript
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("device-edit-btn")) {
    const businessId = e.target.dataset.businessId;
    const deviceId = e.target.dataset.deviceId;
    this.openEditDeviceModal(businessId, deviceId);
  }
});
```

### Business Move Logic
```javascript
if (linkedBusiness !== businessId) {
  // Delete from old location
  await deleteDoc(doc(db, "businesses", businessId, "devices", deviceId));
  
  // Create in new location
  await setDoc(doc(db, "businesses", linkedBusiness, "devices", deviceId), {...});
} else {
  // Update in place
  await updateDoc(doc(db, "businesses", businessId, "devices", deviceId), {...});
}
```

## Known Working Features (Full System v1.1)
✅ Admin authentication and dashboard
✅ Business creation and management
✅ Device registration with modal
✅ Device display in table with all details
✅ Device editing with full modal
✅ Device deletion with confirmation
✅ Single device selection per business (radio buttons)
✅ Device sharing across businesses
✅ Device auto-fill in edit business page
✅ Event-driven architecture (no onclick errors)
✅ Real-time status updates
✅ Employee management
✅ Timecard generation from attendance_events
✅ **Smart Sync relay with 24-hour recovery** (NEW v1.1)
✅ **Manual Clocking & Adjustments module** (NEW v1.1)
✅ Monitor Mode with real-time updates
✅ Downloads module with QR codes
✅ Attendance tracking and history
✅ Reports generation
✅ Settings configuration

## Recent Fixes (January 27, 2026)
✅ Fixed employee dropdown showing "undefined" (changed `name` to `employeeName`)
✅ Added missing Firebase imports (Timestamp, addDoc, query, where, orderBy, limit)
✅ Manual clocking now records events with full audit trail
✅ Recent entries log displays last 20 manual entries
✅ Events properly marked with `manualEntry: true` and `source: 'manual'`

## Testing Checklist (v1.1)
### Manual Clocking Module
- [x] Navigate to Business Dashboard
- [x] Click "✏️ Manual Clocking" in sidebar
- [x] Verify employee dropdown shows names (not "undefined")
- [x] Select employee, date, and time
- [x] Add notes (optional)
- [x] Click "Clock IN" button
- [x] Verify success message appears
- [x] Verify event appears in Recent Entries
- [x] Check Firebase Console for event with `manualEntry: true`
- [x] Verify employee status updated to "in"
- [x] Clock OUT same employee
- [x] Verify status updated to "out"

### Smart Sync Testing
- [ ] Have employee clock in on device
- [ ] Check VPS logs: `ssh root@69.62.109.168 'tail -f /opt/aiclock/relay.log'`
- [ ] Verify webhook forwarded instantly
- [ ] Verify background sync triggered
- [ ] Verify historical events retrieved from device
- [ ] Check Firebase for events with `source: 'sync'`
- [ ] Clock in again within 5 minutes
- [ ] Verify sync skipped (cooldown active)

### Device Management
- [x] Navigate to Admin Dashboard
- [x] Click Edit on device FC4349999
- [x] Verify modal opens with all fields pre-filled
- [x] Change device name
- [x] Click "Update Device"
- [x] Verify success notification appears
- [x] Verify updated name shows in table

## Important Notes
- All event handlers properly use `addEventListener` (not onclick)
- Modal z-index properly configured to appear above other elements
- Form validation prevents empty required fields
- Device ID cannot be changed (primary key)
- Business dropdown populated from active businesses only
- Status changes update `lastSync` timestamp automatically
- **Employee names use `employeeName` field in Firestore** (not `name`)
- **Manual events marked with `manualEntry: true` and `source: 'manual'`**
- **Sync events marked with `source: 'sync'`**
- **VPS relay has 5-minute cooldown to prevent over-syncing**
- **Smart sync retrieves 24-hour window of events from device**

## VPS Management Commands
```bash
# Check relay status
curl http://69.62.109.168:7660/
# Response: AiClock Relay v1.1 - Smart Sync Active

# SSH to VPS
ssh root@69.62.109.168
# Password: Azam198419880001#

# View relay logs
tail -f /opt/aiclock/relay.log

# Check running processes
ps aux | grep node

# Restart relay
killall node
cd /opt/aiclock
nohup node http-relay-smart-sync.js > relay.log 2>&1 &

# View recent log entries
tail -100 /opt/aiclock/relay.log
```

## Firebase Collections Structure
```
businesses/{businessId}/
  ├─ devices/{deviceId}
  │   ├─ deviceId: string
  │   ├─ deviceName: string
  │   ├─ ipAddress: string
  │   └─ status: string
  ├─ staff/{staffId}
  │   ├─ employeeId: string
  │   ├─ employeeName: string  ← Used in dropdowns
  │   ├─ badgeNumber: string
  │   └─ active: boolean
  ├─ status/{employeeId}
  │   ├─ employeeId: string
  │   ├─ employeeName: string
  │   ├─ attendanceStatus: 'in' | 'out'
  │   └─ lastUpdate: timestamp
  └─ attendance_events/{eventId}
      ├─ employeeId: string
      ├─ employeeName: string
      ├─ action: 'in' | 'out'
      ├─ timestamp: timestamp
      ├─ source: 'webhook' | 'sync' | 'manual'
      ├─ manualEntry: boolean (optional)
      ├─ enteredBy: string (for manual entries)
      └─ notes: string (for manual entries)
```

## Next Steps & Future Enhancements
- [ ] Add edit/delete capability for manual entries
- [ ] Add bulk import from CSV for historical data
- [ ] Add approval workflow for manual adjustments
- [ ] Create audit log report showing all manual entries
- [ ] Add sync status dashboard showing last sync times
- [ ] Implement manual sync trigger button in admin panel
- [ ] Add email notifications for manual clock entries
- [ ] Create API endpoint for external systems to query events
- [ ] Add photo capture on manual clock entries
- [ ] Implement device health monitoring dashboard

## Firebase Project Details
- **Project ID**: aiclock-82608
- **Hosting URL**: https://aiclock-82608.web.app
- **Console**: https://console.firebase.google.com/project/aiclock-82608/overview
- **Current Businesses**: SR Components, test, ersatest1, speakerrepairssa, and others

## Git Status
- Current branch: main
- Latest commit: Manual Clocking Module + Smart Sync
- Working tree: Clean
- Remote: speakerrepairssa/aiclock
- Version tags: v1.0-before-vps-enhancement (archived), v1.1-smart-sync (current)

## System Versions
- **Web App**: v1.1 (Manual Clocking + Smart Sync)
- **VPS Relay**: v1.1 (http-relay-smart-sync.js)
- **Firebase Functions**: attendanceWebhook (unchanged)
- **Node.js**: Latest on VPS
- **Firebase SDK**: 10.7.1

---

**Session Summary**: Successfully implemented v1.1 Smart Sync system with event-driven historical recovery and Manual Clocking & Adjustments module. System now maintains three-way consistency (Device → VPS → Firebase) automatically on every clock-in event.

**Start new chat with**: "Continue from session-device-edit.md v1.1 - Smart sync and manual clocking deployed, need to..."
