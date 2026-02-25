#!/bin/bash
# VPS Update with timeout

echo "Connecting to VPS (30 second timeout)..."

timeout 30 /usr/local/bin/sshpass -p 'Azam198419880001#' ssh -T -o ConnectTimeout=10 root@69.62.109.168 'cd /root && curl -s -o http-relay-with-sync.js https://raw.githubusercontent.com/speakerrepairssa/aiclock/main/vps/http-relay-with-sync.js && pm2 stop all && pm2 start http-relay-with-sync.js --name vps-relay && pm2 save && pm2 list'

EXIT_CODE=$?

if [ $EXIT_CODE -eq 124 ]; then
    echo "❌ Timeout - SSH connection hung"
    echo "This could mean:"
    echo "  1. VPS is not responding"
    echo "  2. Firewall blocking SSH"
    echo "  3. SSH service down"
    exit 1
elif [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ Update successful! Testing..."
    curl -s http://69.62.109.168:7660/health
    echo ""
else
    echo "❌ Failed with exit code: $EXIT_CODE"
    exit $EXIT_CODE
fi
