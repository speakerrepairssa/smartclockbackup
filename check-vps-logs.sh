#!/bin/bash
# Check VPS Relay Recent Logs - Auto SSH

VPS_IP="69.62.109.168"
VPS_PASSWORD="Azam198419880001#"

echo "🔍 Checking VPS Relay Recent Activity"
echo "================================"
echo ""

echo "📋 Last 50 lines of relay output log:"
echo "-----------------------------------"
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no root@$VPS_IP \
  "tail -50 /root/.pm2/logs/working-relay-out.log"
echo ""

echo "📋 Last 20 lines of relay error log:"
echo "-----------------------------------"
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no root@$VPS_IP \
  "tail -20 /root/.pm2/logs/working-relay-error.log"
echo ""

echo "🔍 Recent webhook activity (last 10 events):"
echo "-----------------------------------"
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no root@$VPS_IP \
  "grep 'Received webhook' /root/.pm2/logs/working-relay-out.log | tail -10"
echo ""

echo "📊 PM2 Process Status:"
echo "-----------------------------------"
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no root@$VPS_IP \
  "pm2 status"
echo ""

echo "✅ Check complete!"
