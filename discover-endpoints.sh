#!/bin/bash

# Comprehensive endpoint discovery script
# This tries to find working endpoints on the Hikvision device

DEVICE="192.168.0.114"
CREDS="admin:Azam198419880001"

echo "=== Hikvision Device Endpoint Discovery ==="
echo "Device: $DEVICE"
echo "Credentials: admin:Azam198419880001"
echo ""

echo "Testing root endpoints:"
# Test basic endpoints
for endpoint in "" "index.html" "login.htm" "main.html"
do
    echo -n "  /$endpoint: "
    response=$(curl -s -u $CREDS --max-time 3 "http://$DEVICE/$endpoint" 2>/dev/null)
    if [[ ! -z "$response" && "$response" != *"Invalid Operation"* ]]; then
        echo "SUCCESS"
        echo "    First 100 chars: ${response:0:100}..."
    else
        echo "failed"
    fi
done

echo ""
echo "Testing capability discovery:"
# Test capability endpoints
for endpoint in "capabilities" "deviceInfo" "status" "time"
do
    for prefix in "ISAPI/System" "System" "cgi-bin"
    do
        echo -n "  /$prefix/$endpoint: "
        response=$(curl -s -u $CREDS --max-time 3 "http://$DEVICE/$prefix/$endpoint" 2>/dev/null)
        if [[ ! -z "$response" && "$response" != *"Invalid Operation"* ]]; then
            echo "SUCCESS"
            echo "    Response: ${response:0:200}..."
            break
        else
            echo -n "failed "
        fi
    done
    echo ""
done

echo ""
echo "Testing access control endpoints:"
# Test access control with different approaches
for method in "GET" "POST"
do
    echo "  Using $method method:"
    for endpoint in "AccessControl/UserInfo" "AccessControl/EmployeeNoInfo" "AccessControl/CardInfo" "Event/notification/httpHosts"
    do
        echo -n "    /ISAPI/$endpoint: "
        if [ "$method" = "GET" ]; then
            response=$(curl -s -u $CREDS --max-time 3 "http://$DEVICE/ISAPI/$endpoint" 2>/dev/null)
        else
            response=$(curl -s -X POST -u $CREDS --max-time 3 "http://$DEVICE/ISAPI/$endpoint" -H "Content-Type: application/xml" -d "<searchCond></searchCond>" 2>/dev/null)
        fi
        
        if [[ ! -z "$response" && "$response" != *"Invalid Operation"* ]]; then
            echo "SUCCESS"
            echo "      Response: ${response:0:150}..."
        else
            echo "failed"
        fi
    done
done

echo ""
echo "=== Discovery Complete ==="