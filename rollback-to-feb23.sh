#!/bin/bash

echo "🔄 Rolling back to February 23rd working version..."

VPS_IP="69.62.109.168"
VPS_PASSWORD="Azam198419880001#"

echo "📤 Copying original working relay to VPS..."
sshpass -p "$VPS_PASSWORD" scp -o PreferredAuthentications=password -o PubkeyAuthentication=no http-relay-working.js root@$VPS_IP:/opt/aiclock/

echo "🛑 Stopping complex broken server..."  
sshpass -p "$VPS_PASSWORD" ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@$VPS_IP 'cd /opt/aiclock && pm2 stop all && pm2 delete all'

echo "🧹 Cleaning up processes..."
sshpass -p "$VPS_PASSWORD" ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@$VPS_IP 'killall node 2>/dev/null || true'

echo "🚀 Starting original working relay (port 7660)..."
sshpass -p "$VPS_PASSWORD" ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@$VPS_IP 'cd /opt/aiclock && pm2 start http-relay-working.js --name working-relay'

echo "💾 Saving PM2 configuration..."
sshpass -p "$VPS_PASSWORD" ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@$VPS_IP 'pm2 save'

echo "📊 Checking status..."
sshpass -p "$VPS_PASSWORD" ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@$VPS_IP 'pm2 list'

echo ""
echo "✅ Rollback complete! Testing..."
curl "http://$VPS_IP:7660/" 

echo ""
echo "🎯 System restored to February 23rd working state!"
echo "Device sends to: http://$VPS_IP:7660/admin-webhook"