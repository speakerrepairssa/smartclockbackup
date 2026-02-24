/**
 * Hikvision Webhook Receiver
 * Receives real-time events from DS-K1T341AM device
 * Device configured at: http://192.168.7.2/ISAPI/Event/notification/httpHosts
 */

const express = require('express');
const bodyParser = require('body-parser');
const xml2js = require('xml2js');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 7660;

// Parse XML and URL-encoded bodies
app.use(bodyParser.text({ type: 'text/xml' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://aiclock-5c365.firebaseio.com"
  });
}

const db = admin.firestore();

/**
 * Webhook endpoint - receives events from Hikvision device
 */
app.post('/hikvision/webhook', async (req, res) => {
  console.log('\n=== HIKVISION EVENT RECEIVED ===');
  console.log('Time:', new Date().toISOString());
  console.log('Content-Type:', req.headers['content-type']);
  
  try {
    let eventData;

    // Parse XML if sent as XML
    if (req.headers['content-type']?.includes('xml')) {
      const parser = new xml2js.Parser({ explicitArray: false });
      eventData = await parser.parseStringPromise(req.body);
      console.log('Parsed XML:', JSON.stringify(eventData, null, 2));
    } else {
      // Parse form data or JSON
      eventData = req.body;
      console.log('Parsed Data:', JSON.stringify(eventData, null, 2));
    }

    // Extract event info (format varies by device)
    const event = extractEventInfo(eventData);
    
    if (event) {
      console.log('Processed Event:', event);
      
      // Store in Firebase
      await storeEventInFirebase(event);
      console.log('✅ Event stored in Firebase');
    }

    // Always respond 200 OK
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing event:', error);
    res.status(200).send('OK'); // Still respond OK to device
  }
});

/**
 * Heartbeat endpoint
 */
app.post('/hikvision/heartbeat', (req, res) => {
  console.log('❤️  Heartbeat received at', new Date().toISOString());
  res.status(200).send('OK');
});

/**
 * Extract event info from Hikvision data structure
 */
function extractEventInfo(data) {
  try {
    // Hikvision sends events in various formats
    // Common structure: EventNotificationAlert
    const alert = data.EventNotificationAlert || data;
    
    const event = {
      eventType: alert.eventType || 'unknown',
      eventTime: alert.dateTime || alert.eventTime || new Date().toISOString(),
      deviceName: alert.deviceName || alert.ipAddress,
      employeeNo: alert.employeeNoString || alert.cardNo || null,
      cardNo: alert.cardReaderNo || null,
      major: alert.major || null,
      minor: alert.minor || null,
      rawData: alert
    };

    return event;
  } catch (error) {
    console.error('Error extracting event:', error);
    return null;
  }
}

/**
 * Store event in Firebase
 */
async function storeEventInFirebase(event) {
  const eventRef = db.collection('device_events').doc();
  
  await eventRef.set({
    deviceId: 'hikvision-192.168.7.2',
    eventType: event.eventType,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    eventTime: event.eventTime,
    employeeNo: event.employeeNo,
    cardNo: event.cardNo,
    major: event.major,
    minor: event.minor,
    rawData: event.rawData,
    processed: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Hikvision Webhook Receiver running on port ${PORT}`);
  console.log(`📡 Configure device to POST to: http://YOUR_SERVER_IP:${PORT}/hikvision/webhook`);
  console.log(`❤️  Heartbeat endpoint: http://YOUR_SERVER_IP:${PORT}/hikvision/heartbeat\n`);
});
