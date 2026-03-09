/**
 * AiClock Relay - Pure Fan-out Forwarder
 * Receives Hikvision webhooks and forwards raw body to Cloud Functions
 * for both aiclock and smartclock-v2 projects.
 * 
 * Cloud Functions handle all business logic:
 * - Device → Business mapping (dynamic, supports switching)
 * - Attendance status normalization & toggle
 * - Firestore writes, assessment cache, face photos
 */

const http = require('http');
const https = require('https');

const PORT = 7660;

// Cloud Function targets — both projects
const TARGETS = [
  { name: 'aiclock',       url: 'https://attendancewebhook-4q7htrps4q-uc.a.run.app' },
  { name: 'smartclock-v2', url: 'https://attendancewebhook-bfullfgyiq-uc.a.run.app' }
];

console.log('Starting AiClock Relay (Fan-out Forwarder)...');
console.log('Port:', PORT);
console.log('Targets:', TARGETS.map(t => t.name).join(', '));

function forwardRaw(target, buf, contentType) {
  return new Promise((resolve) => {
    const u = new URL(target.url);
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': contentType.replace('multipart/mixed', 'multipart/form-data'), 'Content-Length': buf.length }
    }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        console.log('  [' + target.name + '] ' + res.statusCode + ' ' + body.slice(0, 200));
        resolve({ name: target.name, status: res.statusCode, body });
      });
    });
    req.on('error', (e) => {
      console.error('  [' + target.name + '] ERROR:', e.message);
      resolve({ name: target.name, status: 0, error: e.message });
    });
    req.write(buf);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  // Health check
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      port: PORT,
      mode: 'fan-out forwarder',
      targets: TARGETS.map(t => t.name)
    }));
    return;
  }

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

  // Webhook
  if (req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      const rawBuf = Buffer.concat(chunks);
      const ct = req.headers['content-type'] || 'application/octet-stream';
      console.log('Webhook received:', req.url, '| CT:', ct, '| len:', rawBuf.length);

      // Respond immediately to the device
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));

      // Forward to all Cloud Function targets in parallel
      try {
        const results = await Promise.all(TARGETS.map(t => forwardRaw(t, rawBuf, ct)));
        const ok = results.filter(r => r.status >= 200 && r.status < 300).length;
        console.log('Fan-out: ' + ok + '/' + TARGETS.length + ' succeeded');
      } catch (e) {
        console.error('Fan-out error:', e.message);
      }
    });
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log('Relay started on port ' + PORT);
});

server.on('error', (error) => {
  console.error('Server error:', error);
});
