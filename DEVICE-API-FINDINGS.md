# 📊 Hikvision DS-K1T341AM API Findings

## Device Information
- **Model:** DS-K1T341AM
- **Serial:** G04425941  
- **Firmware:** V3.2.30 (build 210406)
- **IP:** 192.168.7.2

## ✅ Working Endpoints

###  1. Device Info
```bash
curl --digest -u admin:password "http://192.168.7.2/ISAPI/System/deviceInfo?format=json"
```
✅ Returns device details, model, firmware version

### 2. User Count
```bash
curl --digest -u admin:password "http://192.168.7.2/ISAPI/AccessControl/UserInfo/Count?format=json"
```
✅ Returns: `{"userNumber": 16}`

### 3. Capabilities
```bash
curl --digest -u admin:password "http://192.168.7.2/ISAPI/AccessControl/capabilities"
```
✅ Returns XML showing supported features including:
- `<isSupportAcsEvent>true</isSupportAcsEvent>`
- `<isSupportUserDataExport>true</isSupportUserDataExport>`
- `<isSupportMaintenanceDataExport>true</isSupportMaintenanceDataExport>`

### 4. Work Status
```bash
curl --digest -u admin:password "http://192.168.7.2/ISAPI/AccessControl/AcsWorkStatus?format=json"
```
✅ Returns current door/card reader status (but NOT historical events)

### 5. Card Info Capabilities
```bash
curl --digest -u admin:password "http://192.168.7.2/ISAPI/AccessControl/CardInfo/capabilities?format=json"
```
✅ Returns card system capabilities

## ❌ NOT Working (Historical Events)

### AcsEvent Endpoint
```bash
# All of these FAIL:
curl --digest -u admin:password "http://192.168.7.2/ISAPI/AccessControl/AcsEvent?format=json"
# Error: "methodNotAllowed"

curl --digest -u admin:password -X POST \
  -H "Content-Type: application/xml" \
  -d '<AcsEventCond><searchID>1</searchID><maxResults>50</maxResults></AcsEventCond>' \
  "http://192.168.7.2/ISAPI/AccessControl/AcsEvent"
# Error: "Invalid Format" (badJson Format)
```

### Event Total Number
```bash
curl --digest -u admin:password "http://192.168.7.2/ISAPI/AccessControl/AcsEventTotalNum?format=json"
# Error: "methodNotAllowed"
```

### Data Export
```bash
curl --digest -u admin:password "http://192.168.7.2/ISAPI/AccessControl/UserData/Export?format=json"
# Error: "notSupport"
```

## 🔍 Analysis

### The Problem
Even though the device **claims** to support `AcsEvent` in its capabilities, all attempts to retrieve historical events fail with:
- "methodNotAllowed" errors (GET requests)
- "Invalid Format" errors (POST requests with various XML formats)

### Possible Reasons
1. **Firmware limitation:** V3.2.30 (2021) may not fully support the AcsEvent API
2. **Real-time only:** Device might only support real-time event streaming, not historical retrieval
3. **Different API:** Older firmware might use a proprietary/undocumented API format
4. **Web interface only:** Events might only be accessible via the device's web UI
5. **Client software required:** May need Hikvision iVMS-4200 or IVMS-4500 client

## 💡 Alternative Solutions

### Option 1: Real-Time Event Notifications (Webhook)
Set up the device to POST events to your server in real-time:
```bash
# Configure HTTP notification (would need to be done via web interface typically)
# Device sends events to: http://your-server/events/notification
```

### Option 2: Web Interface Export
1. Access device web interface: `http://192.168.7.2`
2. Login with admin credentials
3. Navigate to: Configuration → Event → Access Control Event
4. Export event logs manually

### Option 3: iVMS-4200 Client Software
1. Download Hikvision iVMS-4200 Client
2. Add device to client
3. View attendance/access logs
4. Export to CSV/Excel

### Option 4: SDK Integration  
Use Hikvision's Device Network SDK for programmatic access (requires C/C++ development)

### Option 5: Direct Database Access
If device has SD card, events might be stored in SQLite database that could be accessed directly (requires physical access or network file sharing)

## ❓ What Worked in the YouTube Video?

**Please tell me:**
- What method did the video show for getting events?
- Was it using:
  - Web interface export?
  - iVMS client software?
  - A specific API call that worked?
  - Direct file access?
  - Something else?

This will help me implement the correct solution!

## 🚀 Next Steps

Once we know what method works, I can:
1. Update the `hikvision-sync-service` with the correct API
2. Create extraction scripts using the working method
3. Set up automated event collection
4. Integrate with Firebase for real-time sync
