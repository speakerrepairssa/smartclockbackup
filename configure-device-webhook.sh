#!/bin/bash

# Configure Hikvision Device Webhook
# This script configures your device to send real-time events to the VPS relay

DEVICE_IP="192.168.7.2"
USERNAME="admin"
PASSWORD="Azam198419880001"
RELAY_URL="http://69.62.109.168:7660/admin-webhook"

echo "🔧 Configuring Hikvision Device Webhook"
echo "Device: $DEVICE_IP"
echo "Relay:  $RELAY_URL"
echo ""

# Configure HTTP notification
curl --digest -u "$USERNAME:$PASSWORD" \
  -X PUT \
  -H "Content-Type: application/xml" \
  --data "<?xml version='1.0' encoding='UTF-8'?>
<HttpHostNotification>
  <id>1</id>
  <url>$RELAY_URL</url>
  <protocolType>HTTP</protocolType>
  <parameterFormatType>XML</parameterFormatType>
  <addressingFormatType>ipaddress</addressingFormatType>
  <ipAddress>69.62.109.168</ipAddress>
  <portNo>7660</portNo>
  <url>/admin-webhook</url>
  <httpAuthenticationMethod>none</httpAuthenticationMethod>
</HttpHostNotification>" \
  "http://$DEVICE_IP/ISAPI/Event/notification/httpHosts/1"

echo ""
echo "✅ Webhook configured!"
echo ""
echo "Testing webhook..."

# Trigger a test event
curl --digest -u "$USERNAME:$PASSWORD" \
  -X PUT \
  "http://$DEVICE_IP/ISAPI/Event/notification/httpHosts/1/test"

echo ""
echo "🎯 Configuration complete!"
echo ""
echo "Now try clocking in on the device - it should appear instantly in your dashboard!"
