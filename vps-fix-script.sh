#!/bin/bash

echo "🔧 Fixing VPS Relay Service..."

# Kill any processes using port 7660
echo "🛑 Stopping conflicting services..."
pkill -f ':7660'
lsof -ti:7660 | xargs kill -9 2>/dev/null || true

# Ensure Node.js and PM2 are installed
echo "📦 Ensuring dependencies..."
which node || curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && apt-get install -y nodejs
which pm2 || npm install -g pm2
npm install -g axios express body-parser xml2js

# Create clean relay directory
echo "📁 Setting up relay service..."
mkdir -p /root/clean-relay
cd /root/clean-relay

# Create the relay service
cat > relay.js << 'EOF'
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 7660;
const FIREBASE = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Middleware to handle all content types
app.use(express.raw({ type: '*/*', limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Clean VPS Relay',
    timestamp: new Date().toISOString(),
    firebase: FIREBASE
  });
});

// Main webhook relay endpoint
app.post('/:deviceId-webhook', async (req, res) => {
  const deviceId = req.params.deviceId;
  
  try {
    console.log(`📡 Relaying webhook from device: ${deviceId}`);
    console.log(`📤 Content-Type: ${req.get('Content-Type')}`);
    
    // Forward to Firebase
    const response = await axios.post(FIREBASE, req.body, {
      headers: {
        'Content-Type': req.get('Content-Type') || 'application/octet-stream',
        'User-Agent': 'VPS-Relay-Clean',
        'X-Device-ID': deviceId
      },
      timeout: 30000
    });
    
    console.log(`✅ Forwarded to Firebase: ${response.status}`);
    res.status(200).json({ 
      success: true, 
      deviceId, 
      forwarded: true,
      firebaseStatus: response.status 
    });
    
  } catch (error) {
    console.error(`❌ Relay error for ${deviceId}:`, error.message);
    res.status(500).json({ 
      success: false, 
      deviceId,
      error: error.message 
    });
  }
});

// Catch-all for other webhook formats
app.post('/admin-webhook', async (req, res) => {
  try {
    console.log('📡 Admin webhook received');
    const response = await axios.post(FIREBASE, req.body, {
      headers: {
        'Content-Type': req.get('Content-Type') || 'application/octet-stream'
      }
    });
    res.status(200).json({ success: true, forwarded: true });
  } catch (error) {
    console.error('❌ Admin webhook error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Clean VPS Relay running on port ${PORT}`);
  console.log(`🔗 Firebase target: ${FIREBASE}`);
  console.log(`📡 Webhook endpoints:`);
  console.log(`   - http://0.0.0.0:${PORT}/admin-webhook`);
  console.log(`   - http://0.0.0.0:${PORT}/{deviceId}-webhook`);
});
EOF

# Stop any existing PM2 processes
echo "🔄 Managing PM2 processes..."
pm2 delete all 2>/dev/null || true

# Start the clean relay service
echo "🚀 Starting clean relay service..."
pm2 start relay.js --name "clean-relay"
pm2 save
pm2 startup

echo ""
echo "✅ Clean relay service deployed!"
echo ""
echo "📊 Service Status:"
pm2 list

echo ""
echo "🧪 Testing service:"
sleep 2
curl -s http://localhost:7660/health | jq . 2>/dev/null || curl -s http://localhost:7660/health

echo ""
echo "🎯 Relay service ready!"
echo "   Health: http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):7660/health"
echo "   Webhook: http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):7660/admin-webhook" 