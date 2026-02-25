# Code Citations

## License: unknown
https://github.com/UPS-CS240-F12/WebServerGroup/blob/2ceed61b553a26821e5d44ea62f91983d959c231/json_server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type
```


## License: unknown
https://github.com/UPS-CS240-F12/WebServerGroup/blob/2ceed61b553a26821e5d44ea62f91983d959c231/json_server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type
```


## License: unknown
https://github.com/UPS-CS240-F12/WebServerGroup/blob/2ceed61b553a26821e5d44ea62f91983d959c231/json_server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type
```


## License: unknown
https://github.com/UPS-CS240-F12/WebServerGroup/blob/2ceed61b553a26821e5d44ea62f91983d959c231/json_server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type
```


## License: unknown
https://github.com/UPS-CS240-F12/WebServerGroup/blob/2ceed61b553a26821e5d44ea62f91983d959c231/json_server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type
```


## License: unknown
https://github.com/UPS-CS240-F12/WebServerGroup/blob/2ceed61b553a26821e5d44ea62f91983d959c231/json_server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type
```


## License: unknown
https://github.com/UPS-CS240-F12/WebServerGroup/blob/2ceed61b553a26821e5d44ea62f91983d959c231/json_server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type
```


## License: unknown
https://github.com/UPS-CS240-F12/WebServerGroup/blob/2ceed61b553a26821e5d44ea62f91983d959c231/json_server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      
```


## License: unknown
https://github.com/abhishekchouhannk/COMP4537/blob/4eabdaa0eef4c5830f0087731797c42684dd12ba/COMP4537/Lab4/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
```


## License: unknown
https://github.com/abhishekchouhannk/COMP4537/blob/4eabdaa0eef4c5830f0087731797c42684dd12ba/COMP4537/Lab4/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
```


## License: unknown
https://github.com/abhishekchouhannk/COMP4537/blob/4eabdaa0eef4c5830f0087731797c42684dd12ba/COMP4537/Lab4/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
```


## License: unknown
https://github.com/abhishekchouhannk/COMP4537/blob/4eabdaa0eef4c5830f0087731797c42684dd12ba/COMP4537/Lab4/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
```


## License: unknown
https://github.com/abhishekchouhannk/COMP4537/blob/4eabdaa0eef4c5830f0087731797c42684dd12ba/COMP4537/Lab4/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
```


## License: unknown
https://github.com/abhishekchouhannk/COMP4537/blob/4eabdaa0eef4c5830f0087731797c42684dd12ba/COMP4537/Lab4/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
```


## License: unknown
https://github.com/abhishekchouhannk/COMP4537/blob/4eabdaa0eef4c5830f0087731797c42684dd12ba/COMP4537/Lab4/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
```


## License: MIT
https://github.com/NPM8/xpath/blob/1458ea9315b74b21aff4efee2aafd187579ad3d9/routes/api.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console
```


## License: MIT
https://github.com/NPM8/xpath/blob/1458ea9315b74b21aff4efee2aafd187579ad3d9/routes/api.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console
```


## License: MIT
https://github.com/NPM8/xpath/blob/1458ea9315b74b21aff4efee2aafd187579ad3d9/routes/api.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console
```


## License: MIT
https://github.com/NPM8/xpath/blob/1458ea9315b74b21aff4efee2aafd187579ad3d9/routes/api.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console
```


## License: MIT
https://github.com/NPM8/xpath/blob/1458ea9315b74b21aff4efee2aafd187579ad3d9/routes/api.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console
```


## License: MIT
https://github.com/NPM8/xpath/blob/1458ea9315b74b21aff4efee2aafd187579ad3d9/routes/api.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console
```


## License: MIT
https://github.com/NPM8/xpath/blob/1458ea9315b74b21aff4efee2aafd187579ad3d9/routes/api.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console
```


## License: MIT
https://github.com/NPM8/xpath/blob/1458ea9315b74b21aff4efee2aafd187579ad3d9/routes/api.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console
```


## License: MIT
https://github.com/NPM8/xpath/blob/1458ea9315b74b21aff4efee2aafd187579ad3d9/routes/api.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console
```


