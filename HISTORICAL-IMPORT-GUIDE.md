# 📋 Historical Events Import Guide

## Quick Import URL

For "speaker repairs" business with "hik1" device, use this URL format:

```
https://us-central1-aiclock-82608.cloudfunctions.net/manualDeviceSync?businessId=BUSINESS_ID&deviceId=hik1&action=importHistorical&ip=DEVICE_IP&username=admin&password=DEVICE_PASSWORD
```

Replace:
- `BUSINESS_ID` - Your actual business ID for "speaker repairs"
- `DEVICE_IP` - Your Hikvision device IP address (e.g., 192.168.1.100)
- `DEVICE_PASSWORD` - Your device admin password

## HTML Interface

Use the HTML interface at: `src/pages/historical-events-importer.html`

## What Gets Imported

✅ **Last 30 Days** of attendance events from the device
✅ **Employee Mapping** - Maps device employees to current AiClock slots by name
✅ **Proper Timestamps** - Preserves original event times
✅ **Duplicate Prevention** - Won't import events that already exist
✅ **Assessment Updates** - Automatically updates employee performance data

## Process Flow

1. **Connect** to Hikvision device via API
2. **Extract** historical events (last 30 days, up to 5000 events)
3. **Map Events** to current employee slots by name matching
4. **Import** to Firestore with proper structure
5. **Update** assessment cache and employee status

## Employee Mapping Logic

The system matches historical events to current employees by:

1. **Employee ID/Slot Number** (if available)
2. **Employee Name** (case-insensitive matching)

If an employee name from the device doesn't match any current employee in AiClock, that event will be skipped.

## Example Response

```json
{
  "success": true,
  "action": "importHistorical",
  "result": {
    "imported": 45,
    "total": 67,
    "results": [...]
  }
}
```

## Troubleshooting

- **"Device API responded with status 401"** → Check username/password
- **"Device API responded with status 404"** → Check IP address/port
- **"No historical events found"** → Device may have no stored events
- **Events skipped** → Employee names don't match between device and AiClock
