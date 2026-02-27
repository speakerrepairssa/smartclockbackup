#!/bin/bash

echo "🔍 AiClock System Test - Full Pipeline Check"
echo "============================================"
echo ""

# 1. Test VPS Relay Health
echo "1️⃣ Testing VPS Relay..."
if curl -s http://69.62.109.168:7660 | grep -q "Basic AiClock Relay"; then
    echo "✅ VPS Relay is responding"
else
    echo "❌ VPS Relay is down"
    exit 1
fi

# 2. Test Firebase Connection  
echo ""
echo "2️⃣ Testing Firebase Connection..."
response=$(curl -s -w "%{http_code}" -X POST "https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook" \
    -H "Content-Type: application/json" \
    -d '{"deviceId":"test","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%S)'.000Z","source":"test"}' \
    -o /tmp/firebase_response.txt)

if [ "$response" = "200" ]; then
    echo "✅ Firebase is accepting data"
else
    echo "❌ Firebase connection failed (HTTP: $response)"
fi

# 3. Test Device Connectivity
echo ""
echo "3️⃣ Testing Device Connectivity..."
if ping -c 1 192.168.0.114 >/dev/null 2>&1; then
    echo "✅ Device is reachable"
else   
    echo "❌ Device is not reachable"
    exit 1
fi

# 4. Test Device API
echo ""
echo "4️⃣ Testing Device API..."
device_response=$(curl -s --digest -u admin:Azam198419880001 "http://192.168.0.114/ISAPI/System/deviceInfo")
if echo "$device_response" | grep -q "deviceName"; then
    echo "✅ Device API is responding"
else
    echo "❌ Device API is not responding"
fi

# 5. Check Webhook Configuration
echo ""  
echo "5️⃣ Checking Webhook Configuration..."
webhook_config=$(curl -s --digest -u admin:Azam198419880001 "http://192.168.0.114/ISAPI/Event/notification/httpHosts/1")
if echo "$webhook_config" | grep -q "69.62.109.168:7660"; then
    echo "✅ Webhook is configured correctly"
else
    echo "❌ Webhook configuration is incorrect"
fi

echo ""
echo "🎯 System Status Summary:"
echo "- VPS Relay: Running on 69.62.109.168:7660"
echo "- Device: 192.168.0.114 (restarting...)"
echo "- Endpoint: /admin-webhook"
echo ""
echo "📱 Try clocking in/out on the device now!"
echo "   Watch for events at: https://aiclock-82608.web.app"
echo ""