#!/bin/bash
# Webhook Diagnostic Script

echo "🔍 AiClock Webhook Diagnostic"
echo "================================"
echo ""

echo "1️⃣ Testing VPS Relay Health..."
curl -s http://69.62.109.168:7660/ && echo "" || echo "❌ VPS Relay is DOWN"
echo ""

echo "2️⃣ Testing Firebase Function..."
curl -s -X POST "https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook" \
  -H "Content-Type: application/json" \
  -d '{"testMode": true, "deviceId": "diagnostic"}' && echo "" || echo "❌ Firebase function is DOWN"
echo ""

echo "3️⃣ Checking VPS Relay Logs (last 20 lines)..."
sshpass -p 'Azam198419880001#' ssh -o StrictHostKeyChecking=no root@69.62.109.168 \
  "tail -20 /root/.pm2/logs/working-relay-out.log"
echo ""

echo "4️⃣ Checking for recent webhook activity..."
sshpass -p 'Azam198419880001#' ssh -o StrictHostKeyChecking=no root@69.62.109.168 \
  "grep -i 'received webhook' /root/.pm2/logs/working-relay-out.log | tail -5"
echo ""

echo "5️⃣ Testing webhook endpoint with sample data..."
curl -v -X POST "http://69.62.109.168:7660/admin-webhook" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"admin","employeeId":"TEST999","employeeName":"Diagnostic Test","attendanceStatus":"in","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' 2>&1 | grep -E "(Connected|HTTP|success)"
echo ""

echo "================================"
echo "✅ Diagnostic complete!"
