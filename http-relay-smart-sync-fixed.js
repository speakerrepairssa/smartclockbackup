/**
 * AiClock Smart Sync Relay Server v1.1
 * Receives HTTP webhooks from Hikvision devices and forwards to Firebase HTTPS endpoint
 * ENHANCED: After each webhook, queries device for historical events to recover missed data
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 7660; // Main webhook port
const FIREBASE_ENDPOINT = 'https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook';

// Device configuration with ISAPI credentials
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Sync cooldown tracking (5 minutes per device)
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const lastSyncTimes = new Map();

function log(message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data);
}

// Forward webhook to Firebase
function forwardToFirebase(data, deviceId, source = 'webhook') {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      deviceId: deviceId || 'unknown',
      timestamp: new Date().toISOString(),
      source: source,
      ...data
    });

    const options = {
      hostname: 'us-central1-aiclock-82608.cloudfunctions.net',
      port: 443,
      path: '/attendanceWebhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        log(`Firebase response (${source}):`, { 
          statusCode: res.statusCode, 
          data: responseData.substring(0, 200) 
        });
        resolve({ statusCode: res.statusCode, data: responseData });
      });
    });

    req.on('error', (error) => {
      log(`Firebase request error (${source}):`, error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Query device ISAPI endpoint for historical events
async function syncDeviceEvents(deviceId) {
  const device = DEVICES[deviceId];
  if (!device) {
    log('Device not found in configuration:', deviceId);
    return;
  }

  // Check cooldown
  const lastSync = lastSyncTimes.get(deviceId) || 0;
  const timeSinceLastSync = Date.now() - lastSync;
  
  if (timeSinceLastSync < SYNC_COOLDOWN_MS) {
    log('Sync skipped (cooldown active):', { 
      deviceId, 
      minutesRemaining: Math.ceil((SYNC_COOLDOWN_MS - timeSinceLastSync) / 60000) 
    });
    return;
  }

  log('Starting background sync for device:', deviceId);
  lastSyncTimes.set(deviceId, Date.now());

  try {
    // Query last 24 hours of events
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const startTime = yesterday.toISOString().replace(/\.\d{3}Z$/, '+00:00');
    const endTime = now.toISOString().replace(/\.\d{3}Z$/, '+00:00');
    
    const apiUrl = `http://${device.ip}/ISAPI/AccessControl/AcsEvent?format=json&startTime=${startTime}&endTime=${endTime}`;
    const auth = Buffer.from(`${device.username}:${device.password}`).toString('base64');

    log('Querying device API:', { deviceId, apiUrl: apiUrl.replace(/password=[^&]+/, 'password=***') });

    // Make HTTP request to device
    const url = new URL(apiUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'AiClock-SmartSync/1.1'
      },
      timeout: 10000
    };

    const deviceReq = http.request(options, (deviceRes) => {
      let eventData = '';
      
      deviceRes.on('data', (chunk) => {
        eventData += chunk;
      });
      
      deviceRes.on('end', async () => {
        try {
          if (deviceRes.statusCode !== 200) {
            log('Device API error:', { deviceId, statusCode: deviceRes.statusCode, data: eventData });
            return;
          }

          // Parse device response
          const events = JSON.parse(eventData);
          log('Device API response:', { deviceId, eventCount: events?.AcsEvent?.length || 0 });

          if (events.AcsEvent && Array.isArray(events.AcsEvent)) {
            let syncCount = 0;
            
            for (const event of events.AcsEvent) {
              try {
                // Convert device event to our format
                const syncEvent = {
                  deviceId: deviceId,
                  employeeId: event.employeeNoString || event.verifyNo || '1',
                  employeeName: event.name || `Employee ${event.employeeNoString}`,
                  attendanceStatus: event.attendanceStatus || 'in',
                  timestamp: event.time || new Date().toISOString(),
                  verifyNo: event.employeeNoString,
                  serialNo: event.serialNo
                };

                // Forward to Firebase with sync source
                await forwardToFirebase(syncEvent, deviceId, 'sync');
                syncCount++;
                
                // Small delay between events to avoid overwhelming Firebase
                await new Promise(resolve => setTimeout(resolve, 100));
                
              } catch (eventError) {
                log('Error processing sync event:', eventError.message);
              }
            }
            
            log('Background sync completed:', { deviceId, eventsProcessed: syncCount });
          }
          
        } catch (parseError) {
          log('Error parsing device response:', parseError.message);
        }
      });
    });

    deviceReq.on('error', (error) => {
      log('Device API connection error:', { deviceId, error: error.message });
    });

    deviceReq.on('timeout', () => {
      log('Device API timeout:', deviceId);
      deviceReq.destroy();
    });

    deviceReq.end();

  } catch (syncError) {
    log('Sync error:', { deviceId, error: syncError.message });
  }
}

// Main webhook server
const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('AiClock Relay v1.1 - Smart Sync Active\nStatus: Ready to receive webhooks\nPort: 7660\nFeatures: Real-time webhooks + 24h background sync');
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        log('Received webhook:', { 
          method: req.method,
          url: req.url,
          contentType: req.headers['content-type'],
          contentLength: req.headers['content-length'],
          bodyLength: body.length
        });

        // Parse the webhook data
        let data;
        if (req.headers['content-type']?.includes('application/json')) {
          data = JSON.parse(body);
        } else if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
          const urlParams = new URLSearchParams(body);
          data = Object.fromEntries(urlParams);
        } else {
          // Assume it's raw event log data from device
          data = { event_log: body };
        }

        // Extract device ID
        let deviceId = data.deviceId || data.deviceID || 'fc4349999'; // Default to main device
        
        // 1. Forward webhook immediately (real-time)
        await forwardToFirebase(data, deviceId, 'webhook');

        // 2. Trigger background sync (historical recovery)
        if (!data.testMode) {
          // Don't wait for sync - respond immediately
          setImmediate(() => syncDeviceEvents(deviceId));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Webhook received and forwarded. Background sync triggered.',
          deviceId: deviceId,
          timestamp: new Date().toISOString()
        }));

      } catch (error) {
        log('Error processing webhook:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: error.message 
        }));
      }
    });
  } else {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  log(`AiClock Smart Sync Relay v1.1 started on port ${PORT}`);
  log('Device configuration:', Object.keys(DEVICES));
  log(`Firebase endpoint: ${FIREBASE_ENDPOINT}`);
  log('Smart Sync Features:');
  log('  ✅ Real-time webhook forwarding');
  log('  ✅ 24-hour background sync after each webhook');  
  log('  ✅ 5-minute cooldown per device');
  log('  ✅ Automatic WiFi outage recovery');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down gracefully...');
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});