## License: GPL-3.0
https://github.com/jjthug/autorouter/blob/47b59c7e9f8849d27027fe3ff4300b0b7f2422c2/riverexTestServer/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console.log('Raw body length:', body.length);
        
        // Extract device ID from URL (/fc4349999-webhook)
        const match = req.url.match(/^\/([^-]+)-webhook/);
        const deviceId = match ? match[1] : null;
        
        if (!deviceId) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Invalid webhook URL - expected format: /{deviceId}-webhook');
          return;
        }
        
        console.log(`Webhook for device: ${deviceId}`);
        
        // Parse multipart or JSON body
        let eventData = {};
        
        if (req.headers['content-type']?.includes('multipart/form-data')) {
          // For multipart, extract event_log field
          const eventLogMatch = body.match(/name="event_log"[\r\n]+([^\r\n-]+)/);
          if (eventLogMatch) {
            try {
              eventData = JSON.parse(eventLogMatch[1].trim());
              console.log('Parsed event_log:', JSON.stringify(eventData).substring(0, 200));
            } catch (e) {
              console.error('Failed to parse event_log JSON:', e.message);
            }
          }
        } else {
          // JSON body
          eventData = JSON.parse(body);
        }
        
        // Extract employee info
        const accessEvent = eventData.AccessControllerEvent || {};
        const employeeNo = accessEvent.employeeNoString || accessEvent.verifyNo;
        const timestamp = accessEvent.time || new Date().toISOString();
        const serialNo = accessEvent.serialNo || '';
        
        if (employeeNo) {
          // Forward to Firebase Cloud Function
          const payload = {
            deviceID: deviceId,
            deviceId: deviceId,
            employeeId: employeeNo,
            serialNo: serialNo,
            timestamp: timestamp,
            eventType: 'clock-in',
            source: 'webhook',
            rawEvent: eventData
          };
          
          console.log(`Forwarding to Firebase: Employee ${employeeNo}`);
          
          try {
            const response = await axios.post(FIREBASE_FUNCTION, payload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000
            });
            
            console.log('✓ Firebase response:', response.status);
            
            // Trigger background sync for this device
            setTimeout(() => syncDeviceHistory(deviceId), 1000);
            
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
          } catch (err) {
            console.error('✗ Firebase error:', err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Firebase error');
          }
        } else {
          console.log('No employee data in webhook');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
        }
        
      } catch (error) {
        console.error('Webhook error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error');
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n
```


## License: GPL-3.0
https://github.com/jjthug/autorouter/blob/47b59c7e9f8849d27027fe3ff4300b0b7f2422c2/riverexTestServer/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console.log('Raw body length:', body.length);
        
        // Extract device ID from URL (/fc4349999-webhook)
        const match = req.url.match(/^\/([^-]+)-webhook/);
        const deviceId = match ? match[1] : null;
        
        if (!deviceId) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Invalid webhook URL - expected format: /{deviceId}-webhook');
          return;
        }
        
        console.log(`Webhook for device: ${deviceId}`);
        
        // Parse multipart or JSON body
        let eventData = {};
        
        if (req.headers['content-type']?.includes('multipart/form-data')) {
          // For multipart, extract event_log field
          const eventLogMatch = body.match(/name="event_log"[\r\n]+([^\r\n-]+)/);
          if (eventLogMatch) {
            try {
              eventData = JSON.parse(eventLogMatch[1].trim());
              console.log('Parsed event_log:', JSON.stringify(eventData).substring(0, 200));
            } catch (e) {
              console.error('Failed to parse event_log JSON:', e.message);
            }
          }
        } else {
          // JSON body
          eventData = JSON.parse(body);
        }
        
        // Extract employee info
        const accessEvent = eventData.AccessControllerEvent || {};
        const employeeNo = accessEvent.employeeNoString || accessEvent.verifyNo;
        const timestamp = accessEvent.time || new Date().toISOString();
        const serialNo = accessEvent.serialNo || '';
        
        if (employeeNo) {
          // Forward to Firebase Cloud Function
          const payload = {
            deviceID: deviceId,
            deviceId: deviceId,
            employeeId: employeeNo,
            serialNo: serialNo,
            timestamp: timestamp,
            eventType: 'clock-in',
            source: 'webhook',
            rawEvent: eventData
          };
          
          console.log(`Forwarding to Firebase: Employee ${employeeNo}`);
          
          try {
            const response = await axios.post(FIREBASE_FUNCTION, payload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000
            });
            
            console.log('✓ Firebase response:', response.status);
            
            // Trigger background sync for this device
            setTimeout(() => syncDeviceHistory(deviceId), 1000);
            
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
          } catch (err) {
            console.error('✗ Firebase error:', err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Firebase error');
          }
        } else {
          console.log('No employee data in webhook');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
        }
        
      } catch (error) {
        console.error('Webhook error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error');
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n
```


## License: GPL-3.0
https://github.com/jjthug/autorouter/blob/47b59c7e9f8849d27027fe3ff4300b0b7f2422c2/riverexTestServer/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console.log('Raw body length:', body.length);
        
        // Extract device ID from URL (/fc4349999-webhook)
        const match = req.url.match(/^\/([^-]+)-webhook/);
        const deviceId = match ? match[1] : null;
        
        if (!deviceId) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Invalid webhook URL - expected format: /{deviceId}-webhook');
          return;
        }
        
        console.log(`Webhook for device: ${deviceId}`);
        
        // Parse multipart or JSON body
        let eventData = {};
        
        if (req.headers['content-type']?.includes('multipart/form-data')) {
          // For multipart, extract event_log field
          const eventLogMatch = body.match(/name="event_log"[\r\n]+([^\r\n-]+)/);
          if (eventLogMatch) {
            try {
              eventData = JSON.parse(eventLogMatch[1].trim());
              console.log('Parsed event_log:', JSON.stringify(eventData).substring(0, 200));
            } catch (e) {
              console.error('Failed to parse event_log JSON:', e.message);
            }
          }
        } else {
          // JSON body
          eventData = JSON.parse(body);
        }
        
        // Extract employee info
        const accessEvent = eventData.AccessControllerEvent || {};
        const employeeNo = accessEvent.employeeNoString || accessEvent.verifyNo;
        const timestamp = accessEvent.time || new Date().toISOString();
        const serialNo = accessEvent.serialNo || '';
        
        if (employeeNo) {
          // Forward to Firebase Cloud Function
          const payload = {
            deviceID: deviceId,
            deviceId: deviceId,
            employeeId: employeeNo,
            serialNo: serialNo,
            timestamp: timestamp,
            eventType: 'clock-in',
            source: 'webhook',
            rawEvent: eventData
          };
          
          console.log(`Forwarding to Firebase: Employee ${employeeNo}`);
          
          try {
            const response = await axios.post(FIREBASE_FUNCTION, payload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000
            });
            
            console.log('✓ Firebase response:', response.status);
            
            // Trigger background sync for this device
            setTimeout(() => syncDeviceHistory(deviceId), 1000);
            
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
          } catch (err) {
            console.error('✗ Firebase error:', err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Firebase error');
          }
        } else {
          console.log('No employee data in webhook');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
        }
        
      } catch (error) {
        console.error('Webhook error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error');
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n
```


## License: GPL-3.0
https://github.com/jjthug/autorouter/blob/47b59c7e9f8849d27027fe3ff4300b0b7f2422c2/riverexTestServer/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console.log('Raw body length:', body.length);
        
        // Extract device ID from URL (/fc4349999-webhook)
        const match = req.url.match(/^\/([^-]+)-webhook/);
        const deviceId = match ? match[1] : null;
        
        if (!deviceId) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Invalid webhook URL - expected format: /{deviceId}-webhook');
          return;
        }
        
        console.log(`Webhook for device: ${deviceId}`);
        
        // Parse multipart or JSON body
        let eventData = {};
        
        if (req.headers['content-type']?.includes('multipart/form-data')) {
          // For multipart, extract event_log field
          const eventLogMatch = body.match(/name="event_log"[\r\n]+([^\r\n-]+)/);
          if (eventLogMatch) {
            try {
              eventData = JSON.parse(eventLogMatch[1].trim());
              console.log('Parsed event_log:', JSON.stringify(eventData).substring(0, 200));
            } catch (e) {
              console.error('Failed to parse event_log JSON:', e.message);
            }
          }
        } else {
          // JSON body
          eventData = JSON.parse(body);
        }
        
        // Extract employee info
        const accessEvent = eventData.AccessControllerEvent || {};
        const employeeNo = accessEvent.employeeNoString || accessEvent.verifyNo;
        const timestamp = accessEvent.time || new Date().toISOString();
        const serialNo = accessEvent.serialNo || '';
        
        if (employeeNo) {
          // Forward to Firebase Cloud Function
          const payload = {
            deviceID: deviceId,
            deviceId: deviceId,
            employeeId: employeeNo,
            serialNo: serialNo,
            timestamp: timestamp,
            eventType: 'clock-in',
            source: 'webhook',
            rawEvent: eventData
          };
          
          console.log(`Forwarding to Firebase: Employee ${employeeNo}`);
          
          try {
            const response = await axios.post(FIREBASE_FUNCTION, payload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000
            });
            
            console.log('✓ Firebase response:', response.status);
            
            // Trigger background sync for this device
            setTimeout(() => syncDeviceHistory(deviceId), 1000);
            
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
          } catch (err) {
            console.error('✗ Firebase error:', err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Firebase error');
          }
        } else {
          console.log('No employee data in webhook');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
        }
        
      } catch (error) {
        console.error('Webhook error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error');
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n
```


## License: GPL-3.0
https://github.com/jjthug/autorouter/blob/47b59c7e9f8849d27027fe3ff4300b0b7f2422c2/riverexTestServer/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console.log('Raw body length:', body.length);
        
        // Extract device ID from URL (/fc4349999-webhook)
        const match = req.url.match(/^\/([^-]+)-webhook/);
        const deviceId = match ? match[1] : null;
        
        if (!deviceId) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Invalid webhook URL - expected format: /{deviceId}-webhook');
          return;
        }
        
        console.log(`Webhook for device: ${deviceId}`);
        
        // Parse multipart or JSON body
        let eventData = {};
        
        if (req.headers['content-type']?.includes('multipart/form-data')) {
          // For multipart, extract event_log field
          const eventLogMatch = body.match(/name="event_log"[\r\n]+([^\r\n-]+)/);
          if (eventLogMatch) {
            try {
              eventData = JSON.parse(eventLogMatch[1].trim());
              console.log('Parsed event_log:', JSON.stringify(eventData).substring(0, 200));
            } catch (e) {
              console.error('Failed to parse event_log JSON:', e.message);
            }
          }
        } else {
          // JSON body
          eventData = JSON.parse(body);
        }
        
        // Extract employee info
        const accessEvent = eventData.AccessControllerEvent || {};
        const employeeNo = accessEvent.employeeNoString || accessEvent.verifyNo;
        const timestamp = accessEvent.time || new Date().toISOString();
        const serialNo = accessEvent.serialNo || '';
        
        if (employeeNo) {
          // Forward to Firebase Cloud Function
          const payload = {
            deviceID: deviceId,
            deviceId: deviceId,
            employeeId: employeeNo,
            serialNo: serialNo,
            timestamp: timestamp,
            eventType: 'clock-in',
            source: 'webhook',
            rawEvent: eventData
          };
          
          console.log(`Forwarding to Firebase: Employee ${employeeNo}`);
          
          try {
            const response = await axios.post(FIREBASE_FUNCTION, payload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000
            });
            
            console.log('✓ Firebase response:', response.status);
            
            // Trigger background sync for this device
            setTimeout(() => syncDeviceHistory(deviceId), 1000);
            
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
          } catch (err) {
            console.error('✗ Firebase error:', err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Firebase error');
          }
        } else {
          console.log('No employee data in webhook');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
        }
        
      } catch (error) {
        console.error('Webhook error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error');
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n
```


## License: GPL-3.0
https://github.com/jjthug/autorouter/blob/47b59c7e9f8849d27027fe3ff4300b0b7f2422c2/riverexTestServer/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console.log('Raw body length:', body.length);
        
        // Extract device ID from URL (/fc4349999-webhook)
        const match = req.url.match(/^\/([^-]+)-webhook/);
        const deviceId = match ? match[1] : null;
        
        if (!deviceId) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Invalid webhook URL - expected format: /{deviceId}-webhook');
          return;
        }
        
        console.log(`Webhook for device: ${deviceId}`);
        
        // Parse multipart or JSON body
        let eventData = {};
        
        if (req.headers['content-type']?.includes('multipart/form-data')) {
          // For multipart, extract event_log field
          const eventLogMatch = body.match(/name="event_log"[\r\n]+([^\r\n-]+)/);
          if (eventLogMatch) {
            try {
              eventData = JSON.parse(eventLogMatch[1].trim());
              console.log('Parsed event_log:', JSON.stringify(eventData).substring(0, 200));
            } catch (e) {
              console.error('Failed to parse event_log JSON:', e.message);
            }
          }
        } else {
          // JSON body
          eventData = JSON.parse(body);
        }
        
        // Extract employee info
        const accessEvent = eventData.AccessControllerEvent || {};
        const employeeNo = accessEvent.employeeNoString || accessEvent.verifyNo;
        const timestamp = accessEvent.time || new Date().toISOString();
        const serialNo = accessEvent.serialNo || '';
        
        if (employeeNo) {
          // Forward to Firebase Cloud Function
          const payload = {
            deviceID: deviceId,
            deviceId: deviceId,
            employeeId: employeeNo,
            serialNo: serialNo,
            timestamp: timestamp,
            eventType: 'clock-in',
            source: 'webhook',
            rawEvent: eventData
          };
          
          console.log(`Forwarding to Firebase: Employee ${employeeNo}`);
          
          try {
            const response = await axios.post(FIREBASE_FUNCTION, payload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000
            });
            
            console.log('✓ Firebase response:', response.status);
            
            // Trigger background sync for this device
            setTimeout(() => syncDeviceHistory(deviceId), 1000);
            
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
          } catch (err) {
            console.error('✗ Firebase error:', err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Firebase error');
          }
        } else {
          console.log('No employee data in webhook');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
        }
        
      } catch (error) {
        console.error('Webhook error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error');
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n
```


## License: GPL-3.0
https://github.com/jjthug/autorouter/blob/47b59c7e9f8849d27027fe3ff4300b0b7f2422c2/riverexTestServer/server.js

```
Perfect! In your VPS terminal (where it shows `root@srv859124:~#`), paste these commands **one at a time**:

**Step 1: Start creating the file**
```bash
cat > http-relay-with-sync.js << 'RELAY_FILE_EOF'
```

**Step 2: Paste the ENTIRE content** (I'll provide it in the next message - it's 350 lines)

**Step 3: After pasting all content, type this to close the file:**
```
RELAY_FILE_EOF
```

**Step 4: Verify and restart:**
```bash
ls -lh http-relay-with-sync.js
pm2 restart all
curl http://localhost:7660/health
```

Here's the complete file content to paste after Step 1:

```javascript
const http = require('http');
const https = require('https');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Device credentials map (add your devices here)
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.2', username: 'admin', password: 'Azam198419880001' }, // SR Components device
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Track last sync times to avoid over-syncing
const lastSyncTimes = {};

/**
 * Sync device history (original webhook sync logic)
 */
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

/**
 * NEW: Handle monthly sync requests from dashboard
 * Endpoint: /device-sync-month?ip=...&username=...&password=...&month=...&year=...
 */
async function handleSyncRequest(req, res) {
  try {
    // Parse query parameters
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const ip = urlParams.searchParams.get('ip');
    const username = urlParams.searchParams.get('username');
    const password = urlParams.searchParams.get('password');
    const month = parseInt(urlParams.searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(urlParams.searchParams.get('year')) || new Date().getFullYear();

    if (!ip || !username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Missing required parameters: ip, username, password'
      }));
      return;
    }

    console.log(`\n🔄 Device sync request: ${ip} for ${month}/${year}`);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
    const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

    console.log(`📆 Date Range: ${startTime} to ${endTime}`);

    // Build curl command with Digest authentication (required by Hikvision)
    const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
    const requestBody = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
        major: 5,
        minor: 75,
        startTime: startTime,
        endTime: endTime
      }
    });

    const curlCommand = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${requestBody}' \
      "${searchUrl}"`;

    console.log('🔄 Executing curl command to device...');
    
    const { stdout, stderr } = await execAsync(curlCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 1 minute timeout
    });

    if (stderr) {
      console.warn('⚠️ Curl stderr:', stderr);
    }

    // Parse response
    const data = JSON.parse(stdout);

    let events = [];
    if (data.AcsEvent && data.AcsEvent.InfoList) {
      const infoList = Array.isArray(data.AcsEvent.InfoList) 
        ? data.AcsEvent.InfoList 
        : [data.AcsEvent.InfoList];

      events = infoList.map(event => ({
        employeeNo: event.employeeNoString,
        name: event.name || 'Unknown',
        time: event.time,
        cardNo: event.cardNo,
        cardType: event.cardType,
        serialNo: event.serialNo,
        userType: event.userType,
        currentVerifyMode: event.currentVerifyMode,
        attendanceStatus: event.attendanceStatus,
        type: event.type
      }));
    }

    console.log(`✅ Retrieved ${events.length} events from device`);

    // Send response with CORS headers for browser access
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.end(JSON.stringify({
      success: true,
      events: events,
      count: events.length,
      month: month,
      year: year,
      dateRange: {
        start: startTime,
        end: endTime
      }
    }));

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({
      success: false,
      message: error.message,
      details: error.stack
    }));
  }
}

