const http = require('http');
const https = require('https');

const PORT = 7660;
const FIREBASE_HOST = 'attendancewebhook-4q7htrps4q-uc.a.run.app';
const FIREBASE_PATH = '/';

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('AiClock HTTP to HTTPS Relay v1.0\n');
    return;
  }

  if (req.method === 'POST' && req.url === '/attendancewebhook') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      console.log(`Forwarding ${body.length} bytes to Firebase...`);

      // Forward to Firebase via HTTPS
      const options = {
        hostname: FIREBASE_HOST,
        port: 443,
        path: FIREBASE_PATH,
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
          console.log('✓ Request completed\n');
        });
      });

      proxyReq.on('error', (err) => {
        console.error('✗ Firebase error:', err.message);
        res.writeHead(500);
        res.end('Error forwarding to Firebase');
      });

      proxyReq.write(body);
      proxyReq.end();
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 AiClock HTTP→HTTPS Relay running on port ${PORT}`);
  console.log(`Forwarding to: https://${FIREBASE_HOST}${FIREBASE_PATH}\n`);
});
