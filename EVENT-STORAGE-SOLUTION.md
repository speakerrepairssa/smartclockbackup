# DS-K1T341AM Event Storage Solution

## The Problem
The DS-K1T341AM (Firmware V3.2.30) **does NOT support retrieving historical events via API**.

- `ISAPI/AccessControl/AcsEvent` - ❌ methodNotAllowed
- All export endpoints - ❌ notSupport
- Event storage endpoints - ❌ notSupport

## The Solution: Real-Time Webhooks ✅

The device **DOES support** real-time event notifications via HTTP POST.

### Current Configuration
Your device is already configured:
```xml
<url>http://69.62.109.168:7660/fc4349998-webhook</url>
<eventMode>all</eventMode>
<heartbeat>30</heartbeat>
```

Events are being POSTed to `69.62.109.168:7660` as they happen!

## Option 1: Use Existing Webhook

**If `69.62.109.168:7660` is your server:**
1. Check logs/database on that server
2. Events are already being sent there in real-time

## Option 2: Set Up New Webhook (Capture Events Yourself)

### Step 1: Install Dependencies
```bash
npm install express body-parser xml2js
```

### Step 2: Start Webhook Receiver
```bash
node hikvision-webhook-receiver.js
```

This starts a server on port 7660 that receives events and stores them in Firebase.

### Step 3: Configure Device
Edit `configure-hikvision-webhook.sh`:
```bash
YOUR_SERVER_IP="YOUR_PUBLIC_IP"  # Your server's public IP
```

Then run:
```bash
./configure-hikvision-webhook.sh
```

### Step 4: Test
1. Clock in/out on the device
2. Check console logs of webhook receiver
3. Verify events appear in Firebase `device_events` collection

## Event Data Structure

The device sends events in XML format:
```xml
<EventNotificationAlert>
  <eventType>AccessControl</eventType>
  <dateTime>2026-02-24T10:30:00Z</dateTime>
  <employeeNoString>12345</employeeNoString>
  <cardNo>8000012345</cardNo>
  <major>5</major>
  <minor>75</minor>
</EventNotificationAlert>
```

Stored in Firebase as:
```javascript
{
  deviceId: 'hikvision-192.168.7.2',
  eventType: 'AccessControl',
  timestamp: Timestamp,
  employeeNo: '12345',
  cardNo: '8000012345',
  major: 5,
  minor: 75,
  processed: false
}
```

## Event Type Codes

| Major | Minor | Description |
|-------|-------|-------------|
| 5 | 75 | Access granted (valid card) |
| 5 | 76 | Access denied (invalid card) |
| 5 | 77 | Door forced open |
| 5 | 78 | Door left open alarm |

## Historical Events

**Important:** This solution only captures events **going forward**. 

For historical events stored on the device:
1. **Web UI Export:** Login to http://192.168.7.2 → Event Management → Export CSV
2. **iVMS-4200 Client:** Install Hikvision client software and export from there
3. **Manual Import:** Use the exported CSV to import into Firebase

## Troubleshooting

### No events received?
```bash
# Check device configuration
curl -s --digest -u admin:Azam198419880001 \
  "http://192.168.7.2/ISAPI/Event/notification/httpHosts"
```

### Firewall blocking?
Ensure port 7660 is open:
```bash
sudo ufw allow 7660/tcp
```

### Check device reachability
```bash
ping 192.168.7.2
curl -s --digest -u admin:Azam198419880001 \
  "http://192.168.7.2/ISAPI/System/deviceInfo?format=json"
```

## Next Steps

1. **Start webhook receiver** to capture new events
2. **Export historical events** via web UI for past data
3. **Integrate with attendance system** to process events
4. **Monitor webhook receiver** logs to ensure reliability

## Files Created

- `hikvision-webhook-receiver.js` - Express server to receive events
- `configure-hikvision-webhook.sh` - Script to configure device
- `EVENT-STORAGE-SOLUTION.md` - This documentation
