#!/usr/bin/env node
/**
 * Live Monitoring Relay - Shows all incoming requests in real-time
 */

const http = require('http');
const https = require('https');

const PORT = 7660;
const FIREBASE_ENDPOINT = 'https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook';

console.log('🔍 LIVE MONITORING RELAY STARTED');
console.log(`📍 Listening on: http://localhost:${PORT}`);
console.log(`🕐 Started at: ${new Date().toISOString()}`);
console.log('👀 Watching for device clock-in requests...\n');

const server = http.createServer(async (req, res) => {
    const timestamp = new Date().toISOString();
    
    console.log(`\n🚨 === INCOMING REQUEST (${timestamp}) ===`);
    console.log(`📥 Method: ${req.method}`);
    console.log(`🔗 URL: ${req.url}`);
    console.log(`📡 Headers:`);
    Object.entries(req.headers).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
    });
    
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', async () => {
        if (body) {
            console.log(`📦 Body Data:`);
            console.log(body);
            console.log(`📏 Body Length: ${body.length} bytes`);
        } else {
            console.log(`📦 Body: (empty)`);
        }
        
        // Try to forward to Firebase
        if (body && req.method === 'POST') {
            console.log(`🔄 Forwarding to Firebase...`);
            try {
                const firebaseData = {
                    deviceId: 'admin',
                    businessId: 'biz_srcomponents',
                    timestamp: timestamp,
                    method: req.method,
                    url: req.url,
                    headers: req.headers,
                    body: body
                };
                
                const response = await forwardToFirebase(firebaseData);
                console.log(`✅ Firebase response: ${response.substring(0, 100)}...`);
            } catch (error) {
                console.log(`❌ Firebase error: ${error.message}`);
            }
        }
        
        // Always respond OK
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ status: 'received', timestamp }));
        
        console.log(`✅ Response sent back to device`);
        console.log(`🔚 === END REQUEST ===\n`);
    });
});

async function forwardToFirebase(data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(FIREBASE_ENDPOINT, options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => resolve(responseBody));
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎯 Ready to monitor device requests on port ${PORT}`);
    console.log(`📞 Test with: curl http://localhost:${PORT}/test`);
    console.log(`🏥 Health check: curl http://localhost:${PORT}/health\n`);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Monitoring stopped');
    process.exit(0);
});