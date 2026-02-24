#!/bin/bash

# Test the updated Hikvision sync service with the correct working API

DEVICE_IP="192.168.7.2"
USERNAME="admin"
PASSWORD="Azam198419880001"
SERVICE_URL="http://localhost:3002"

echo "======================================"
echo "Hikvision Sync Service Test"
echo "======================================"
echo ""

echo "1. Testing direct extraction (all events):"
echo "GET $SERVICE_URL/device/extract?ip=$DEVICE_IP&username=$USERNAME&password=..."
curl -s "$SERVICE_URL/device/extract?ip=$DEVICE_IP&username=$USERNAME&password=$PASSWORD" | jq '{
  method,
  total_events_found,
  pagination: .pagination,
  sample_events: .events[0:3] | map({time, name, employeeNoString, minor})
}'

echo ""
echo ""
echo "2. Testing monthly sync (January 2026):"
echo "GET $SERVICE_URL/device/sync-month?ip=$DEVICE_IP&month=1&year=2026"
curl -s "$SERVICE_URL/device/sync-month?ip=$DEVICE_IP&username=$USERNAME&password=$PASSWORD&month=1&year=2026" | jq '{
  method,
  total_events_found,
  pagination: .pagination,
  sample_events: .events[0:3] | map({time, name, employeeNoString, minor})
}'

echo ""
echo ""
echo "======================================"
echo "Test Complete"
echo "======================================"
