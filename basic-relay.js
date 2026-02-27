/**
 * Basic AiClock Relay - Minimal working version
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
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      console.log('✅ Webhook received:', req.url);
      console.log('Body length:', body.length);
      
      // Simple forward to Firebase
      const postData = JSON.stringify({
        deviceId: 'fc4349999',
        timestamp: new Date().toISOString(),
        rawData: body,
        source: 'relay'
      });

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const firebaseReq = https.request(FIREBASE_URL, options, (firebaseRes) => {
        console.log('Firebase response status:', firebaseRes.statusCode);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });

      firebaseReq.on('error', (error) => {
        console.error('Firebase error:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      });

      firebaseReq.write(postData);
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