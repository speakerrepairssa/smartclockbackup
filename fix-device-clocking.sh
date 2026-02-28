#!/bin/bash
# Quick fix for device clocking - restarts VPS relay

echo "🔧 Fixing Device Clocking System..."
echo ""

cd "/Users/mobalife/Documents/Dropbox/projects development/aiclock"

echo "1️⃣ Deploying relay to VPS..."
sshpass -p 'Azam198419880001#' scp -o StrictHostKeyChecking=no vps/hikvision-relay.js root@69.62.109.168:/root/

echo ""
echo "2️⃣ Restarting PM2 process..."
sshpass -p 'Azam198419880001#' ssh -o StrictHostKeyChecking=no root@69.62.109.168 'pm2 restart vps-relay || pm2 start hikvision-relay.js --name vps-relay'

echo ""
echo "3️⃣ Checking status..."
sshpass -p 'Azam198419880001#' ssh -o StrictHostKeyChecking=no root@69.62.109.168 'pm2 status | grep vps-relay'

echo ""
echo "4️⃣ Testing webhook..."
curl -X POST http://69.62.109.168:7660 \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"FC4349999","verifyNo":"1","employeeName":"Test","attendanceStatus":"in","timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'","businessId":"biz_speaker_repairs","testMode":true}' \
  2>/dev/null | head -5

echo ""
echo ""
echo "✅ Done! Now try clocking in on the device."
echo "   Dashboard: https://aiclock-82608.web.app"
