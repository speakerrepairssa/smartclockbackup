# Configure Hikvision Camera for Real Event Integration

## Current Status
✅ **Sync Service Running**: http://localhost:3002  
✅ **Webhook Endpoints Ready**: Real event collection configured  
✅ **Device Authentication**: Working with admin/Azam198419880001  

## Camera Configuration Steps

### Option 1: HTTP Event Notifications (Recommended)

1. **Access Camera Web Interface**:
   - Open browser: `https://192.168.0.114`
   - Login: admin / Azam198419880001

2. **Navigate to Event Configuration**:
   ```
   Configuration → Network → Advanced Settings → Integration Protocol
   ```
   OR
   ```
   Configuration → Event → Basic Event → Access Control
   ```

3. **Configure HTTP Notification**:
   - **Enable HTTP Notification**: ✅ On
   - **Notification URL**: `http://YOUR_COMPUTER_IP:3002/events/notification`
   - **Method**: POST
   - **Content Type**: application/json
   - **Authentication**: None (or Basic if required)

4. **Event Types to Enable**:
   - Access Control Events
   - Card Swiped Events  
   - Door Open/Close Events
   - Motion Detection (if needed)

### Option 2: Alternative Integration Methods

#### A) ISAPI Event Streaming
If your camera supports event streaming:
```bash
# Test ISAPI event endpoint
curl -k -u admin:Azam198419880001 \
  "https://192.168.0.114/ISAPI/Event/notification/alertStream"
```

#### B) Manual Event Trigger Test
Test the webhook with a simulated camera event:
```bash
curl -X POST http://localhost:3002/events/notification \
  -H "Content-Type: application/json" \
  -d '{
    "EventType": "AccessControl",
    "DateTime": "2024-02-01T10:20:00Z",
    "CardNo": "12345678",
    "Result": "Valid",
    "Door": "Main Entrance"
  }'
```

### Option 3: XML Event Format
Some cameras send XML events:
```bash
curl -X POST http://localhost:3002/events/xml \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<EventNotificationAlert>
  <eventType>AccessControl</eventType>
  <dateTime>2024-02-01T10:20:00Z</dateTime>
  <cardNo>12345678</cardNo>
</EventNotificationAlert>'
```

## Available Webhook Endpoints

- **JSON Events**: `POST /events/notification`
- **XML Events**: `POST /events/xml` 
- **Health Check**: `GET /health`
- **View Events**: `GET /device/events?ip=192.168.0.114`

## Testing Real Events

1. **Configure camera webhook** (see above)
2. **Trigger access event** on your camera
3. **Check dashboard** - you should see real events marked as "REAL_CAMERA"
4. **View logs**: Check terminal for webhook requests

## Troubleshooting

### Camera Can't Reach Webhook
- Make sure your computer IP is accessible from camera network
- Try webhook URL: `http://[YOUR_IP]:3002/events/notification`
- Check firewall settings

### No Events Received
- Verify camera event configuration
- Check camera network settings
- Test with manual curl command first

### Events Still Show as Demo
- Real events will show source: "REAL_CAMERA"
- Demo events show source: "SIMULATED_DEMO"
- Check webhook logs for incoming requests

## Next Steps

1. **Try Option 1 first**: Configure HTTP notification in camera
2. **Test with curl**: Verify webhook is working
3. **Configure camera**: Set up actual event triggers
4. **Monitor dashboard**: Real events should appear

The PDF document you provided likely contains specific configuration steps for your camera model. Review it for:
- Exact menu paths for your camera interface
- Supported notification formats
- Authentication requirements
- Event type configurations