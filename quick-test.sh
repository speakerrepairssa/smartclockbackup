#!/bin/bash
echo "🔍 Quick Test"
echo "============="

# Test VPS endpoint
echo "Testing VPS endpoint..."
RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST "http://69.62.109.168:7660" -H "Content-Type: application/json" -d '{"testMode": true}' --max-time 5)
STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$STATUS" = "200" ]; then
    echo "✅ VPS RELAY IS WORKING!"
    echo "Device clocking should work now."
else
    echo "❌ VPS not responding: $RESPONSE"
fi

# Test Firebase
echo ""
echo "Testing Firebase..."
FB_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST "https://attendancewebhook-4q7htrps4q-uc.a.run.app" -H "Content-Type: application/json" -d '{"testMode": true}' --max-time 5)
FB_STATUS=$(echo "$FB_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$FB_STATUS" = "200" ]; then
    echo "✅ FIREBASE IS WORKING!"
else
    echo "❌ Firebase not responding: $FB_RESPONSE"
fi