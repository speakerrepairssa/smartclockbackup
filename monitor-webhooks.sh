#!/bin/bash
echo "🔍 Monitoring VPS relay for incoming webhooks..."
echo "VPS: http://69.62.109.168:7660/admin-webhook"
echo "Time: $(date)"
echo "Device IP: 192.168.0.114"
echo ""
echo "Listening for webhook attempts... (Try clocking in/out now)"
echo "========================================"

# Monitor the VPS relay logs via SSH
/usr/local/bin/sshpass -p 'Azam198419880001#' ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no root@69.62.109.168 'tail -f /opt/aiclock/relay.log 2>/dev/null || echo "No relay.log found, checking process..."'