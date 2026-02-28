#!/bin/bash

echo "🔍 AIClock System Diagnostic"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

VPS_HOST="69.62.109.168"
VPS_PORT="7660"
VPS_PASS="Azam198419880001#"

echo "1️⃣ Checking VPS Relay Status"
echo "------------------------------"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no root@$VPS_HOST 'pm2 status' 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Connected to VPS${NC}"
else
    echo -e "${RED}✗ Cannot connect to VPS${NC}"
fi
echo ""

echo "2️⃣ Checking VPS Relay Logs (Last 10 lines)"
echo "-------------------------------------------"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no root@$VPS_HOST 'pm2 logs vps-relay --lines 10 --nostream' 2>&1
echo ""

echo "3️⃣ Testing VPS Endpoint"
echo "-----------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "http://$VPS_HOST:$VPS_PORT" \
  -H "Content-Type: application/json" \
  -d '{"testMode": true, "deviceId": "TEST"}' \
  --max-time 5 2>&1)

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS")

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ VPS endpoint responding${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}✗ VPS endpoint not responding (Status: $HTTP_STATUS)${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

echo "4️⃣ Testing Firebase Function Directly"
echo "---------------------------------------"
FB_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://attendancewebhook-4q7htrps4q-uc.a.run.app" \
  -H "Content-Type: application/json" \
  -d '{"testMode": true, "deviceId": "TEST"}' \
  --max-time 10 2>&1)

FB_STATUS=$(echo "$FB_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
FB_BODY=$(echo "$FB_RESPONSE" | grep -v "HTTP_STATUS")

if [ "$FB_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Firebase function responding${NC}"
    echo "Response: $FB_BODY"
else
    echo -e "${RED}✗ Firebase function not responding (Status: $FB_STATUS)${NC}"
    echo "Response: $FB_RESPONSE"
fi
echo ""

echo "5️⃣ Checking VPS Relay File"
echo "---------------------------"
VPS_FILE_CHECK=$(sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no root@$VPS_HOST 'ls -lh /root/hikvision-relay.js 2>&1')
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Relay file exists on VPS${NC}"
    echo "$VPS_FILE_CHECK"
else
    echo -e "${RED}✗ Relay file missing on VPS${NC}"
fi
echo ""

echo "6️⃣ Testing Full Chain (VPS → Firebase)"
echo "----------------------------------------"
CHAIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "http://$VPS_HOST:$VPS_PORT" \
  -H "Content-Type: application/json" \
  -d '{
    "testMode": true,
    "deviceId": "FC4349999",
    "verifyNo": "12345",
    "employeeName": "Test Employee",
    "attendanceStatus": 1
  }' \
  --max-time 10 2>&1)

CHAIN_STATUS=$(echo "$CHAIN_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$CHAIN_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Full chain working${NC}"
else
    echo -e "${RED}✗ Full chain broken (Status: $CHAIN_STATUS)${NC}"
fi
echo ""

echo "=============================="
echo "🏁 Diagnostic Complete"
echo ""
echo "Summary:"
echo "--------"
if [ "$HTTP_STATUS" != "200" ]; then
    echo -e "${RED}⚠️  VPS Relay is NOT responding${NC}"
    echo "   → Run: bash fix-device-clocking.sh"
elif [ "$FB_STATUS" != "200" ]; then
    echo -e "${RED}⚠️  Firebase Function is NOT responding${NC}"
    echo "   → Run: firebase deploy --only functions:attendanceWebhook"
elif [ "$CHAIN_STATUS" != "200" ]; then
    echo -e "${RED}⚠️  Chain is broken (VPS → Firebase)${NC}"
    echo "   → Check VPS relay forwarding logic"
else
    echo -e "${GREEN}✅ All systems operational!${NC}"
    echo "   → If device still not working, check device configuration"
fi
