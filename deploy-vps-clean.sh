#!/bin/bash
###############################################################################
# Clean VPS Relay Deployment Script
# Prevents port conflicts by properly cleaning up old processes
###############################################################################

set -e  # Exit on error

VPS_HOST="69.62.109.168"
VPS_USER="root"
VPS_PASSWORD="Azam198419880001#"
RELAY_FILE="vps/hikvision-relay.js"
PM2_NAME="vps-relay"

echo "🚀 Starting Clean VPS Relay Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if relay file exists locally
if [ ! -f "$RELAY_FILE" ]; then
    echo "❌ Error: Relay file not found: $RELAY_FILE"
    exit 1
fi

echo "✓ Relay file found: $RELAY_FILE"

# Step 1: Complete cleanup of VPS
echo ""
echo "📋 Step 1: Cleaning VPS (removing ALL conflicting services)..."
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'CLEANUP'
    set -e
    echo "  → Stopping all PM2 processes..."
    pm2 delete all 2>/dev/null || true
    pm2 kill 2>/dev/null || true
    
    echo "  → Finding all processes using port 7660..."
    PORT_PIDS=$(lsof -ti:7660 2>/dev/null || true)
    if [ -n "$PORT_PIDS" ]; then
        echo "  → Found processes: $PORT_PIDS"
        echo "$PORT_PIDS" | xargs kill -9 2>/dev/null || true
    fi
    
    echo "  → Killing all node processes (including background services)..."
    pkill -9 node 2>/dev/null || true
    
    echo "  → Cleaning up old service directories..."
    # Remove old service installations that might auto-restart
    rm -rf /opt/aiclock 2>/dev/null || true
    
    echo "  → Waiting for all processes to die..."
    sleep 7
    
    echo "  → Final port verification (3 attempts)..."
    for i in {1..3}; do
        if lsof -i:7660 >/dev/null 2>&1; then
            echo "  → Attempt $i: Port still occupied, killing..."
            lsof -ti:7660 | xargs kill -9 2>/dev/null || true
            sleep 3
        else
            echo "  ✓ Port 7660 is free"
            break
        fi
    done
    
    # Final verification
    if lsof -i:7660 >/dev/null 2>&1; then
        echo "  ❌ ERROR: Port 7660 still occupied after cleanup!"
        lsof -i:7660
        exit 1
    fi
    
    echo "  ✓ VPS cleaned successfully"
CLEANUP

# Step 2: Upload relay file
echo ""
echo "📋 Step 2: Uploading relay files..."
sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "$RELAY_FILE" "$VPS_USER@$VPS_HOST:/root/hikvision-relay.js"
sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "vps/pm2-ecosystem.json" "$VPS_USER@$VPS_HOST:/root/pm2-ecosystem.json"
echo "  ✓ Relay files uploaded"

# Step 3: Start relay with PM2
echo ""
echo "📋 Step 3: Starting relay service..."
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'START'
    set -e
    cd /root
    
    # Verify file was uploaded
    if [ ! -f "hikvision-relay.js" ]; then
        echo "  ❌ Relay file not found on VPS!"
        exit 1
    fi
    
    # Start with PM2 using ecosystem file
    echo "  → Starting PM2 service with configuration..."
    pm2 start pm2-ecosystem.json
    
    # Save PM2 configuration
    echo "  → Saving PM2 configuration..."
    pm2 save
    
    # Wait for startup
    sleep 2
    
    # Check status
    echo "  → Checking service status..."
    pm2 list
START

# Step 4: Verify relay is working
echo ""
echo "📋 Step 4: Verifying relay health..."
echo "  → Waiting for service to initialize..."
sleep 5

echo "  → Testing health endpoint (3 attempts)..."
for i in {1..3}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "http://$VPS_HOST:7660/health" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "  ✅ Relay is HEALTHY and responding! (attempt $i)"
        echo ""
        curl -s "http://$VPS_HOST:7660/health" | python3 -m json.tool 2>/dev/null || curl -s "http://$VPS_HOST:7660/health"
        HEALTH_OK=true
        break
    else
        echo "  ⚠️  Attempt $i failed (HTTP $HTTP_CODE), retrying..."
        sleep 3
    fi
done

if [ "$HEALTH_OK" != "true" ]; then
    echo "  ❌ Relay health check failed after 3 attempts"
    echo "  Fetching logs..."
    sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" 'pm2 logs vps-relay --lines 20 --nostream'
    echo ""
    echo "  💡 Tip: Run './restore-vps-backup.sh' to restore working state"
    exit 1
fi

# Step 5: Final status check
echo ""
echo "📋 Step 5: Final status check..."
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'STATUS'
    echo "PM2 Status:"
    pm2 status
    echo ""
    echo "Port 7660 Status:"
    lsof -i:7660 || echo "No process on port 7660"
STATUS

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VPS Relay Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Service Details:"
echo "  • Endpoint: http://$VPS_HOST:7660"
echo "  • Health: http://$VPS_HOST:7660/health"
echo "  • PM2 Name: $PM2_NAME"
echo ""
echo "🔍 Monitor logs with:"
echo "  ssh root@$VPS_HOST 'pm2 logs $PM2_NAME'"
echo ""
