#!/bin/bash

# VPS Relay Auto-Update Script
# This script automatically updates the VPS relay service

set -e  # Exit on error

VPS_HOST="69.62.109.168"
VPS_PASSWORD="Azam198419880001#"
SSHPASS_CMD="/usr/local/bin/sshpass"

echo "🚀 Starting VPS Relay Update..."
echo "================================"
echo ""

# Check if sshpass is installed
if [ ! -f "$SSHPASS_CMD" ]; then
    echo "❌ sshpass not found at $SSHPASS_CMD"
    echo "Installing sshpass..."
    brew install hudochenkov/sshpass/sshpass
fi

echo "📥 Connecting to VPS and updating relay..."
echo ""

# Execute all commands on VPS in one go
$SSHPASS_CMD -p "$VPS_PASSWORD" ssh -T -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$VPS_HOST '
cd /root && \
curl -s -o http-relay-with-sync.js https://raw.githubusercontent.com/speakerrepairssa/aiclock/main/vps/http-relay-with-sync.js && \
echo "✅ File downloaded" && \
pm2 stop all && \
pm2 start http-relay-with-sync.js --name vps-relay && \
pm2 save && \
echo "📊 PM2 Status:" && \
pm2 list && \
echo "🏥 Health Check:" && \
curl -s http://localhost:7660/health
'

echo ""
echo "================================"
echo "🧪 Testing from external..."
echo ""

# Test from local machine
echo "Health endpoint:"
curl -s http://$VPS_HOST:7660/health | head -200

echo ""
echo ""
echo "✅ All done! VPS relay updated successfully!"
echo ""
echo "📝 Endpoints available:"
echo "   Health: http://$VPS_HOST:7660/health"
echo "   Sync: http://$VPS_HOST:7660/device-sync-month"
echo "   Webhooks: http://$VPS_HOST:7660/{deviceId}-webhook"
echo ""
