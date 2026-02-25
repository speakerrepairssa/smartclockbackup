#!/bin/bash

# Check Hikvision Device Webhook Configuration
DEVICE_IP="192.168.7.2"
USERNAME="admin"
PASSWORD="Azam198419880001"

echo "🔍 Checking Hikvision Device Webhook Configuration"
echo "Device: $DEVICE_IP"
echo ""

# Get HTTP notification configuration
echo "📡 Current HTTP Notification Hosts:"
curl --digest -u "$USERNAME:$PASSWORD" \
  -X GET \
  "http://$DEVICE_IP/ISAPI/Event/notification/httpHosts" 2>/dev/null | \
  grep -E "(url|ipAddress|portNo)" || echo "No webhooks configured or device unreachable"

echo ""
echo ""
echo "Expected webhook URL: http://69.62.109.168:7660/admin-webhook"
