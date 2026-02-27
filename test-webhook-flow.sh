#!/bin/bash

echo "🧪 Testing SmartClock Webhook Flow"
echo "=================================="

echo ""
echo "1. Testing VPS Relay Health..."
curl -s http://69.62.109.168:7660/health | jq . 2>/dev/null || curl -s http://69.62.109.168:7660/health

echo ""
echo "2. Testing Webhook Relay..."
curl -X POST http://69.62.109.168:7660/admin-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "1", 
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S)'Z",
    "eventType": "AccessControl",
    "attendanceStatus": "In"
  }'

echo ""
echo "3. Testing Firebase Direct..."
curl -X POST https://attendancewebhook-4q7htrps4q-uc.a.run.app \
  -H "Content-Type: application/json" \
  -d '{
    "testMode": true,
    "employeeId": "1",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S)'Z"
  }'

echo ""
echo "✅ Test completed!"
echo ""
echo "📝 If all tests pass:"
echo "   - VPS relay is working ✅"
echo "   - Firebase is receiving data ✅" 
echo "   - Issue is in device configuration ❌"
echo ""
echo "🔧 Fix device settings:"
echo "   - HTTP Port: 7660 (not 7661)"
echo "   - URL: /admin-webhook"
echo "   - Enable motion detection events"