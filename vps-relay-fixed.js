/**
 * AiClock VPS Relay - Device ID URL Parsing Fix
 * Properly extracts device ID from webhook URLs like /fc4349999-webhook
 * Version: 1.3 - Fixed Device ID Parsing
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 7660;
const FIREBASE_ENDPOINT = 'https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook';

function log(message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data);
}

function forwardToFirebase(data, deviceId, rawBody) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      deviceId: deviceId || 'unknown',
      timestamp: new Date().toISOString(),
      rawData: rawBody,
      parsedData: data,
      source: 'vps-relay'
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
    res.end('AiClock VPS Relay v1.3 - Active\nStatus: Ready to receive webhooks\nPort: 7660\nDevice ID parsing: FIXED');
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
          bodyLength: body.length,
          bodyPreview: body.substring(0, 200)
        });

        // ✅ FIXED: Extract device ID from URL path
        let deviceId = 'unknown';
        
        // Check for /deviceId-webhook format (e.g., /fc4349999-webhook)
        const deviceWebhookMatch = req.url.match(/^\/([^\/\-]+)-webhook/);
        if (deviceWebhookMatch) {
          deviceId = deviceWebhookMatch[1];
          log('Device ID extracted from URL:', deviceId);
        }
        
        // Also try /admin-webhook format
        if (req.url === '/admin-webhook') {
          deviceId = 'fc4349999'; // Default device for admin webhooks
          log('Admin webhook detected, using default device ID:', deviceId);
        }

        // Parse the webhook data
        let data = {};
        if (req.headers['content-type']?.includes('application/json')) {
          data = JSON.parse(body);
        } else if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
          const urlParams = new URLSearchParams(body);
          data = Object.fromEntries(urlParams);
        } else if (req.headers['content-type']?.includes('application/xml') || body.includes('<?xml')) {
          // Handle XML webhooks from Hikvision devices
          data = { xmlData: body };
          log('XML webhook detected');
        } else {
          // Handle any other format
          data = { rawData: body };
        }

        // Override device ID if found in data
        if (data.deviceId || data.deviceID) {
          deviceId = data.deviceId || data.deviceID;
        }

        log('Processing webhook:', { deviceId, dataKeys: Object.keys(data) });

        // Forward to Firebase
        await forwardToFirebase(data, deviceId, body);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Webhook received and forwarded to Firebase',
          deviceId: deviceId,
          timestamp: new Date().toISOString(),
          url: req.url
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
  log(`✅ AiClock VPS Relay v1.3 started on port ${PORT}`);
  log(`Firebase endpoint: ${FIREBASE_ENDPOINT}`);
  log('🔧 DEVICE ID URL PARSING: ENABLED');
  log('📡 Supported webhook formats:');
  log('   - /fc4349999-webhook (device-specific)');
  log('   - /admin-webhook (default device)');
  log('   - Content types: JSON, XML, URL-encoded, Raw');
});

server.on('error', (error) => {
  log('❌ Server error:', error);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('🛑 Shutting down VPS relay...');
  server.close(() => {
    log('✅ VPS relay stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  log('🛑 Received SIGTERM, shutting down VPS relay...');
  server.close(() => {
    log('✅ VPS relay stopped');
    process.exit(0);
  });
});