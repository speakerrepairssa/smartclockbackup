#!/bin/bash
# Quick VPS Log Check - Optimized

echo "Fetching VPS logs (this may take a moment due to network latency)..."
sshpass -p 'Azam198419880001#' ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=5 root@69.62.109.168 'tail -30 /root/.pm2/logs/working-relay-out.log 2>/dev/null || echo "Log file not found or empty"'
