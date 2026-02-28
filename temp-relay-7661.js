const http = require('http');
const https = require('https');

const PORT = 7661;
const FIREBASE_FUNCTION = 'https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook';

console.log(`🚀 Starting VPS Relay on port ${PORT}`);
console.log(`🎯 Firebase endpoint: ${FIREBASE_FUNCTION}`);

const server = http.createServer(async (req, res) => {
  console.log(`📥 ${req.method} ${req.url} from ${req.socket.remoteAddress}`);
  
  // Handle health check
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{"status":"ok","port":7661,"endpoint":"admin-webhook"}');
    return;
  }
  
  // Handle admin webhook (the working endpoint)
  if (req.url === '/admin-webhook') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        console.log(`🔄 Forwarding to Firebase: ${body.substring(0,100)}...`);
        
        // Forward to Firebase
        const response = await fetch(FIREBASE_FUNCTION, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            deviceId: 'admin',
            body: body,
            timestamp: Date.now()
          })
        });
        
        console.log(`✅ Firebase response: ${response.status}`);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end('{"success":true}');
        
      } catch (error) {
        console.error(`❌ Error forwarding to Firebase:`, error);
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end('{"error":"Firebase forwarding failed"}');
      }
    });
    return;
  }
  
  // Unknown endpoint
  res.writeHead(404, {'Content-Type': 'application/json'});
  res.end('{"error":"Not found"}');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ VPS Relay running on http://0.0.0.0:${PORT}`);
  console.log(`📝 Endpoints:`);
  console.log(`   Health: http://69.62.109.168:${PORT}/health`);
  console.log(`   Webhook: http://69.62.109.168:${PORT}/admin-webhook`);
});

