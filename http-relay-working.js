/**
 * AiClock HTTP to HTTPS Relay Server - Working Version
 * Receives HTTP webhooks from Hikvision devices and forwards to Firebase HTTPS endpoint
 * Version: 1.2 - Stable Relay
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 7660;
const FIREBASE_ENDPOINT = 'https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook';

// Device configuration for authentication
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

function log(message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data);
}

function forwardToFirebase(data, deviceId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      deviceId: deviceId || 'unknown',
      timestamp: new Date().toISOString(),
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
        log('Firebase response:', { 
          statusCode: res.statusCode, 
          data: responseData.substring(0, 200) 
        });
        resolve({ statusCode: res.statusCode, data: responseData });
      });
    });

    req.on('error', (error) => {
      log('Firebase request error:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

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
    res.end('AiClock HTTP to HTTPS Relay v1.2 - Active\nStatus: Ready to receive webhooks\nPort: 7660');
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

        // Extract device ID from various sources
        let deviceId = data.deviceId || data.deviceID || 'unknown';
        
        // Forward to Firebase
        await forwardToFirebase(data, deviceId);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Webhook received and forwarded to Firebase',
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
  log(`AiClock Relay Server v1.2 started on port ${PORT}`);
  log('Device configuration:', Object.keys(DEVICES));
  log(`Firebase endpoint: ${FIREBASE_ENDPOINT}`);
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