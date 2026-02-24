#!/bin/bash

# Deploy enhanced VPS relay with device sync endpoint
# This relay handles both webhooks AND sync requests

VPS_HOST="69.62.109.168"
VPS_USER="root"
VPS_PORT="7660"
RELAY_FILE="http-relay-with-sync.js"

echo "🚀 Deploying VPS Relay with Device Sync..."
echo "   Host: $VPS_HOST"
echo "   Port: $VPS_PORT"
echo ""

# Upload the new relay file
echo "📦 Uploading relay file..."
scp -P 7660 vps/$RELAY_FILE $VPS_USER@$VPS_HOST:/root/

# Stop old service, start new one with PM2
echo "🔄 Restarting service..."
ssh -p 7660 $VPS_USER@$VPS_HOST << 'ENDSSH'
cd /root

# Stop existing relay if running
pm2 stop http-relay-smart-sync 2>/dev/null || true
pm2 delete http-relay-smart-sync 2>/dev/null || true

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Start new relay
pm2 start http-relay-with-sync.js --name vps-relay-sync -- --port 7660
pm2 save
pm2 startup

echo "✅ Service started!"
pm2 list
ENDSSH

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Service Info:"
echo "   Health: http://69.62.109.168:7660/health"
echo "   Sync: http://69.62.109.168:7660/device-sync-month"
echo "   Webhooks: http://69.62.109.168:7660/{deviceId}-webhook"
echo ""
echo "🧪 Test the service:"
echo "   curl http://69.62.109.168:7660/health"
echo ""
echo "🔧 Management Commands (on VPS):"
echo "   pm2 status"
echo "   pm2 logs vps-relay-sync"
echo "   pm2 restart vps-relay-sync"
echo "   pm2 stop vps-relay-sync"
echo ""
