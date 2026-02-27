#!/bin/bash

echo "🖥️ Device Management System - Test & Deploy"
echo "============================================="
echo ""

# 1. Test VPS Relay Health
echo "1️⃣ Testing VPS Relay..."
if curl -s http://69.62.109.168:7660 | grep -q "Basic AiClock Relay"; then
    echo "✅ VPS Relay is responding"
else
    echo "❌ VPS Relay is down - Fix this first!"
    exit 1
fi

# 2. Test Device Connectivity
echo ""
echo "2️⃣ Testing Device Connectivity..."
if ping -c 1 192.168.0.114 >/dev/null 2>&1; then
    echo "✅ Device is reachable"
else
    echo "❌ Device is not reachable"
fi

# 3. Test Device API
echo ""
echo "3️⃣ Testing Device API..."
device_response=$(curl -s --digest -u admin:Azam198419880001 "http://192.168.0.114/ISAPI/System/deviceInfo" --connect-timeout 5)
if echo "$device_response" | grep -q "deviceName"; then
    echo "✅ Device API is responding"
    # Extract device name
    device_name=$(echo "$device_response" | grep -o '<deviceName>.*</deviceName>' | sed 's/<[^>]*>//g')
    echo "   Device: $device_name"
else
    echo "❌ Device API is not responding"
fi

echo ""
echo "🚀 Admin Panel Features Added:"
echo "   • Remote Device Restart"
echo "   • Device Status Check"  
echo "   • Webhook Testing"
echo "   • Event Viewing"
echo ""
echo "📍 Next Steps:"
echo "   1. Deploy to Firebase: firebase deploy --only functions"
echo "   2. Open admin panel: https://aiclock-82608.web.app/pages/admin-dashboard.html"
echo "   3. Navigate to Device Management section"
echo "   4. Test the 🔄 Restart Device button"
echo ""