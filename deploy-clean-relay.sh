#!/bin/bash

echo "🔄 Deploying Clean Webhook Relay to VPS..."
echo "This will replace the complex auto-sync server with simple webhook forwarding"

# VPS connection details
VPS_IP="69.62.109.168"
VPS_USER="root"
VPS_PASSWORD="Azam198419880001#"

echo "📤 Copying simple relay to VPS..."
sshpass -p "$VPS_PASSWORD" scp -o PreferredAuthentications=password -o PubkeyAuthentication=no simple-webhook-relay.js root@$VPS_IP:/opt/aiclock/

echo "🛑 Stopping existing complex server..."
sshpass -p "$VPS_PASSWORD" ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@$VPS_IP 'cd /opt/aiclock && pm2 stop all && pm2 delete all'

echo "🧹 Cleaning up old processes..."
sshpass -p "$VPS_PASSWORD" ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@$VPS_IP 'killall node 2>/dev/null || true'

echo "🚀 Starting simple webhook relay..."
sshpass -p "$VPS_PASSWORD" ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@$VPS_IP 'cd /opt/aiclock && pm2 start simple-webhook-relay.js --name webhook-relay'

echo "💾 Saving PM2 configuration..."
sshpass -p "$VPS_PASSWORD" ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@$VPS_IP 'pm2 save'

echo "📊 Checking service status..."
sshpass -p "$VPS_PASSWORD" ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@$VPS_IP 'pm2 list'

echo "🧪 Testing webhook endpoint..."
curl -X POST "http://$VPS_IP:7661/webhook" \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "admin", "employeeId": "1", "employeeName": "test", "action": "clock-in", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S)'"}'

echo ""
echo "✅ Deployment complete!"
echo "🎯 Device should now send webhooks to: http://$VPS_IP:7661/webhook"