#!/bin/bash

# MANUAL VPS UPDATE INSTRUCTIONS
# Copy and paste these commands into your VPS SSH session

echo "=== VPS Relay Update Script ==="
echo ""
echo "Step 1: SSH into your VPS"
echo "Run this on your local machine:"
echo "  ssh root@69.62.109.168"
echo ""
echo "Step 2: Once connected, run these commands:"
echo ""
cat << 'EOF'
# Navigate to root directory
cd /root

# Backup old relay (optional)
cp http-relay-smart-sync.js http-relay-smart-sync.js.backup 2>/dev/null

# Download new relay with sync endpoint
curl -o http-relay-with-sync.js https://raw.githubusercontent.com/speakerrepairssa/aiclock/main/vps/http-relay-with-sync.js

# Stop all PM2 processes
pm2 stop all

# Start new relay
pm2 start http-relay-with-sync.js --name vps-relay

# Save PM2 config
pm2 save

# Check status
pm2 list

# Test health endpoint
curl http://localhost:7660/health

# Should see JSON with endpoints (not just "OK")
EOF

echo ""
echo "Step 3: Test from your computer"
echo "  curl http://69.62.109.168:7660/health"
echo "  Should show JSON with sync endpoint listed"
echo ""
