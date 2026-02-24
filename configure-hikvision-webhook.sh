#!/bin/bash

# Configure Hikvision DS-K1T341AM to send events to your webhook

DEVICE_IP="192.168.7.2"
DEVICE_USER="admin"
DEVICE_PASS="Azam198419880001"

# YOUR webhook server details
YOUR_SERVER_IP="YOUR_SERVER_IP_HERE"  # Replace with your server IP
YOUR_PORT="7660"
YOUR_WEBHOOK_PATH="/hikvision/webhook"

echo "================================================"
echo "Hikvision Webhook Configuration"
echo "================================================"
echo "Device: $DEVICE_IP"
echo "Target: http://$YOUR_SERVER_IP:$YOUR_PORT$YOUR_WEBHOOK_PATH"
echo ""

# XML configuration to POST to the device
cat > /tmp/webhook_config.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <HttpHostNotification>
    <id>1</id>
    <url>http://$YOUR_SERVER_IP:$YOUR_PORT$YOUR_WEBHOOK_PATH</url>
    <protocolType>HTTP</protocolType>
    <parameterFormatType>XML</parameterFormatType>
    <addressingFormatType>ipaddress</addressingFormatType>
    <ipAddress>$YOUR_SERVER_IP</ipAddress>
    <portNo>$YOUR_PORT</portNo>
    <httpAuthenticationMethod>none</httpAuthenticationMethod>
    <SubscribeEvent>
      <heartbeat>30</heartbeat>
      <eventMode>all</eventMode>
    </SubscribeEvent>
  </HttpHostNotification>
</HttpHostNotificationList>
EOF

echo "Sending configuration to device..."
curl -s --digest -u "$DEVICE_USER:$DEVICE_PASS" \
  -X PUT \
  -H "Content-Type: application/xml" \
  -d @/tmp/webhook_config.xml \
  "http://$DEVICE_IP/ISAPI/Event/notification/httpHosts"

echo ""
echo "Configuration sent!"
echo ""
echo "Verify configuration:"
curl -s --digest -u "$DEVICE_USER:$DEVICE_PASS" \
  "http://$DEVICE_IP/ISAPI/Event/notification/httpHosts" | grep -A 5 "url"

echo ""
echo "================================================"
echo "Next steps:"
echo "1. Start webhook receiver: node hikvision-webhook-receiver.js"
echo "2. Test by clocking in/out on the device"
echo "3. Check console logs for incoming events"
echo "================================================"

rm /tmp/webhook_config.xml
