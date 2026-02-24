#!/bin/bash

# Deploy Hikvision Sync Service to VPS
# This script deploys the sync service to your VPS server

VPS_HOST="69.62.109.168"
VPS_USER="root"
VPS_PORT="7660"
SERVICE_DIR="/root/hikvision-sync-service"

echo "🚀 Deploying Hikvision Sync Service to VPS..."
echo "   Host: $VPS_HOST"
echo "   Port: $VPS_PORT"
echo ""

# Create service directory on VPS
echo "📁 Creating service directory..."
ssh -p $VPS_PORT $VPS_USER@$VPS_HOST "mkdir -p $SERVICE_DIR"

# Copy service files
echo "📦 Uploading service files..."
scp -P $VPS_PORT hikvision-sync-service/server.js $VPS_USER@$VPS_HOST:$SERVICE_DIR/
scp -P $VPS_PORT hikvision-sync-service/package.json $VPS_USER@$VPS_HOST:$SERVICE_DIR/

# Install dependencies and start service
echo "📥 Installing dependencies..."
ssh -p $VPS_PORT $VPS_USER@$VPS_HOST << 'ENDSSH'
cd /root/hikvision-sync-service

# Install dependencies
npm install

# Install PM2 if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Stop existing service if running
pm2 stop hikvision-sync || true
pm2 delete hikvision-sync || true

# Start service with PM2
echo "🚀 Starting service with PM2..."
pm2 start server.js --name hikvision-sync -- --port 3002

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup || true

echo "✅ Service deployed and started!"
pm2 status

ENDSSH

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Service Info:"
echo "   URL: http://$VPS_HOST:3002"
echo "   Health: http://$VPS_HOST:3002/health"
echo ""
echo "🔧 Management Commands (on VPS):"
echo "   pm2 status          - Check service status"
echo "   pm2 logs hikvision-sync - View logs"
echo "   pm2 restart hikvision-sync - Restart service"
echo "   pm2 stop hikvision-sync - Stop service"
echo ""
echo "🧪 Test the service:"
echo "   curl http://$VPS_HOST:3002/health"
echo ""
