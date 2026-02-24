#!/bin/bash

# Test various log query methods based on web UI showing "Log Query"

DEVICE_IP="192.168.7.2"
USER="admin"
PASS="Azam198419880001"

echo "=== Testing Log Query Endpoints ==="
echo ""

echo "1. POST to AcsEvent with search params (XML):"
curl -s --digest -u "$USER:$PASS" \
  -X POST \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond>
  <searchID>1</searchID>
  <searchResultPosition>0</searchResultPosition>
  <maxResults>30</maxResults>
  <major>5</major>
  <minor>0</minor>
</AcsEventCond>' \
  "http://$DEVICE_IP/ISAPI/AccessControl/AcsEvent" | head -100

echo ""
echo ""
echo "2. Search with date range:"
curl -s --digest -u "$USER:$PASS" \
  -X POST \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond>
  <searchID>1</searchID>
  <searchResultPosition>0</searchResultPosition>
  <maxResults>100</maxResults>
  <major>5</major>
  <startTime>2024-01-01T00:00:00</startTime>
  <endTime>2026-12-31T23:59:59</endTime>
</AcsEventCond>' \
  "http://$DEVICE_IP/ISAPI/AccessControl/AcsEvent" | head -100

echo ""
echo ""
echo "3. GET AcsEvent with searchResultPosition:"
curl -s --digest -u "$USER:$PASS" \
  "http://$DEVICE_IP/ISAPI/AccessControl/AcsEvent?searchID=1&searchResultPosition=0&maxResults=30&format=json"

echo ""
echo ""
echo "4. Query with different formatting:"
curl -s --digest -u "$USER:$PASS" \
  -X POST \
  "http://$DEVICE_IP/ISAPI/AccessControl/AcsEvent?format=json" \
  -H "Content-Type: application/json" \
  -d '{
    "AcsEventCond": {
      "searchID": "1",
      "searchResultPosition": 0,
      "maxResults": 30
    }
  }'

echo ""
echo ""
echo "5. Try FDLib attendance records:"
curl -s --digest -u "$USER:$PASS" \
  "http://$DEVICE_IP/ISAPI/ContentMgmt/FDLib/FDAttendRecord?format=json"

echo ""
echo ""
echo "6. Try FDLib search:"
curl -s --digest -u "$USER:$PASS" \
  -X POST \
  -H "Content-Type: application/json" \
  "http://$DEVICE_IP/ISAPI/ContentMgmt/FDLib/FDSearch?format=json" \
  -d '{
    "searchResultPosition": 0,
    "maxResults": 30
  }'
  
echo ""
echo ""
echo "7. Face comparison records:"
curl -s --digest -u "$USER:$PASS" \
  "http://$DEVICE_IP/ISAPI/AccessControl/UserInfoRecord?format=json&startNo=0&endNo=30"

echo ""
echo "=== Complete ==="
