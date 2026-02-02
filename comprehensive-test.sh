#!/bin/bash

echo "🔍 COMPREHENSIVE DEVICE API TESTING"
echo "=================================="
echo "Device: 192.168.0.114"
echo "Testing various endpoints to find what works..."
echo ""

# Array of endpoints to test
endpoints=(
    "/"
    "/ISAPI/"
    "/ISAPI/System/status"
    "/ISAPI/System/deviceInfo"
    "/ISAPI/System/time"
    "/ISAPI/System/capabilities"
    "/ISAPI/AccessControl/"
    "/ISAPI/AccessControl/AcsEvent"
    "/ISAPI/AccessControl/CardReader/status"
    "/ISAPI/AccessControl/CardInfo/search"
    "/ISAPI/Event/notification/"
    "/ISAPI/ContentMgmt/"
    "/doc/page/login.asp"
    "/SDK/"
)

for endpoint in "${endpoints[@]}"; do
    echo "📡 Testing: $endpoint"
    
    # Test with authentication
    response=$(curl -k -s --connect-timeout 3 -w "%{http_code}" -u admin:Azam198419880001 "https://192.168.0.114$endpoint" 2>/dev/null)
    http_code=${response: -3}
    content=${response%???}
    
    case $http_code in
        200) echo "   ✅ SUCCESS (200) - Content available" ;;
        401) echo "   🔐 Auth required (401)" ;;
        404) echo "   ❌ Not found (404)" ;;
        403) echo "   🚫 Forbidden (403)" ;;
        500) echo "   💥 Server error (500)" ;;
        *) echo "   ❓ Response: $http_code" ;;
    esac
    
    # Show first line of successful responses
    if [[ $http_code == "200" && ${#content} -gt 10 ]]; then
        echo "   📄 Preview: $(echo "$content" | head -1 | cut -c1-60)..."
    fi
    echo ""
done

echo "🎯 SUMMARY:"
echo "This shows exactly which endpoints your device supports!"
echo "Any endpoint returning 200 is potentially useful for data extraction."