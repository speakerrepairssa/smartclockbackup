#!/bin/bash

# 🔍 SEARCH FOR ALTERNATIVE EVENT ENDPOINTS
# DS-K1T341AM Firmware V3.2.30 doesn't support standard AcsEvent

DEVICE_IP="192.168.7.2"
USERNAME="admin"
PASSWORD="Azam198419880001"

echo "🔍 SEARCHING FOR ALTERNATIVE EVENT ENDPOINTS"
echo "═══════════════════════════════════════════════════════"
echo "Device: DS-K1T341AM (older firmware may use different APIs)"
echo ""

test_get() {
    local name="$1"
    local url="$2"
    
    echo "[$name]"
    echo "URL: $url"
    
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}" --digest -u "$USERNAME:$PASSWORD" \
        "$url" 2>&1)
    
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    body=$(echo "$response" | grep -v "HTTP_CODE:")
    
    if [ "$http_code" = "200" ]; then
        echo "✅ Status: $http_code"
        echo "Response (first 800 chars):"
        echo "$body" | head -c 800
        echo ""
        
        # Check for events/data
        if echo "$body" | grep -qi "event\|record\|log\|employee\|card"; then
            echo "📊 CONTAINS DATA!"
        fi
    else
        echo "❌ Status: $http_code"
    fi
    
    echo ""
    echo "─────────────────────────────────────────────────────"
    echo ""
}

# Try UserInfo (we know this works and has 16 users)
test_get "1. UserInfo Records" \
    "http://$DEVICE_IP/ISAPI/AccessControl/UserInfo/Record?format=json"

# Try CardInfo records
test_get "2. CardInfo Records" \
    "http://$DEVICE_IP/ISAPI/AccessControl/CardInfo/Record?format=json"

# Try door status (might have recent events)
test_get "3. Door Status" \
    "http://$DEVICE_IP/ISAPI/AccessControl/Door/status?format=json"

# Try work status
test_get "4. Work Status" \
    "http://$DEVICE_IP/ISAPI/AccessControl/AcsWorkStatus?format=json"

# Try event triggers
test_get "5. Event Triggers" \
    "http://$DEVICE_IP/ISAPI/Event/triggers?format=json"

# Try notification alerts
test_get "6. Notification Alerts" \
    "http://$DEVICE_IP/ISAPI/Event/notification/alertStream"

# Try attendance log (some devices use this)
test_get "7. Attendance Log" \
    "http://$DEVICE_IP/ISAPI/AccessControl/AttendanceLog?format=json"

# Try transaction log
test_get "8. Transaction Record" \
    "http://$DEVICE_IP/ISAPI/AccessControl/Transaction?format=json"

# Try access log
test_get "9. Access Log" \
    "http://$DEVICE_IP/ISAPI/AccessControl/AccessLog?format=json"

# Try event log
test_get "10. Event Log" \
    "http://$DEVICE_IP/ISAPI/Event/Log?format=json"

# Try alarm outputs (sometimes contains event data)
test_get "11. Alarm Output Status" \
    "http://$DEVICE_IP/ISAPI/System/IO/outputs/1/status"

# Try event notification capabilities (tells us what events are supported)
test_get "12. Event Notification Capabilities" \
    "http://$DEVICE_IP/ISAPI/Event/notification/capabilities"

# Try smart event capabilities
test_get "13. Smart Event Capabilities" \
    "http://$DEVICE_IP/ISAPI/Smart/capabilities"

# Try authentication record
test_get "14. Authentication Record" \
    "http://$DEVICE_IP/ISAPI/AccessControl/Authentication/record?format=json"

# Try capture record (for face recognition devices)
test_get "15. Capture Record" \
    "http://$DEVICE_IP/ISAPI/AccessControl/CaptureRecord?format=json"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Test complete!"
echo ""
echo "💡 TIP: Based on the YouTube video you mentioned, check if any"
echo "   of the working endpoints above contain event/log data."
