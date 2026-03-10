# AiClock Data Flow - First Clock-In to App Display

## Complete Block Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EMPLOYEE FIRST CLOCK-IN                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  1. HIKVISION BIOMETRIC DEVICE (192.168.7.4)                            │
│     ├─ Employee scans fingerprint/face                                  │
│     ├─ Device authenticates (compares with enrolled template)           │
│     ├─ Device determines: Clock IN or Clock OUT                         │
│     └─ Device generates attendance event                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP POST Webhook
                                    │ URL: http://69.62.109.168:7660/admin-webhook
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. VPS RELAY SERVER (69.62.109.168:7660)                               │
│     ├─ Receives webhook from device                                     │
│     ├─ Parses XML payload                                               │
│     ├─ Extracts: employeeId, timestamp, status (in/out), deviceId       │
│     └─ Forwards to Firebase Cloud Function                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP POST
                                    │ URL: https://us-central1-aiclock-82608.
                                    │      cloudfunctions.net/attendanceWebhook
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. FIREBASE CLOUD FUNCTION: attendanceWebhook                          │
│     ├─ Validates webhook data                                           │
│     ├─ Maps deviceId → businessId (biz_srcomponents)                    │
│     ├─ Maps slot number → employeeId                                    │
│     ├─ Checks for duplicate punch (prevents double clock-in/out)        │
│     └─ Processes attendance event                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. FIRESTORE DATABASE - Write Operations                               │
│     │                                                                    │
│     ├─► businesses/biz_srcomponents/attendance_events/{eventId}         │
│     │   └─ Stores: timestamp, employeeId, status, deviceId, etc.       │
│     │                                                                    │
│     ├─► businesses/biz_srcomponents/status/{employeeId}                 │
│     │   └─ Updates: attendanceStatus ('in'/'out'), lastClockTime        │
│     │                                                                    │
│     └─► businesses/biz_srcomponents/staff/{employeeId}                  │
│         └─ Employee info: name, slot, payRate, etc.                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌─────────────────────────────────┐  ┌──────────────────────────────────┐
│  5a. REAL-TIME LISTENERS         │  │  5b. ASSESSMENT CACHE            │
│      (Firestore onSnapshot)      │  │                                  │
│                                  │  │  Triggered when:                 │
│  Business Dashboard listens to:  │  │  - Day changes (midnight)       │
│  ├─ status collection            │  │  - Manual refresh               │
│  └─ staff collection             │  │  - Admin recalculation          │
│                                  │  │                                  │
│  Updates instantly:              │  │  Cloud Function:                │
│  ├─ Monitor view (IN/OUT)        │  │  updateAssessmentCache          │
│  ├─ Employee cards               │  │  ├─ Reads staff collection      │
│  └─ Current status               │  │  ├─ Reads attendance_events     │
│                                  │  │  ├─ Calculates hours worked     │
│                                  │  │  ├─ Calculates hours short      │
│                                  │  │  └─ Stores in assessment_cache  │
└─────────────────────────────────┘  └──────────────────────────────────┘
                    │                               │
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  6. BUSINESS DASHBOARD UI (https://aiclock-82608.web.app)              │
│                                                                          │
│  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────────┐ │
│  │   MONITOR VIEW     │  │  EMPLOYEES VIEW    │  │  ASSESSMENT VIEW │ │
│  ├────────────────────┤  ├────────────────────┤  ├──────────────────┤ │
│  │ Shows:             │  │ Shows:             │  │ Shows:           │ │
│  │ • Who's IN/OUT     │  │ • Employee cards   │  │ • Hours worked   │ │
│  │ • Last clock time  │  │ • Current status   │  │ • Hours short    │ │
│  │ • Slot numbers     │  │ • Employee details │  │ • Income due     │ │
│  │                    │  │ • Edit employee    │  │ • Potential $    │ │
│  │ Data source:       │  │                    │  │                  │ │
│  │ status collection  │  │ Data source:       │  │ Data source:     │ │
│  │ (real-time)        │  │ staff + status     │  │ assessment_cache │ │
│  └────────────────────┘  └────────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Detailed Data Flow Steps

### Step 1: Device Clock-In
```
Employee Action: Scans fingerprint/face at terminal
↓
Device: "User 1 authenticated - Clock IN at 08:30:15"
↓
Device generates XML webhook payload
```

**XML Payload Example:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<EventNotificationAlert>
    <employeeNo>1</employeeNo>
    <name>azam</name>
    <attendanceStatus>1</attendanceStatus>  <!-- 1=IN, 2=OUT -->
    <dateTime>2026-02-09T08:30:15</dateTime>
    <deviceID>admin</deviceID>
</EventNotificationAlert>
```

### Step 2: Device → VPS Relay
```
POST http://69.62.109.168:7660/admin-webhook
├─ Headers: Content-Type: application/xml
└─ Body: XML payload from device
```

**VPS Relay Actions:**
1. Receives webhook on port 7660
2. Validates XML structure
3. Extracts key fields
4. Adds metadata (receivedAt timestamp)
5. Forwards to Firebase Cloud Function

### Step 3: VPS → Firebase Cloud Function
```
POST https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook
├─ Headers: Content-Type: application/json
└─ Body: {
    "employeeId": "1",
    "employeeName": "azam",
    "attendanceStatus": "in",
    "timestamp": "2026-02-09T08:30:15",
    "deviceId": "admin"
}
```

**Cloud Function Logic (attendanceWebhook):**
```javascript
1. Extract deviceId from webhook
2. Query Firestore: businesses where linkedDevices contains deviceId
3. Found: biz_srcomponents (deviceId='admin')
4. Get employee from staff collection (slot 1 = azam)
5. Check last clock status (prevent duplicate IN after IN)
6. Validate timestamp (not future date)
7. Write to Firestore (3 operations below)
```

### Step 4: Firestore Write Operations

**4a. Store Attendance Event:**
```javascript
businesses/biz_srcomponents/attendance_events/{auto-generated-id}
{
  businessId: "biz_srcomponents",
  employeeId: "1",
  employeeName: "azam",
  slotNumber: 1,
  timestamp: "2026-02-09T08:30:15Z",
  attendanceStatus: "in",
  eventDate: "2026-02-09",
  eventTime: "08:30:15",
  deviceId: "admin",
  source: "webhook",
  type: "normal",
  createdAt: serverTimestamp()
}
```

**4b. Update Status (Real-Time Monitoring):**
```javascript
businesses/biz_srcomponents/status/1
{
  employeeId: "1",
  employeeName: "azam",
  slot: 1,
  attendanceStatus: "in",           // ← Changed from "out" to "in"
  lastClockTime: "2026-02-09T08:30:15Z",
  lastClockStatus: "in",            // ← For duplicate detection
  updatedAt: serverTimestamp()
}
```

**4c. Staff Record (Already Exists):**
```javascript
businesses/biz_srcomponents/staff/1
{
  employeeId: "1",
  employeeName: "azam",
  slot: 1,
  payRate: 70.00,
  active: true,
  deviceId: "admin",
  // ... other employee details
}
```

### Step 5a: Real-Time Dashboard Updates

**Monitor View Listener:**
```javascript
// JavaScript in business-dashboard.html
db.collection('businesses/biz_srcomponents/status')
  .onSnapshot(snapshot => {
    // Instantly triggered when status/1 updates
    snapshot.docs.forEach(doc => {
      const emp = doc.data();
      if (emp.attendanceStatus === 'in') {
        // Show in "Currently IN" section
        displayInEmployee(emp);
      }
    });
  });
```

**Result:** Monitor view updates in < 1 second showing "azam" in the IN section

### Step 5b: Assessment Cache Calculation

**Triggered:**
- Midnight each day (scheduled function)
- Manual refresh button
- Admin recalculation tool

**Cloud Function: updateAssessmentCache**
```javascript
1. Get current month: "2026-02"
2. Query: businesses/biz_srcomponents/staff (all employees)
3. For each employee:
   a. Query attendance_events for the month
   b. Calculate total hours worked:
      - Pair clock-ins with clock-outs
      - Sum hours: (clock-out - clock-in)
   c. Get required hours from shift schedule
   d. Calculate hours short: requiredHours - currentHours
   e. Calculate income: currentHours × payRate
   f. Calculate potential income: requiredHours × payRate
4. Store in assessment_cache collection
```

**Assessment Cache Structure:**
```javascript
businesses/biz_srcomponents/assessment_cache/2026-02
{
  month: "2026-02",
  lastUpdated: serverTimestamp(),
  summary: {
    totalEmployees: 8,
    totalHoursWorked: 142.5,
    totalHoursShort: 457.5,
    totalAmountDue: 9975.00
  },
  employees: [
    {
      index: 1,
      employeeId: "1",
      name: "azam",
      requiredHours: 200,
      currentHours: 24.5,       // ← From attendance_events
      hoursShort: 175.5,
      payRate: 70.00,
      currentIncomeDue: 1715.00,
      potentialIncome: 14000.00, // ← New column!
      status: "Critical",
      statusColor: "#dc3545"
    },
    // ... other 7 employees
  ]
}
```

### Step 6: Dashboard UI Display

**Monitor View:**
```
┌─────────────────────────────┐
│   Currently IN (1)          │
├─────────────────────────────┤
│  azam                       │
│  SLOT 1                     │
│  08:30:15                   │
└─────────────────────────────┘
```

**Assessment View:**
```
┌────┬──────┬────────┬──────────┬──────────┬─────────┬────────────┬──────────────────────┬────────┐
│ #  │ Name │ Req Hr │ Curr Hr  │ Hr Short │ Pay Rate│ Income Due │ Potential Income     │ Status │
├────┼──────┼────────┼──────────┼──────────┼─────────┼────────────┼──────────────────────┼────────┤
│ 1  │ azam │  200   │   24.5   │  175.5   │ R70.00  │  R1715.00  │  R14000.00 (100%)   │Critical│
└────┴──────┴────────┴──────────┴──────────┴─────────┴────────────┴──────────────────────┴────────┘
```

## Data Sources Summary

| View | Primary Data Source | Update Speed | Fallback Source |
|------|---------------------|--------------|-----------------|
| Monitor | `status` collection | Real-time (< 1s) | None |
| Employees | `staff` + `status` | Real-time (< 1s) | None |
| Assessment | `assessment_cache` | Daily / Manual | Calculated from `attendance_events` |
| Timecard | `attendance_events` | On-demand query | None |

## Key Collections Explained

### 1. **attendance_events** (Source of Truth)
- ✅ Stores EVERY clock-in/out event
- ✅ Never deleted (historical record)
- ✅ Used for: timecard, assessment calculations, reports
- Structure: Flat collection (not nested by date)

### 2. **status** (Real-Time Monitoring)
- ✅ Current IN/OUT status for each employee
- ✅ Last clock time
- ✅ Updated on every clock-in/out
- ✅ Used for: Monitor view, employee cards

### 3. **staff** (Employee Master Data)
- ✅ Employee details: name, slot, pay rate, etc.
- ✅ Pulled from device via "Force Device Sync"
- ✅ Manually editable in Employees view
- ✅ Used for: All employee-related displays

### 4. **assessment_cache** (Performance Optimization)
- ✅ Pre-calculated monthly summaries
- ✅ Avoids expensive queries on every page load
- ✅ Recalculated: daily, on-demand, or manually
- ✅ Used for: Assessment view

## Network Flow Summary

```
Physical Device (Local)  →  VPS Relay (Public)  →  Firebase (Cloud)  →  Web App (Browser)
   192.168.7.4          →  69.62.109.168:7660   →  Firestore DB      →  Your Browser

   [Biometric Scan]  →  [XML Webhook]  →  [JSON API]  →  [Real-time Listeners]  →  [UI Update]
```

## Timing Breakdown

| Step | Description | Typical Time |
|------|-------------|--------------|
| 1 | Employee scans finger | < 1 second |
| 2 | Device → VPS webhook | 100-500ms |
| 3 | VPS → Cloud Function | 200-800ms |
| 4 | Cloud Function processing | 300-1000ms |
| 5 | Firestore write | 100-300ms |
| 6 | Real-time listener update | 200-500ms |
| **Total: Device to Dashboard** | **~1-3 seconds** |

## Error Handling & Duplicate Prevention

**Duplicate Detection:**
```javascript
// Check last clock status before allowing new punch
if (lastClockStatus === 'in' && newPunch === 'in') {
  // Store as mispunch for admin review
  type: 'duplicate_clock_in'
}
```

**Connection Failures:**
- Device retries webhook 3 times
- VPS queues failed forwards
- Cloud Function returns 500 = device will retry

## Admin Tools for Troubleshooting

1. **🔍 Debug Collections** - See what data exists
2. **🔄 Restore Employee Status** - Fix invalid dates
3. **🔄 Force Device Sync** - Pull employee roster from device
4. **📊 Recalculate Assessment** - Refresh cache manually
5. **⏰ View Shift Config** - Check shift schedules

---

## Known Issues & Fixes (Log)

### 1. Device ID Case-Sensitivity Bug (Fixed: 10 March 2026)
**Symptom:** Clock-in events arrive at Cloud Function but fail with "Device not registered to any business".  
**Root Cause:** `findBusinessByDeviceId()` uppercased the incoming `deviceId` (e.g. `"admin"` → `"ADMIN"`) before looking up the Firestore document. Firestore document IDs are **case-sensitive**, so if the device was registered with doc ID `admin` (lowercase), the lookup for `ADMIN` would fail.  
**Fix:** `findBusinessByDeviceId()` now checks all case variants (original, uppercase, lowercase) when looking up device documents. This ensures a match regardless of how the device was registered.  
**File:** `functions/index.js` — `findBusinessByDeviceId()`  
**Impact:** All device registrations now work regardless of case used during registration vs case sent by the device in events.

### 2. Assessment Cache Not Auto-Triggering (Fixed: 10 March 2026)
**Symptom:** Assessment cache wasn't recalculating when employees clocked in/out.  
**Root Cause:** `Promise.all(processPromises)` in `attendanceWebhook` threw on duplicate-punch errors, which prevented the cache recalculation code from executing.  
**Fix:** Changed to `Promise.allSettled(processPromises)` so the cache update runs even when some attendance writes fail (e.g. duplicate punches).  
**File:** `functions/index.js` — `attendanceWebhook` main handler  

### 3. Business Tracker Salaries Auto-Import (Added: 10 March 2026)
**Feature:** The "Salaries" expense row in Business Tracker Settings now auto-fills from Assessment's `totalPotentialPayroll` (100% attendance wage bill).  
**Details:** Row is read-only with "Auto" badge. Value refreshes from assessment cache on dashboard load and when assessment data changes.  
**Files:** `src/pages/business-dashboard.html` — `autoFillSalariesFromAssessment()`, `functions/cacheCalculation.js` — added `totalPotentialPayroll` to cache summary.

---

**Created:** February 9, 2026  
**Last Updated:** 10 March 2026  
**System:** AiClock (aiclock-82608)  
**Current Version:** Production with Admin Utilities
