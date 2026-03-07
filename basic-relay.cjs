/**
 * Basic AiClock Relay - Minimal working version (CommonJS)
 */

const http = require('http');
const https = require('https');

const PORT = 7660;
const FIREBASE_URL = 'https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook';

console.log('Starting Basic AiClock Relay...');
console.log('Port:', PORT);
console.log('Firebase URL:', FIREBASE_URL);

const server = http.createServer((req, res) => {
  // Handle GET requests (health check)
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Basic AiClock Relay is running\nPort: ' + PORT + '\nStatus: Ready');
    return;
  }

  // Handle POST webhooks
  if (req.method === 'POST') {
    // Collect as binary Buffer so multipart images are NOT corrupted
    const chunks = [];

    req.on('data', chunk => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      const bodyBuffer = Buffer.concat(chunks);
      console.log('✅ Webhook received:', req.url);
      console.log('Body length:', bodyBuffer.length, 'Content-Type:', req.headers['content-type']);

      // Parse the URL for the Firebase function
      const url = new URL(FIREBASE_URL);

      // Forward the original Content-Type so multipart boundaries are preserved
      const forwardHeaders = {
        'Content-Type': req.headers['content-type'] || 'application/octet-stream',
        'Content-Length': bodyBuffer.length
      };

      const options = {
        hostname: url.hostname,
        path: url.pathname + (url.search || ''),
        method: 'POST',
        headers: forwardHeaders
      };

      const firebaseReq = https.request(options, (firebaseRes) => {
        console.log('Firebase response status:', firebaseRes.statusCode);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });

      firebaseReq.on('error', (error) => {
        console.error('Firebase error:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      });

      firebaseReq.write(bodyBuffer);
      firebaseReq.end();
    });

    return;
  }

  // Handle other methods
  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`✅ Basic Relay started on port ${PORT}`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
});