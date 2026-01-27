# AiClock System Documentation

## Version History

### v1.0 - Current Production (Tag: v1.0-before-vps-enhancement)
**Status**: ✅ Stable - Deployed and Working
**Commit**: fc9e8c4
**Date**: January 27, 2026

#### Architecture Overview (v1.0)
```
┌─────────────────────┐
│ Hikvision Devices   │
│ - FC4349999         │
│ - FC4349998         │  
│ - 192.168.7.4       │
└──────────┬──────────┘
           │ HTTP POST (Webhooks - Real-time only)
           │ Example: POST /fc4349999-webhook
           ▼
┌─────────────────────┐
│  Hostinger VPS      │
│  69.62.109.168:7660 │
│  http-relay.js      │
│  - Simple Forwarder │
│  - No Storage       │
└──────────┬──────────┘
           │ HTTPS Pipe-through
           ▼
┌─────────────────────┐
│ Firebase Functions  │
│ attendanceWebhook   │
│ - Parse Event       │
│ - Store to Firestore│
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
└─────────────────────┘
```

#### v1.0 Limitations
❌ **Historical Data Gap**: Only captures NEW events via webhooks, 100+ past events trapped in device memory
❌ **No VPS Backup**: Events not stored on VPS, single point of failure
❌ **Device Dependency**: Must query device directly for historical data (slow, unreliable)
❌ **Network Outage Risk**: If internet down, events lost forever
❌ **No Retry Logic**: Failed Firebase writes = lost data
❌ **Webhook Only**: Misses events if device doesn't send webhook (reboots, config issues)

#### v1.0 Working Features
✅ Real-time attendance capture via webhooks
✅ Admin dashboard with device management
✅ Business dashboard with module system
✅ Employee management and status tracking
✅ Timecard generation from attendance_events
✅ Monitor app (PWA) for wall displays
✅ Downloads module with QR codes
✅ Settings configuration (working days, holidays)
✅ Device registration and editing
✅ Fixed slot counting and maxEmployees
✅ Attendance and Reports module routing
✅ WhatsApp integration placeholder

#### v1.0 Data Flow
1. Employee clocks in on Hikvision device
2. Device sends HTTP POST to VPS (real-time webhook)
3. VPS forwards to Firebase Cloud Function
4. Function stores in `attendance_events` collection
5. Web app queries Firestore for display

#### v1.0 Known Issues
⚠️ Timecard shows "ABSENT" for days before webhook setup
⚠️ Cannot add 7th employee if maxEmployees not set correctly (fixed with fix-maxemployees.html)
⚠️ Slot count hardcoded to 5 (fixed to be dynamic based on plan)

---

### v2.0 - Planned Enhancement (VPS Database System)
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

## Current System State (v1.0)

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

## Files Modified This Session
1. **src/pages/admin-dashboard.html**
   - Added complete edit device modal structure (lines ~290-355)
   - Includes all form fields and buttons

2. **src/modules/admin/dashboard.js**
   - Added `openEditDeviceModal()` function (~395-440)
   - Added `closeEditDeviceModal()` function (~442-446)
   - Added `updateDevice()` function (~448-502)
   - Updated `displayDevices()` to use data attributes (~383-386)
   - Updated `initializeEventListeners()` to add edit modal handlers (~83-108)

## Deployment Status
✅ **Successfully Deployed**: firebase deploy --only hosting
✅ **Live URL**: https://aiclock-82608.web.app
✅ **Deploy Time**: Jan 25, 2026 12:03 PM
✅ **Files Deployed**: 23 files

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

## Known Working Features (Full System)
✅ Admin authentication and dashboard
✅ Business creation and management
✅ Device registration with modal
✅ Device display in table with all details
✅ **Device editing with full modal** (NEW - THIS SESSION)
✅ Device deletion with confirmation
✅ Single device selection per business (radio buttons)
✅ Device sharing across businesses
✅ Device auto-fill in edit business page
✅ Event-driven architecture (no onclick errors)
✅ Real-time status updates
✅ Employee management
✅ Timecard generation

## Previous Session Context
- Codebase was restored to commit 1f3ea73 (yesterday 11pm)
- Device registration modal already working
- Edit business page allows device selection via radio buttons
- All devices from all businesses visible in device selector
- Visual highlighting for selected devices

## Next Steps if Needed
- Test the edit workflow thoroughly
- Verify Firebase Console shows correct device updates
- Add MAC address field to edit form (currently view-only)
- Consider adding batch edit for multiple devices
- Add device activity logs/history
- Implement device health monitoring

## Important Notes
- All event handlers properly use `addEventListener` (not onclick)
- Modal z-index properly configured to appear above other elements
- Form validation prevents empty required fields
- Device ID cannot be changed (primary key)
- Business dropdown populated from active businesses only
- Status changes update `lastSync` timestamp automatically

## Firebase Project Details
- **Project ID**: aiclock-82608
- **Hosting URL**: https://aiclock-82608.web.app
- **Console**: https://console.firebase.google.com/project/aiclock-82608/overview
- **Current Businesses**: SR Components, test, ersatest1, speakerrepairssa, and others

## Git Status
- Current branch: main
- All changes committed and deployed
- Working tree clean
- Remote: speakerrepairssa/aiclock

---

**Start new chat with**: "Continue from session-device-edit.md - device editing is now working, need to..."
