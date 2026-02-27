#!/bin/bash
# Live VPS Relay Monitor - Auto SSH with password

VPS_IP="69.62.109.168"
VPS_PASSWORD="Azam198419880001#"

echo "🔍 Connecting to VPS and monitoring relay logs..."
echo "================================"
echo "Press Ctrl+C to stop monitoring"
echo ""

# Live tail of the relay logs
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no root@$VPS_IP "tail -f /root/.pm2/logs/working-relay-out.log"
