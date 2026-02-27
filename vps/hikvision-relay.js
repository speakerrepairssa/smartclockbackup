const http = require('http');
const https = require('https');

const PORT = 7660;
const FIREBASE_FUNCTION = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

/**
 * Parse Hikvision multipart/form-data webhook
 * Hikvision sends data in a specific multipart format with attachments
 */
function parseHikvisionWebhook(body, contentType) {
  try {
    // Extract boundary from content-type header
    const boundaryMatch = contentType.match(/boundary=([^;,\s]+)/);
    if (!boundaryMatch) {
      console.error('No boundary found in content-type');
      return null;
    }
    
    const boundary = boundaryMatch[1];
    console.log('Boundary:', boundary);
    
    // Split by boundary
    const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    
    let eventData = {};
    
    for (const part of parts) {
      if (!part || part.trim() === '--' || part.trim() === '') continue;
      
      // Look for Content-Disposition header
      const contentDispMatch = part.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"/i);
      if (!contentDispMatch) continue;
      
      const fieldName = contentDispMatch[1];
      
      // Extract content after headers (double CRLF or double LF)
      const contentMatch = part.match(/\r?\n\r?\n([\s\S]*?)(?:\r?\n)?$/);
      if (!contentMatch) continue;
      
      let content = contentMatch[1].trim();
      
      console.log(`Field: ${fieldName}, Length: ${content.length}, Preview: ${content.substring(0, 100)}`);
      
      // Try to parse as JSON
      if (content.startsWith('{') || content.startsWith('[')) {
        try {
          eventData[fieldName] = JSON.parse(content);
          console.log(`✓ Parsed ${fieldName} as JSON`);
        } catch (e) {
          eventData[fieldName] = content;
          console.log(`✗ Kept ${fieldName} as string (JSON parse failed)`);
        }
      } else {
        eventData[fieldName] = content;
      }
    }
    
    return eventData;
  } catch (error) {
    console.error('Parse error:', error.message);
    return null;
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
    service: 'Hikvision VPS Relay',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhooks: 'POST /{deviceId}-webhook',
      health: 'GET /health'
    }
  }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.url}`);
  
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
  
  // Webhook handling (POST requests)
  if (req.method === 'POST' && req.url.includes('-webhook')) {
    let chunks = [];
    let bodyLength = 0;
    
    req.on('data', chunk => {
      chunks.push(chunk);
      bodyLength += chunk.length;
    });
    
    req.on('end', async () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        console.log('Raw body length:', bodyLength);
        console.log('Content-Type:', req.headers['content-type']);
        
        // Extract device ID from URL (/admin-webhook or /fc4349999-webhook)
        const match = req.url.match(/^\/([^-]+)-webhook/);
        const deviceId = match ? match[1] : 'unknown';
        console.log('Device ID:', deviceId);
        
        let parsedData = null;
        
        // Parse based on content type
        if (req.headers['content-type']?.includes('multipart/form-data')) {
          console.log('Parsing multipart/form-data...');
          parsedData = parseHikvisionWebhook(body, req.headers['content-type']);
        } else if (req.headers['content-type']?.includes('application/json')) {
          console.log('Parsing JSON...');
          parsedData = JSON.parse(body);
        }
        
        if (!parsedData) {
          console.error('Failed to parse webhook data');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
          return;
        }
        
        console.log('Parsed fields:', Object.keys(parsedData));
        
        // Extract the actual event data from event_log if present
        let eventPayload = parsedData;
        if (parsedData.event_log && typeof parsedData.event_log === 'object') {
          eventPayload = parsedData.event_log;
          console.log('Extracted event_log contents');
        }
        
        // Prioritize deviceID from payload over URL
        const actualDeviceId = eventPayload.deviceID || deviceId;
        console.log('Device IDs:', { fromURL: deviceId, fromPayload: eventPayload.deviceID, using: actualDeviceId });
        
        // Check if this is an attendance event (subEventType 75 or has employeeNoString)
        const accessEvent = eventPayload.AccessControllerEvent || {};
        const hasEmployeeData = accessEvent.employeeNoString || accessEvent.verifyNo || accessEvent.name;
        const isAttendanceEvent = accessEvent.subEventType === 75 || accessEvent.subEventType === '75';
        
        if (!hasEmployeeData && !isAttendanceEvent) {
          console.log('⏭️ Skipping non-attendance event:', {
            subEventType: accessEvent.subEventType,
            label: accessEvent.label,
            hasEmployee: !!hasEmployeeData
          });
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
          return;
        }
        
        console.log('✅ Valid attendance event:', {
          employee: accessEvent.employeeNoString,
          name: accessEvent.name,
          subEventType: accessEvent.subEventType
        });
        
        // Forward to Firebase Cloud Function
        const payload = {
          source: 'vps-relay',
          timestamp: new Date().toISOString(),
          deviceId: actualDeviceId,  // Use actual device ID from payload
          data: eventPayload,
          messageType: 'attendance_event'
        };
        
        console.log('Forwarding to Firebase...');
        console.log('Payload preview:', JSON.stringify(payload).substring(0, 300));
        
        // Use Node.js https module instead of axios
        const postData = JSON.stringify(payload);
        const url = new URL(FIREBASE_FUNCTION);
        
        const options = {
          hostname: url.hostname,
          port: 443,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 10000
        };
        
        const firebaseReq = https.request(options, (firebaseRes) => {
          let responseData = '';
          
          firebaseRes.on('data', (chunk) => {
            responseData += chunk;
          });
          
          firebaseRes.on('end', () => {
            console.log(`✓ Firebase response: ${firebaseRes.statusCode}`);
            console.log(`  Response: ${responseData.substring(0, 200)}`);
          });
        });
        
        firebaseReq.on('error', (error) => {
          console.error('✗ Firebase error:', error.message);
        });
        
        firebaseReq.on('timeout', () => {
          console.error('✗ Firebase request timeout');
          firebaseReq.destroy();
        });
        
        firebaseReq.write(postData);
        firebaseReq.end();
        
        // Respond to device immediately
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
        
      } catch (error) {
        console.error('Webhook processing error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error');
      }
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error');
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Hikvision VPS Relay running on port ${PORT}`);
  console.log(`   Webhook: http://YOUR_VPS_IP:${PORT}/{deviceId}-webhook`);
  console.log(`   Health: http://YOUR_VPS_IP:${PORT}/health\n`);
});
