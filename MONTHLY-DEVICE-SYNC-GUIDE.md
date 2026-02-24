# 📅 Monthly Device Sync Guide

## Overview
This guide explains how to manually sync historical events from your Hikvision device for a specific month (e.g., February 2026) and import them as attendance records for all employees.

## Prerequisites

### 1. Hikvision Sync Service Must Be Running
The sync service must be running on your local machine or server:

```bash
cd hikvision-sync-service
node server.js
```

**Verify it's running:**
```bash
curl http://localhost:3002/health
```

Expected response: `{"status":"ok","timestamp":"..."}`

### 2. Employee Device IDs Must Be Configured
Each employee in Firebase must have their Hikvision device employee ID set. This is how the system matches device events to employees.

**In your employee records, ensure:**
- `deviceEmployeeId` field contains the employee's ID from the Hikvision device
- OR `employeeNumber` matches the device ID

**Example employee document:**
```javascript
{
  name: "Azam",
  deviceEmployeeId: "1",  // Must match employeeNoString from device
  employeeNumber: "1",    // Alternative field
  // ... other fields
}
```

## How to Use

### Step 1: Navigate to Device Sync Section
1. Log into your business dashboard
2. Click "🔄 Device Sync" in the left menu
3. Scroll down to the **"📅 Monthly Hikvision Device Sync"** card (purple gradient)

### Step 2: Configure Sync Parameters

**Required Fields:**
- **Device IP Address**: `192.168.7.2` (or your device IP)
- **Month**: Select the month (e.g., "February")
- **Year**: Enter the year (e.g., "2026")
- **Username**: `admin` (default)
- **Password**: Your device password

**Example for February 2026:**
```
Device IP: 192.168.7.2
Month: February
Year: 2026
Username: admin
Password: Azam198419880001
```

### Step 3: Click "📥 Sync Monthly Events"

The system will:
1. ✅ Connect to the local sync service
2. ✅ Extract all events from the device for that month
3. ✅ Match events to employees by device ID
4. ✅ Create attendance records in Firebase
5. ✅ Show summary of results

### Step 4: Review Results

You'll see a summary like:
```
✅ Monthly Sync Complete!

📅 Period: February 2026
📊 Total Events: 396
✅ Matched Employees: 380
❓ Unmatched: 16
📝 Records Created: 380
❌ Errors: 0
```

## What Gets Created

For each matched event, an `attendance_event` document is created:

```javascript
{
  employeeId: "emp123",
  employeeName: "Azam",
  businessId: "business123",
  timestamp: Timestamp(2026-02-15 09:30:00),
  date: "2026-02-15",
  eventType: "access_granted",  // or "access_denied", "unknown"
  source: "hikvision_device",
  deviceId: "192.168.7.2",
  deviceSerialNo: 145,
  rawEvent: { /* full device event data */ },
  syncedAt: Timestamp.now(),
  month: 2,
  year: 2026
}
```

## Event Types

Device event codes (minor field):
- `75` = Access Granted → `access_granted`
- `76` = Access Denied → `access_denied`
- Other = `unknown`

## Troubleshooting

### ❌ "Failed to connect to localhost port 3002"
**Solution:** Start the sync service:
```bash
cd hikvision-sync-service
node server.js &
```

### ❌ High number of unmatched events
**Solution:** Configure device IDs for your employees:
1. Go to Employees section
2. Edit each employee
3. Add their `deviceEmployeeId` matching the Hikvision device

To find device IDs, check the raw events:
```bash
curl "http://localhost:3002/device/sync-month?ip=192.168.7.2&username=admin&password=Azam198419880001&month=2&year=2026" | grep employeeNoString
```

### ❌ "Device credentials missing"
**Solution:** Verify device IP, username, and password are correct. Test with:
```bash
curl -s --digest -u admin:YOUR_PASSWORD \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"AcsEventCond":{"searchID":"1","searchResultPosition":0,"maxResults":10,"major":5,"minor":0}}' \
  "http://192.168.7.2/ISAPI/AccessControl/AcsEvent?format=json"
```

### ❌ Events from 1970 are ignored
This is normal - the device returns some events with timestamp `1970-01-01` which are invalid and automatically filtered out.

## Performance

- **Small months** (100-200 events): ~5-10 seconds
- **Large months** (1000+ events): ~30-60 seconds
- The system processes all device events to filter by month
- Progress updates show status during sync

## Best Practices

1. **Run monthly syncs once per month** - on the 1st of the next month (e.g., sync February on March 1st)

2. **Verify employee IDs first** - before syncing, ensure all employees have device IDs configured

3. **Test with one month** - don't sync multiple months at once, do them one by one

4. **Check results** - after sync, verify attendance records were created correctly

5. **Keep sync service running** - consider running it as a background service or on a server

## Automation (Future)

You can automate monthly syncs by:

1. **Cloud Function approach:**
   - Create a Firebase Cloud Function
   - Trigger on Cloud Scheduler (1st of each month)
   - Call sync service endpoint
   - Process and store events

2. **Cron job approach:**
   - Run sync service on server
   - Create bash script to call endpoint
   - Schedule with cron: `0 2 1 * * /path/to/sync-script.sh`

## Technical Details

**Sync Service Endpoint:**
```
GET http://localhost:3002/device/sync-month?ip={IP}&username={USER}&password={PASS}&month={M}&year={Y}
```

**Response Format:**
```json
{
  "total_events_found": 396,
  "pagination": {
    "status": "completed",
    "pages_fetched": 47,
    "total_matches": 1390
  },
  "events": [...]
}
```

**Collection Path:**
```
businesses/{businessId}/attendance_events/{eventId}
```

## Support

For issues or questions, check:
- [HIKVISION-EVENT-EXTRACTION-SUCCESS.md](./HIKVISION-EVENT-EXTRACTION-SUCCESS.md) - Complete API documentation
- Sync service logs: Check terminal where `node server.js` is running
- Browser console: F12 → Console tab for detailed errors

---

**Last Updated:** February 24, 2026
