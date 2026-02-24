#!/bin/bash

# 🧪 TEST HIKVISION DEVICE WITH CURL (Digest Auth)
# This tests various endpoints with proper authentication

DEVICE_IP="192.168.7.2"
USERNAME="admin"
PASSWORD="Azam198419880001"

echo "🧪 TESTING HIKVISION DEVICE WITH CURL"
echo "═══════════════════════════════════════════════════════"
echo "Device: $DEVICE_IP"
echo "Auth: Digest (automatically handled by curl)"
echo ""

# Test function
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local body="$4"
    
    echo "[$name]"
    echo "URL: $url"
    echo "Method: $method"
    
    if [ -n "$body" ]; then
        echo "Body: $body"
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" --digest -u "$USERNAME:$PASSWORD" \
            -X "$method" \
            -H "Content-Type: application/xml" \
            -d "$body" \
            "$url" 2>&1)
    else
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" --digest -u "$USERNAME:$PASSWORD" \
            -X "$method" \
            "$url" 2>&1)
    fi
    
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    body=$(echo "$response" | grep -v "HTTP_CODE:")
    
    if [ "$http_code" = "200" ]; then
        echo "✅ Status: $http_code"
        echo "Response (first 500 chars):"
        echo "$body" | head -c 500
        echo ""
        
        # Check for events
        if echo "$body" | grep -q "InfoList"; then
            count=$(echo "$body" | grep -o "<InfoList>" | wc -l | tr -d ' ')
            echo "🎉 FOUND $count EVENTS!"
        fi
    else
        echo "❌ Status: $http_code"
        echo "Error: $(echo "$body" | head -c 200)"
    fi
    
    echo ""
    echo "─────────────────────────────────────────────────────"
    echo ""
}

# Test 1: Device Info (baseline)
test_endpoint \
    "1. Device Info" \
    "http://$DEVICE_IP/ISAPI/System/deviceInfo?format=json"

# Test 2: Simple AcsEvent GET
test_endpoint \
    "2. AcsEvent GET (simple)" \
    "http://$DEVICE_IP/ISAPI/AccessControl/AcsEvent?format=json"

# Test 3: AcsEvent with maxResults
test_endpoint \
    "3. AcsEvent GET (with maxResults)" \
    "http://$DEVICE_IP/ISAPI/AccessControl/AcsEvent?format=json&maxResults=50"

# Test 4: AcsEvent XML
test_endpoint \
    "4. AcsEvent GET (XML)" \
    "http://$DEVICE_IP/ISAPI/AccessControl/AcsEvent"

# Test 5: AcsEvent POST with XML body
test_endpoint \
    "5. AcsEvent POST (basic XML)" \
    "http://$DEVICE_IP/ISAPI/AccessControl/AcsEvent" \
    "POST" \
    '<?xml version="1.0" encoding="UTF-8"?><AcsEventCond><searchID>1</searchID><maxResults>50</maxResults></AcsEventCond>'

# Test 6: AcsEvent POST with date range
test_endpoint \
    "6. AcsEvent POST (with dates)" \
    "http://$DEVICE_IP/ISAPI/AccessControl/AcsEvent" \
    "POST" \
    '<?xml version="1.0" encoding="UTF-8"?><AcsEventCond><searchID>1</searchID><searchResultPosition>0</searchResultPosition><maxResults>100</maxResults><startTime>2020-01-01T00:00:00</startTime><endTime>2026-12-31T23:59:59</endTime></AcsEventCond>'

# Test 7: UserInfo Count
test_endpoint \
    "7. UserInfo Count" \
    "http://$DEVICE_IP/ISAPI/AccessControl/UserInfo/Count?format=json"

# Test 8: CardInfo Capabilities
test_endpoint \
    "8. CardInfo Capabilities" \
    "http://$DEVICE_IP/ISAPI/AccessControl/CardInfo/capabilities?format=json"

# Test 9: Access Control Capabilities
test_endpoint \
    "9. Access Control Capabilities" \
    "http://$DEVICE_IP/ISAPI/AccessControl/capabilities?format=json"

# Test 10: Event Capabilities
test_endpoint \
    "10. Event Capabilities" \
    "http://$DEVICE_IP/ISAPI/Event/capabilities?format=json"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Test Complete!"
echo ""
echo "Look for responses with status 200 and event data above."
echo "Working endpoints can be used in your sync service."
