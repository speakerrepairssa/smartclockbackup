const http = require('http');
const https = require('https');
const axios = require('axios');

const PORT = 7661;
const FIREBASE_FUNCTION = 'https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

async function syncDeviceHistory(deviceId) {
  const device = DEVICES[deviceId.toLowerCase()];
  if (!device) {
    console.log(`No config for device: ${deviceId}`);
    return;
  }

  const now = Date.now();
  const lastSync = lastSyncTimes[deviceId] || 0;
  
  // Only sync if more than 5 minutes since last sync
  if (now - lastSync < 5 * 60 * 1000) {
    console.log(`Skipping sync for ${deviceId} - synced ${Math.floor((now - lastSync) / 1000)}s ago`);
    return;
  }

  console.log(`\n=== Starting sync for device ${deviceId} ===`);
  lastSyncTimes[deviceId] = now;

  try {
    // Get events from last 24 hours
    const endTime = new Date();
    const startTime = new Date(endTime - 24 * 60 * 60 * 1000);
    
    const startStr = startTime.toISOString().replace(/\.\d{3}Z$/, '+00:00');
    const endStr = endTime.toISOString().replace(/\.\d{3}Z$/, '+00:00');
    
    const url = `http://${device.ip}/ISAPI/AccessControl/AcsEvent?format=json&AcsEventCond.searchID=1&AcsEventCond.searchResultPosition=0&AcsEventCond.maxResults=100&AcsEventCond.major=5&AcsEventCond.minor=75&AcsEventCond.startTime=${startStr}&AcsEventCond.endTime=${endStr}`;
    
    console.log(`Querying device at: ${device.ip}`);
    
    const response = await axios.get(url, {
      auth: { username: device.username, password: device.password },
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    });

    if (response.data && response.data.AcsEvent) {
      const events = Array.isArray(response.data.AcsEvent.InfoList) 
        ? response.data.AcsEvent.InfoList 
        : [response.data.AcsEvent.InfoList];
      
      console.log(`Found ${events.length} events from device`);
      
      // Send each event to Firebase
      for (const event of events) {
        if (event && event.employeeNoString) {
          const payload = {
            deviceID: deviceId,
            deviceId: deviceId,
            employeeId: event.employeeNoString,
            serialNo: event.serialNo || '',
            timestamp: event.time || new Date().toISOString(),
            eventType: 'clock-in',
            source: 'sync'
          };

          try {
            await axios.post(FIREBASE_FUNCTION, payload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 5000
            });
            console.log(`✓ Synced event: Employee ${event.employeeNoString}`);
          } catch (err) {
            console.error(`✗ Failed to sync event: ${err.message}`);
          }
        }
      }
      
      console.log(`=== Sync complete for ${deviceId} ===\n`);
    }
  } catch (error) {
    console.error(`Sync error for ${deviceId}:`, error.message);
  }
}

const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      console.log('Received body length:', body.length);
      
      // Extract deviceId from body or headers
      let deviceId = 'unknown';
      try {
        // Try to parse as JSON first
        const jsonData = JSON.parse(body);
        deviceId = jsonData.deviceId || jsonData.deviceID || 'unknown';
      } catch (e) {
        // If not JSON, check content-type boundary
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=([^;,\s]+)/);
        if (boundaryMatch) {
          deviceId = boundaryMatch[1].replace(/^-+/, '').substring(0, 20);
        }
      }
      
      console.log(`Device: ${deviceId}`);
      
      // Forward to Firebase
      const firebaseUrl = new URL(FIREBASE_FUNCTION);
      const options = {
        hostname: firebaseUrl.hostname,
        port: 443,
        path: firebaseUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const proxyReq = https.request(options, (proxyRes) => {
        console.log(`Firebase response: ${proxyRes.statusCode}`);
        
        let responseBody = '';
        proxyRes.on('data', chunk => {
          responseBody += chunk;
        });
        
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          res.end(responseBody);
          
          // TRIGGER SYNC after forwarding webhook
          console.log('Triggering background sync...');
          syncDeviceHistory(deviceId).catch(err => {
            console.error('Background sync failed:', err.message);
          });
        });
      });

      proxyReq.on('error', (err) => {
        console.error('Firebase forward error:', err.message);
        res.writeHead(500);
        res.end('Error forwarding to Firebase');
      });

      proxyReq.write(body);
      proxyReq.end();
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('AiClock Relay v1.1 - Smart Sync Active (Port 7661)\n');
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 AiClock Smart Sync Relay running on port ${PORT}`);
  console.log(`Configured devices: ${Object.keys(DEVICES).join(', ')}`);
  console.log(`Sync window: Last 24 hours`);
  console.log(`Sync cooldown: 5 minutes\n`);
});
