# 🎯 Hikvision Event Sync Documentation

## Overview
This script connects directly to your Hikvision devices via HTTP API to pull all attendance events. Perfect for:
- **Backup verification** of webhook data
- **Historical data retrieval** for reporting  
- **Manual sync** when webhooks fail
- **Comprehensive event logging** to spreadsheets

## Quick Start

### 1. Configure Device Settings
Edit `hikvision-event-sync.js` and update:

```javascript
devices: [
  {
    id: 'FC4349999',
    name: 'Terminal 1', 
    ip: '192.168.7.4',
    username: 'admin',
    password: 'your_actual_password' // ⚠️ UPDATE THIS
  },
  {
    id: 'FC4349998',
    name: 'Terminal 2',
    ip: '192.168.7.5', 
    username: 'admin',
    password: 'your_actual_password' // ⚠️ UPDATE THIS
  }
]
```

### 2. Run the Sync

#### Option A: Interactive Menu
```bash
./sync-events.sh
```
- Choose from preset date ranges
- Automatically generates CSV/JSON files

#### Option B: Direct Node.js
```bash
node hikvision-event-sync.js
```

#### Option C: Custom Date Range
```bash
# Sync specific month
START_DATE="2026-01-01" END_DATE="2026-01-31" node hikvision-event-sync.js
```

## Output Files

### 📊 CSV File (`hikvision-events.csv`)
Perfect for Excel/Google Sheets:
```
Date,Time,Device ID,Device Name,Employee ID,Employee Name,Action,Event Type,Timestamp
2026-01-27,11:40:00,FC4349999,Terminal 1,1,Employee 1,IN,1,2026-01-27T11:40:00
2026-01-27,14:27:00,FC4349999,Terminal 1,1,Employee 1,OUT,2,2026-01-27T14:27:00
```

### 📋 JSON File (`hikvision-events.json`)
Raw data with metadata:
```json
{
  "exportDate": "2026-01-28T10:30:00Z",
  "totalEvents": 156,
  "dateRange": { "startDate": "2026-01-01", "endDate": "2026-01-31" },
  "events": [...]
}
```

### 🔥 Firebase Import (`firebase-import.json`)
Ready for Firebase import:
```json
[
  {
    "businessId": "your_business_id",
    "employeeId": "1", 
    "timestamp": "2026-01-27T11:40:00",
    "type": "clock-in",
    "source": "hikvision-sync"
  }
]
```

## Hikvision API Endpoints

### 🔐 Authentication
Uses HTTP Basic Auth:
```
Authorization: Basic base64(username:password)
```

### 📥 Event Retrieval Endpoint
```
POST http://192.168.7.4/ISAPI/AccessControl/AcsEvent
Content-Type: application/xml

<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond>
    <searchID>1</searchID>
    <maxResults>1000</maxResults>
    <startTime>2026-01-01T00:00:00</startTime>
    <endTime>2026-01-31T23:59:59</endTime>
    <major>5</major>
    <minor>75</minor>
</AcsEventCond>
```

### 📱 Device Info (Connection Test)
```
GET http://192.168.7.4/ISAPI/System/deviceInfo
```

## Event Types Mapping

| Hikvision Type | Our Format | Description |
|----------------|------------|-------------|
| `1` | `clock-in` | Employee clocking in |
| `2` | `clock-out` | Employee clocking out |
| `checkIn` | `clock-in` | Alternative format |
| `checkOut` | `clock-out` | Alternative format |

## Advanced Usage

### 🔄 Automated Daily Sync
Add to crontab for daily backups:
```bash
# Run every day at 11:30 PM
30 23 * * * cd /path/to/aiclock && ./sync-events.sh
```

### 🔧 Custom Configuration
Modify `CONFIG` object in script:
```javascript
const CONFIG = {
  dateRange: {
    startDate: '2026-01-01',
    endDate: '2026-01-31' 
  },
  output: {
    console: true,     // Print events to console
    csvFile: true,     // Generate CSV file
    jsonFile: true,    // Generate JSON file  
    firebaseSync: false // Sync to Firebase
  }
};
```

### 📊 Integration with Google Sheets
1. Generate CSV file with script
2. Upload to Google Sheets
3. Use formulas for attendance calculations

### 🔥 Firebase Integration
To sync directly to Firebase:
1. Install Firebase Admin SDK: `npm install firebase-admin`
2. Add your Firebase service account key
3. Set `firebaseSync: true` in config

## Troubleshooting

### ❌ Authentication Failed
- Check device IP addresses
- Verify username/password
- Ensure devices are accessible on network

### ❌ No Events Found
- Check date range (devices may not have data for selected dates)
- Verify device time/timezone settings
- Try smaller date ranges

### ❌ XML Parsing Errors  
- Device may be using different XML format
- Check device firmware version
- Enable raw XML logging for debugging

### ❌ Network Timeouts
- Devices may be slow or have network issues
- Increase timeout values in script
- Try smaller batch sizes

## Security Notes

⚠️ **Important**: 
- Never commit device passwords to version control
- Use environment variables for sensitive data
- Ensure devices are on secure network
- Consider VPN for remote access

## Use Cases

### 📋 Daily Backup
```bash
# Get yesterday's events
./sync-events.sh
# Choose option 4 (today) and adjust date
```

### 📊 Monthly Reports  
```bash
# Get full month for payroll
./sync-events.sh
# Choose option 2 (last 30 days)
```

### 🔍 Event Verification
```bash
# Compare with webhook data
node hikvision-event-sync.js
# Cross-reference with Firebase events
```

### 📈 Analytics
- Import CSV to Excel/Google Sheets
- Create pivot tables for attendance patterns
- Generate monthly/weekly reports
- Track punctuality trends

This gives you complete control over your attendance data with direct device access! 🎉