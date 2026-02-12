#!/bin/bash

# Manual VPS Deployment Guide for Hikvision WebSDK Service
# Target: root@69.62.109.168

echo "🚀 Hikvision WebSDK VPS Deployment Guide"
echo "========================================="
echo ""
echo "VPS Details:"
echo "  Host: 69.62.109.168"
echo "  User: root"
echo "  Password: Azam198419880001#"
echo ""

echo "📋 Manual Deployment Steps:"
echo ""

echo "1. SSH to VPS:"
echo "   ssh root@69.62.109.168"
echo "   (Enter password when prompted: Azam198419880001#)"
echo ""

echo "2. Create directory and setup Node.js:"
echo "   mkdir -p /opt/hikvision-sync"
echo "   cd /opt/hikvision-sync"
echo "   curl -fsSL https://deb.nodesource.com/setup_18.x | bash -"
echo "   apt-get install -y nodejs"
echo ""

echo "3. Create the service files on VPS:"
echo "   cat > package.json << 'EOF'"
cat hikvision-sync-service/package.json
echo "EOF"
echo ""

echo "   cat > websdk-server.js << 'EOF'"
head -50 hikvision-sync-service/websdk-server.js
echo "   # ... (complete file content)"
echo "EOF"
echo ""

echo "4. Install dependencies and start:"
echo "   npm install"
echo "   npm install -g pm2"
echo "   pm2 start websdk-server.js --name hikvision-websdk"
echo "   pm2 save"
echo ""

echo "5. Test the deployment:"
echo "   curl http://localhost:3002/health"
echo "   curl http://localhost:3002/device/extract"
echo ""

echo "6. Configure firewall (if needed):"
echo "   ufw allow 3002"
echo ""

echo "✅ Once deployed, update your AiClock dashboard:"
echo "   VPS URL: http://69.62.109.168:3002"
echo ""

# Create a quick file transfer script
echo "📤 Alternative: Use SCP to upload files"
echo ""
echo "Run these commands from your local machine:"
echo "scp -r hikvision-sync-service/ root@69.62.109.168:/opt/"
echo "ssh root@69.62.109.168 'cd /opt/hikvision-sync-service && npm install && pm2 start websdk-server.js --name hikvision-websdk'"