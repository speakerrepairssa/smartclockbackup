const http = require('http');
const https = require('https');

const PORT = 7661;
const FIREBASE_FUNCTION = 'https://attendancewebhook-bfullfgyiq-uc.a.run.app';

function parseHikvisionWebhook(body, contentType) {
  try {
    const boundaryMatch = contentType.match(/boundary=([^;,\s]+)/);
    if (!boundaryMatch) {
      console.error('No boundary found in content-type');
      return null;
    }
    const boundary = boundaryMatch[1];
    const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    let eventData = {};

    for (const part of parts) {
      if (!part || part.trim() === '--' || part.trim() === '') continue;
      const contentDispMatch = part.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"/i);
      if (!contentDispMatch) continue;
      const fieldName = contentDispMatch[1];
      const contentMatch = part.match(/\r?\n\r?\n([\s\S]*?)(?:\r?\n)?$/);
      if (!contentMatch) continue;
      let content = contentMatch[1].trim();
      if (content.startsWith('{') || content.startsWith('[')) {
        try {
          eventData[fieldName] = JSON.parse(content);
        } catch (e) {
          eventData[fieldName] = content;
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

function forwardToFirebase(payload) {
  return new Promise((resolve, reject) => {
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
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Firebase response: ${res.statusCode} - ${data.substring(0, 100)}`);
        resolve(res.statusCode);
      });
    });
    req.on('error', (e) => {
      console.error('Firebase forward error:', e.message);
      reject(e);
    });
    req.write(postData);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.url}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Health check
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ status: 'healthy', service: 'Hikvision VPS Relay v2', project: 'smartclock-v2-8271f', port: PORT, timestamp: new Date().toISOString() }));
    return;
  }

  // Webhook handling
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

        const match = req.url.match(/^\/([^-]+(?:-[^-]+)*)-webhook/);
        const deviceId = match ? match[1] : 'unknown';
        console.log('Device ID from URL:', deviceId);

        let parsedData = null;

        if (req.headers['content-type']?.includes('multipart/form-data')) {
          parsedData = parseHikvisionWebhook(body, req.headers['content-type']);
        } else if (req.headers['content-type']?.includes('application/json')) {
          parsedData = JSON.parse(body);
        }

        if (!parsedData) {
          console.error('Failed to parse webhook data');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
          return;
        }

        let eventPayload = parsedData;
        if (parsedData.event_log && typeof parsedData.event_log === 'object') {
          eventPayload = parsedData.event_log;
        }

        const actualDeviceId = (eventPayload.deviceID || deviceId)?.toUpperCase();

        const accessEvent = eventPayload.AccessControllerEvent || {};
        const hasEmployeeData = accessEvent.employeeNoString || accessEvent.verifyNo || accessEvent.name;
        const isAttendanceEvent = accessEvent.subEventType === 75 || accessEvent.subEventType === '75';

        if (!hasEmployeeData && !isAttendanceEvent) {
          console.log('Skipping non-attendance event');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
          return;
        }

        console.log('Valid attendance event:', {
          employee: accessEvent.employeeNoString,
          name: accessEvent.name,
          subEventType: accessEvent.subEventType
        });

        const payload = {
          source: 'vps-relay-v2',
          timestamp: new Date().toISOString(),
          deviceId: actualDeviceId,
          data: eventPayload,
          messageType: 'attendance_event'
        };

        await forwardToFirebase(payload);

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');

      } catch (err) {
        console.error('Webhook error:', err.message);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[v2] Hikvision relay running on port ${PORT}`);
  console.log(`[v2] Forwarding to: ${FIREBASE_FUNCTION}`);
});
