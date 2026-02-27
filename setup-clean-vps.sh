#!/bin/bash

# Clean VPS Setup Script - Run this on your NEW clean server
# After you reset/recreate your VPS, run this script to set up everything

echo "🚀 Setting up clean VPS relay server..."
echo "⚠️  Run this ONLY on a freshly created server!"

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
echo "🟢 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
echo "⚙️ Installing PM2 process manager..."
sudo npm install -g pm2

# Install required dependencies
echo "📋 Installing dependencies..."
sudo npm install -g axios express body-parser xml2js

# Create working directory
echo "📁 Creating relay directory..."
mkdir -p /root/relay
cd /root/relay

# Create the relay service file
echo "📝 Creating relay service..."
cat > relay-service.js << 'EOF'
const http = require('http');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = 7660;
const FIREBASE_WEBHOOK = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Middleware
app.use(express.json());
app.use(express.raw({ type: 'application/xml', limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Clean VPS Relay',
    timestamp: new Date().toISOString(),
    firebase: FIREBASE_WEBHOOK
  });
});

// Webhook relay endpoint (receives from devices, forwards to Firebase)
app.post('/:deviceId-webhook', async (req, res) => {
  const deviceId = req.params.deviceId;
  
  try {
    console.log(`📡 Webhook from device: ${deviceId}`);
    console.log('Headers:', req.headers);
    
    // Forward to Firebase with original content type
    const response = await axios.post(FIREBASE_WEBHOOK, req.body, {
      headers: {
        'Content-Type': req.get('Content-Type'),
        'User-Agent': 'VPS-Relay-Clean'
      }
    });
    
    console.log('✅ Forwarded to Firebase:', response.status);
    res.status(200).json({ success: true, deviceId, forwarded: true });
    
  } catch (error) {
    console.error('❌ Relay error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Clean VPS Relay listening on port ${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/health`);
  console.log(`🔗 Firebase: ${FIREBASE_WEBHOOK}`);
});
EOF

# Set executable permissions
chmod +x relay-service.js

# Start with PM2
echo "🚀 Starting relay service with PM2..."
pm2 start relay-service.js --name "clean-relay"
pm2 save
pm2 startup

echo ""
echo "✅ Clean VPS setup complete!"
echo ""
echo "📋 Service Info:"
echo "   Health Check: curl http://$(curl -s ifconfig.me):7660/health"
echo "   Service Status: pm2 status"
echo "   Service Logs: pm2 logs clean-relay"
echo ""
echo "🔧 Next Steps:"
echo "1. Update your device webhook URL to: http://$(curl -s ifconfig.me):7660/admin-webhook"  
echo "2. Test the connection from your device"
echo "3. Monitor logs with: pm2 logs clean-relay"