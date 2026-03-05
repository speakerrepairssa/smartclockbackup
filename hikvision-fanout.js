const http = require('http');
const https = require('https');

const PORT = 7662;

// All Firebase targets — add more here as you onboard new businesses/apps
const TARGETS = [
  {
    name: 'aiclock',
    url: 'https://attendancewebhook-4q7htrps4q-uc.a.run.app'
  },
  {
    name: 'smartclock-v2',
    url: 'https://attendancewebhook-bfullfgyiq-uc.a.run.app'
  }
];

function parseHikvisionWebhook(body, contentType) {
  try {
    const boundaryMatch = contentType.match(/boundary=([^;,\s]+)/);
    if (!boundaryMatch) return null;
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
        try { eventData[fieldName] = JSON.parse(content); }
        catch (e) { eventData[fieldName] = content; }
      } else {
        eventData[fieldName] = content;
      }
    }
    return eventData;
  } catch (e) {
    console.error('Parse error:', e.message);
    return null;
  }
}

function forwardToTarget(target, payload) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    const url = new URL(target.url);
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
        console.log(`  [${target.name}] ${res.statusCode} - ${data.substring(0, 80)}`);
        resolve();
      });
    });
    req.on('error', (e) => {
      console.error(`  [${target.name}] ERROR: ${e.message}`);
      resolve();
    });
    req.write(postData);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ status: 'healthy', service: 'Hikvision Fan-out Relay', port: PORT, targets: TARGETS.map(t => t.name), timestamp: new Date().toISOString() }));
    return;
  }

  if (req.method === 'POST' && req.url.includes('-webhook')) {
    let chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        const match = req.url.match(/^\/([^-]+(?:-[^-]+)*)-webhook/);
        const deviceId = match ? match[1] : 'unknown';

        let parsedData = null;
        if (req.headers['content-type']?.includes('multipart/form-data')) {
          parsedData = parseHikvisionWebhook(body, req.headers['content-type']);
        } else if (req.headers['content-type']?.includes('application/json')) {
          parsedData = JSON.parse(body);
        }

        if (!parsedData) {
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
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
          return;
        }

        console.log(`Event: ${accessEvent.name} (badge ${accessEvent.employeeNoString}) subType:${accessEvent.subEventType}`);
        console.log(`Forwarding to ${TARGETS.length} targets...`);

        const payload = {
          source: 'vps-fanout',
          timestamp: new Date().toISOString(),
          deviceId: actualDeviceId,
          data: eventPayload,
          messageType: 'attendance_event'
        };

        // Forward to ALL targets simultaneously
        await Promise.all(TARGETS.map(t => forwardToTarget(t, payload)));

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      } catch (err) {
        console.error('Error:', err.message);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[fanout] Relay running on port ${PORT}`);
  console.log(`[fanout] Forwarding to: ${TARGETS.map(t => t.name).join(', ')}`);
});
