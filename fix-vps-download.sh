#!/bin/bash
# Properly download and deploy the relay

echo "Re-downloading relay file (should be ~12KB)..."

/usr/local/bin/sshpass -p 'Azam198419880001#' ssh -T root@69.62.109.168 << 'EOF'
cd /root

# Remove bad download
rm -f http-relay-with-sync.js

# Download with verbose output to see what's wrong
echo "Downloading from GitHub..."
curl -L -v -o http-relay-with-sync.js https://raw.githubusercontent.com/speakerrepairssa/aiclock/main/vps/http-relay-with-sync.js 2>&1 | tail -20

# Check file size
echo ""
echo "Downloaded file size:"
ls -lh http-relay-with-sync.js

# Show first 50 chars to verify it's JavaScript
echo ""
echo "File starts with:"
head -c 50 http-relay-with-sync.js

# If file is good (more than 1KB), restart service
FILE_SIZE=$(stat -f%z http-relay-with-sync.js 2>/dev/null || stat -c%s http-relay-with-sync.js)
if [ "$FILE_SIZE" -gt 1000 ]; then
    echo ""
    echo "File size OK ($FILE_SIZE bytes), restarting..."
    pm2 stop all
    pm2 delete all
    pm2 start http-relay-with-sync.js --name vps-relay
    pm2 save
    sleep 2
    pm2 list
    echo ""
    echo "Health check:"
    curl http://localhost:7660/health
else
    echo ""
    echo "❌ File too small ($FILE_SIZE bytes), download failed"
    cat http-relay-with-sync.js
fi
EOF

echo ""
echo "Testing from Mac:"
curl -s http://69.62.109.168:7660/health | head -100
echo ""