/**
 * Health check endpoint
 */
function handleHealthCheck(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'VPS Webhook Relay + Device Sync',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      sync: 'GET /device-sync-month?ip=...&username=...&password=...&month=...&year=...',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    handleHealthCheck(res);
    return;
  }
  
  // Device sync endpoint
  if (req.url.startsWith('/device-sync-month')) {
    handleSyncRequest(req, res);
    return;
  }
  
  // Webhook handling (POST requests)
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console.log('Raw body length:', body.length);
        
        // Extract device ID from URL (/fc4349999-webhook)
        const match = req.url.match(/^\/([^-]+)-webhook/);
        const deviceId = match ? match[1] : null;
        
        if (!deviceId) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Invalid webhook URL - expected format: /{deviceId}-webhook');
          return;
        }
        
        console.log(`Webhook for device: ${deviceId}`);
        
        // Parse multipart or JSON body
        let eventData = {};
        
        if (req.headers['content-type']?.includes('multipart/form-data')) {
          // For multipart, extract event_log field
          const eventLogMatch = body.match(/name="event_log"[\r\n]+([^\r\n-]+)/);
          if (eventLogMatch) {
            try {
              eventData = JSON.parse(eventLogMatch[1].trim());
              console.log('Parsed event_log:', JSON.stringify(eventData).substring(0, 200));
            } catch (e) {
              console.error('Failed to parse event_log JSON:', e.message);
            }
          }
        } else {
          // JSON body
          eventData = JSON.parse(body);
        }
        
        // Extract employee info
        const accessEvent = eventData.AccessControllerEvent || {};
        const employeeNo = accessEvent.employeeNoString || accessEvent.verifyNo;
        const timestamp = accessEvent.time || new Date().toISOString();
        const serialNo = accessEvent.serialNo || '';
        
        if (employeeNo) {
          // Forward to Firebase Cloud Function
          const payload = {
            deviceID: deviceId,
            deviceId: deviceId,
            employeeId: employeeNo,
            serialNo: serialNo,
            timestamp: timestamp,
            eventType: 'clock-in',
            source: 'webhook',
            rawEvent: eventData
          };
          
          console.log(`Forwarding to Firebase: Employee ${employeeNo}`);
          
          try {
            const response = await axios.post(FIREBASE_FUNCTION, payload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000
            });
            
            console.log('✓ Firebase response:', response.status);
            
            // Trigger background sync for this device
            setTimeout(() => syncDeviceHistory(deviceId), 1000);
            
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
          } catch (err) {
            console.error('✗ Firebase error:', err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Firebase error');
          }
        } else {
          console.log('No employee data in webhook');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
        }
        
      } catch (error) {
        console.error('Webhook error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error');
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n
```

