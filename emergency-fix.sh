#!/bin/bash

# Emergency Device Clocking Fix
echo "🚨 EMERGENCY FIX - Device Clocking System"
echo "=========================================="

VPS_PASS="Azam198419880001#"
VPS_HOST="69.62.109.168"

echo "1️⃣ Force restart VPS relay..."
sshpass -p "$VPS_PASS" ssh -t -o StrictHostKeyChecking=no root@$VPS_HOST << 'EOF'
pm2 delete vps-relay 2>/dev/null
pm2 start /root/hikvision-relay.js --name vps-relay
pm2 save
pm2 list
EOF

echo ""
echo "2️⃣ Testing VPS endpoint..."
curl -X POST "http://$VPS_HOST:7660" \
  -H "Content-Type: application/json" \
  -d '{"testMode": true}' \
  --max-time 5 \
  && echo "✅ VPS WORKING" \
  || echo "❌ VPS FAILED"

echo ""
echo "3️⃣ Testing Firebase..."
curl -X POST "https://attendancewebhook-4q7htrps4q-uc.a.run.app" \
  -H "Content-Type: application/json" \
  -d '{"testMode": true}' \
  --max-time 5 \
  && echo "✅ FIREBASE WORKING" \
  || echo "❌ FIREBASE FAILED"

echo ""
echo "4️⃣ Deploying fresh Firebase function..."
firebase deploy --only functions:attendanceWebhook

echo ""
echo "🎯 TESTING COMPLETE - Try device clocking now!"
echo ""
echo "If still not working, CHECK:"
echo "- Device webhook URL: http://69.62.109.168:7660"
echo "- Device is connected to internet"
echo "- Device firmware is not corrupted"