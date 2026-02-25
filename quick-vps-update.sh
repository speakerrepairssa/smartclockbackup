#!/bin/bash
# Simple VPS Update - Run this in a fresh terminal

echo "Updating VPS relay..."

/usr/local/bin/sshpass -p 'Azam198419880001#' ssh -T root@69.62.109.168 'cd /root && curl -s -o http-relay-with-sync.js https://raw.githubusercontent.com/speakerrepairssa/aiclock/main/vps/http-relay-with-sync.js && pm2 stop all && pm2 start http-relay-with-sync.js --name vps-relay && pm2 save && pm2 list'

echo ""
echo "Testing health endpoint..."
curl -s http://69.62.109.168:7660/health
echo ""
echo "Done!"
