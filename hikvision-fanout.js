const http = require('http');
const https = require('https');

const PORT = 7662;

const TARGETS = [
  { name: 'aiclock',       url: 'https://attendancewebhook-4q7htrps4q-uc.a.run.app' },
  { name: 'smartclock-v2', url: 'https://attendancewebhook-bfullfgyiq-uc.a.run.app' }
];

const UPLOAD_PHOTO_URLS = [
  'https://us-central1-smartclock-v2-8271f.cloudfunctions.net/uploadEmployeePhoto',
  'https://us-central1-aiclock-82608.cloudfunctions.net/uploadEmployeePhoto'
];

// Extract JPEG from raw buffer using magic bytes FF D8 FF ... FF D9
function extractJpeg(buf) {
  for (let i = 0; i < buf.length - 3; i++) {
    if (buf[i] === 0xFF && buf[i+1] === 0xD8 && buf[i+2] === 0xFF) {
      for (let j = buf.length - 2; j > i + 100; j--) {
        if (buf[j] === 0xFF && buf[j+1] === 0xD9) {
          return buf.slice(i, j + 2);
        }
      }
      return buf.slice(i);
    }
  }
  return null;
}

// Parse the event_log JSON field from the raw multipart text
function parseEventLog(buf) {
  const text = buf.toString('utf8', 0, Math.min(buf.length, 4096));
  const m = text.match(/"event_log"[\s\S]{0,200}?\r?\n\r?\n([\s\S]*?)\r?\n--/);
  if (m) {
    try { return JSON.parse(m[1].trim()); } catch(e) {}
  }
  return null;
}

function postJson(url, data) {
  return new Promise((resolve) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      res.resume();
      res.on('end', () => { console.log('  [photo ' + u.host.split('.')[0] + '] ' + res.statusCode); resolve(); });
    });
    req.on('error', (e) => { console.error('  [photo] ERROR:', e.message); resolve(); });
    req.write(body); req.end();
  });
}

function forwardRaw(target, buf, ct) {
  return new Promise((resolve) => {
    const u = new URL(target.url);
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': ct, 'Content-Length': buf.length }
    }, (res) => {
      res.resume();
      res.on('end', () => { console.log('  [' + target.name + '] ' + res.statusCode); resolve(); });
    });
    req.on('error', (e) => { console.error('  [' + target.name + '] ERROR:', e.message); resolve(); });
    req.write(buf); req.end();
  });
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'healthy', port: PORT, targets: TARGETS.map(t => t.name) }));
  }
  if (req.method === 'POST') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      const body = Buffer.concat(chunks);
      const ct = req.headers['content-type'] || 'application/octet-stream';
      console.log(new Date().toISOString() + ' Received ' + body.length + ' bytes  ct=' + ct.substring(0, 80));

      // Acknowledge device immediately
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');

      // Forward raw binary to all Cloud Function targets
      await Promise.all(TARGETS.map(t => forwardRaw(t, body, ct)));

      // If this multipart contains a face image, extract & upload it directly
      if (body.length > 5000 && ct.includes('multipart')) {
        const jpeg = extractJpeg(body);
        if (jpeg && jpeg.length > 2000) {
          const eventLog = parseEventLog(body);
          const ace = eventLog && eventLog.AccessControllerEvent;
          const verifyNo = ace && (ace.employeeNoString || ace.verifyNo);
          const deviceId = (eventLog && (eventLog.deviceID)) || 'FC4349999';
          console.log('Face JPEG ' + jpeg.length + ' bytes  verifyNo=' + verifyNo + '  deviceId=' + deviceId);
          if (verifyNo) {
            const payload = {
              imageBase64: jpeg.toString('base64'),
              mimeType: 'image/jpeg',
              employeeSlot: verifyNo,
              deviceId: deviceId,
              source: 'webhook-fanout'
            };
            await Promise.all(UPLOAD_PHOTO_URLS.map(u => postJson(u, payload)));
          } else {
            console.log('No verifyNo found in event_log — skipping photo upload');
          }
        }
      }
    });
    return;
  }
  res.writeHead(404); res.end('Not found');
}).listen(PORT, '0.0.0.0', () => {
  console.log('[fanout-v2] port ' + PORT + '  targets: ' + TARGETS.map(t => t.name).join(', '));
});
