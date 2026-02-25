#!/bin/bash

echo "🔍 VPS Port 7660 Diagnostics"
echo "================================"
echo ""

VPS_IP="69.62.109.168"
VPS_PORT="7660"
DEVICE_IP="192.168.7.2"

# Test 1: Check if VPS is reachable
echo "1️⃣ Testing VPS Reachability..."
ping -c 3 $VPS_IP > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ VPS is reachable via ping"
else
  echo "❌ VPS is NOT reachable via ping"
fi
echo ""

# Test 2: Check if port 7660 is open
echo "2️⃣ Testing Port 7660..."
curl -s -o /dev/null -w "Status: %{http_code}\n" --connect-timeout 5 http://$VPS_IP:$VPS_PORT/health
if [ $? -eq 0 ]; then
  echo "✅ Port 7660 is OPEN and responding"
else
  echo "❌ Port 7660 is CLOSED or not responding"
fi
echo ""

# Test 3: Test webhook endpoint
echo "3️⃣ Testing Webhook Endpoint..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 -X POST http://$VPS_IP:$VPS_PORT/admin-webhook)
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "302" ]; then
  echo "✅ Webhook endpoint accessible (HTTP $RESPONSE)"
else
  echo "⚠️  Webhook endpoint returned: HTTP $RESPONSE"
fi
echo ""

# Test 4: Check if device can reach VPS (requires network access)
echo "4️⃣ Testing from Device Network..."
echo "Run this command from a computer on the SAME network as your device ($DEVICE_IP):"
echo ""
echo "  curl http://$VPS_IP:$VPS_PORT/health"
echo ""
echo "If that works, your device CAN reach the VPS."
echo "If it fails, check:"
echo "  - Router firewall blocking outbound connections"
echo "  - Device doesn't have internet access"
echo "  - ISP blocking connections to VPS"
echo ""

# Test 5: Suggest alternate webhook test
echo "5️⃣ Test Device → VPS Connection..."
echo "To test if YOUR DEVICE can reach the VPS:"
echo ""
echo "  1. Access device web interface: http://$DEVICE_IP"
echo "  2. Go to: Configuration → System → Maintenance → Net Detect"
echo "  3. Test ping to: $VPS_IP"
echo "  4. If ping fails, device has no internet access"
echo ""

# Summary
echo "================================"
echo "📊 Summary"
echo "================================"
curl -s http://$VPS_IP:$VPS_PORT/ | grep -q "healthy" && echo "✅ VPS Relay Service: RUNNING" || echo "❌ VPS Relay Service: DOWN"
echo ""
echo "Next steps:"
echo "  1. Verify device has internet access"
echo "  2. Check router firewall isn't blocking device → VPS"
echo "  3. Confirm device webhook is configured to: http://$VPS_IP:$VPS_PORT/admin-webhook"
