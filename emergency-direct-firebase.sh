#!/bin/bash

# TEMPORARY FIX: Direct device webhook to Firebase (bypass compromised VPS)
# This configures your device to send webhooks directly to Firebase
# Only works if your router can forward traffic to Firebase

DEVICE_IP="192.168.7.2"
DEVICE_USER="admin"  
DEVICE_PASS="Azam198419880001#"

# Direct Firebase endpoint (bypasses VPS)
FIREBASE_ENDPOINT="https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook"

cat > /tmp/direct_webhook.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <HttpHostNotification>
    <id>1</id>
    <url>$FIREBASE_ENDPOINT</url>
    <protocolType>HTTPS</protocolType>
    <parameterFormatType>XML</parameterFormatType>
    <addressingFormatType>hostName</addressingFormatType>
    <hostName>us-central1-aiclock-82608.cloudfunctions.net</hostName>
    <portNo>443</portNo>
    <httpAuthenticationMethod>none</httpAuthenticationMethod>
    <SubscribeEvent>
      <heartbeat>30</heartbeat>
      <eventMode>all</eventMode>
    </SubscribeEvent>
  </HttpHostNotification>
</HttpHostNotificationList>
EOF

echo "🔧 Configuring device to bypass compromised VPS..."
echo "Device: $DEVICE_IP"
echo "Target: $FIREBASE_ENDPOINT"

curl --digest -u "$DEVICE_USER:$DEVICE_PASS" \
  -X PUT \
  -H "Content-Type: application/xml" \
  -d @/tmp/direct_webhook.xml \
  "http://$DEVICE_IP/ISAPI/Event/notification/httpHosts"

echo "✅ Device configured for direct Firebase connection!"
echo "⚠️  This bypasses the compromised VPS temporarily"
echo "🔥 You MUST rebuild your VPS server ASA