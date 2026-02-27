#!/bin/bash

# Deploy Fixed VPS Relay - Device ID Parsing Fix
# This script stops the current relay and deploys the fixed version

VPS_IP="69.62.109.168"
VPS_USER="root"
VPS_PASSWORD="Azam198419880001#"
RELAY_FILE="vps-relay-fixed.js"

echo "🚀 Deploying Fixed VPS Relay..."
echo "Target: ${VPS_USER}@${VPS_IP}"
echo "File: ${RELAY_FILE}"

# Check if the fixed relay file exists
if [[ ! -f "$RELAY_FILE" ]]; then
    echo "❌ Error: $RELAY_FILE not found!"
    exit 1
fi

echo "📋 Deployment Steps:"
echo "1. Stop current relay service"
echo "2. Upload fixed relay code" 
echo "3. Start new relay service"
echo "4. Test connectivity"

# Function to run SSH commands
run_ssh_cmd() {
    local cmd="$1"
    echo "🔧 Running: $cmd"
    sshpass -p "$VPS_PASSWORD" ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no "$VPS_USER@$VPS_IP" "$cmd"
}

# Function to copy files
copy_file() {
    local local_file="$1" 
    local remote_path="$2"
    echo "📤 Copying: $local_file -> $remote_path"
    sshpass -p "$VPS_PASSWORD" scp -o PreferredAuthentications=password -o PubkeyAuthentication=no "$local_file" "$VPS_USER@$VPS_IP:$remote_path"
}

echo ""
echo "🛑 Step 1: Stop current relay services..."
run_ssh_cmd "pm2 stop all || true"
run_ssh_cmd "pkill -f relay || true"
run_ssh_cmd "pkill -f 7660 || true"

echo ""
echo "📁 Step 2: Setup directory and upload fixed relay..."
run_ssh_cmd "mkdir -p /opt/aiclock"
copy_file "$RELAY_FILE" "/opt/aiclock/relay.js"

echo ""
echo "🚀 Step 3: Start fixed relay service..."
run_ssh_cmd "cd /opt/aiclock && pm2 start relay.js --name aiclock-relay-fixed"
run_ssh_cmd "pm2 save"

echo ""
echo "⏳ Step 4: Wait for service to start..."
sleep 3

echo ""
echo "✅ Step 5: Test connectivity..."
echo "Testing health check..."
curl -s "http://$VPS_IP:7660" || echo "❌ Health check failed"

echo ""
echo "Testing webhook endpoint..."
response=$(curl -s -X POST "http://$VPS_IP:7660/fc4349999-webhook" \
    -H "Content-Type: application/xml" \
    -d '<?xml version="1.0" encoding="UTF-8"?><test>deployment-test</test>')

echo "Webhook response: $response"

if [[ "$response" == *"success"* ]]; then
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo ""
    echo "🎯 VPS Relay Fixed and Deployed!"
    echo "📡 Webhook endpoint: http://$VPS_IP:7660/fc4349999-webhook"
    echo "❤️  Health check: http://$VPS_IP:7660"
    echo ""
    echo "🔍 Check PM2 status:"
    echo "   ssh root@$VPS_IP 'pm2 status'"
    echo ""
    echo "📋 View logs:"
    echo "   ssh root@$VPS_IP 'pm2 logs aiclock-relay-fixed'"
else
    echo "❌ DEPLOYMENT VERIFICATION FAILED"
    echo "Response: $response"
    
    echo ""
    echo "🔍 Troubleshooting commands:"
    echo "ssh root@$VPS_IP 'pm2 status'"
    echo "ssh root@$VPS_IP 'pm2 logs aiclock-relay-fixed'"
    echo "ssh root@$VPS_IP 'netstat -tulpn | grep 7660'"
fi

echo ""
echo "📋 Manual verification commands:"
echo "# Test health"
echo "curl http://$VPS_IP:7660"
echo ""
echo "# Test webhook"
echo "curl -X POST \"http://$VPS_IP:7660/fc4349999-webhook\" -H \"Content-Type: application/xml\" -d '<?xml version=\"1.0\"?><test>manual-test</test>'"
echo ""
echo "# Check logs" 
echo "ssh root@$VPS_IP 'pm2 logs aiclock-relay-fixed --lines 20'"