#!/bin/bash
###############################################################################
# VPS Relay Restore Script
# Restores to last working state from backup
###############################################################################

set -e

VPS_HOST="69.62.109.168"
VPS_USER="root"
VPS_PASSWORD="Azam198419880001#"
BACKUP_COMMIT="7dbb4549"  # Backup commit from Feb 28 2026

echo "🔄 VPS Relay Restore Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  This will restore VPS relay to backup commit: $BACKUP_COMMIT"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo "📋 Step 1: Checking out backup commit locally..."
git checkout $BACKUP_COMMIT -- vps/hikvision-relay.js
echo "  ✓ Local files restored"

echo ""
echo "📋 Step 2: Cleaning VPS..."
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'CLEANUP'
    pm2 delete all 2>/dev/null || true
    pkill -9 node 2>/dev/null || true
    sleep 3
CLEANUP
echo "  ✓ VPS cleaned"

echo ""
echo "📋 Step 3: Uploading backup relay file..."
sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no vps/hikvision-relay.js "$VPS_USER@$VPS_HOST:/root/hikvision-relay.js"
echo "  ✓ Backup file uploaded"

echo ""
echo "📋 Step 4: Starting relay service..."
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'START'
    cd /root
    pm2 start hikvision-relay.js --name vps-relay
    pm2 save
    sleep 2
    pm2 status
START

echo ""
echo "📋 Step 5: Verifying health..."
sleep 2
curl "http://$VPS_HOST:7660/health"

echo ""
echo ""
echo "✅ Restore Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 If this works, you can commit the restored state:"
echo "   git add vps/hikvision-relay.js"
echo "   git commit -m 'Restored working relay from backup'"
echo ""
