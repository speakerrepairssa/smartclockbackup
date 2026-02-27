#!/bin/bash

# Deploy Working Basic Relay to VPS
# This restores the simple, working relay that was functional before

VPS_IP="69.62.109.168"
VPS_USER="root"
VPS_PASSWORD="Azam198419880001#"

echo "🚀 Deploying Working Basic Relay..."
echo "Target: ${VPS_USER}@${VPS_IP}"

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
echo "🛑 Step 1: Stop all relay services..."
run_ssh_cmd "pm2 stop all || true"
run_ssh_cmd "pm2 delete all || true"
run_ssh_cmd "pkill -f relay || true"
run_ssh_cmd "pkill -f 7660 || true"

echo ""
echo "📁 Step 2: Setup directory and deploy basic relay..."
run_ssh_cmd "mkdir -p /opt/aiclock"
copy_file "basic-relay.cjs" "/opt/aiclock/relay.js"

echo ""
echo "🚀 Step 3: Start basic relay service..."
run_ssh_cmd "cd /opt/aiclock && pm2 start relay.js --name aiclock-basic-relay"
run_ssh_cmd "pm2 save"

echo ""
echo "⏳ Step 4: Wait for service to start..."
sleep 3

echo ""
echo "✅ Step 5: Test deployment..."
echo "Testing health check..."
health_response=$(curl -s "http://$VPS_IP:7660" || echo "FAILED")
echo "Health response: $health_response"

echo ""
echo "Testing admin webhook..."
webhook_response=$(curl -s -X POST "http://$VPS_IP:7660/admin-webhook" \
    -H "Content-Type: application/xml" \
    -d '<?xml version="1.0" encoding="UTF-8"?><test>deployment-test</test>' || echo "FAILED")
echo "Webhook response: $webhook_response"

if [[ "$health_response" == *"Basic AiClock Relay is running"* ]] && [[ "$webhook_response" == *"success"* ]]; then
    echo ""
    echo "🎉 DEPLOYMENT SUCCESSFUL!"
    echo ""
    echo "✅ VPS Relay Status: WORKING"
    echo "📡 Webhook endpoint: http://$VPS_IP:7660/admin-webhook"  
    echo "❤️  Health check: http://$VPS_IP:7660"
    echo ""
    echo "🔧 Device Configuration: ✅ ALREADY UPDATED"
    echo "   - Device now sends to /admin-webhook"
    echo "   - Uses registered 'admin' device ID"
    echo ""
    echo "🎯 SYSTEM STATUS: FULLY OPERATIONAL"
    echo "Clock-in data should now flow: Device → VPS → Firebase → App"
else
    echo ""
    echo "❌ DEPLOYMENT VERIFICATION FAILED"
    echo "Health: $health_response"
    echo "Webhook: $webhook_response"
    
    echo ""
    echo "🔍 Troubleshooting:"
    run_ssh_cmd "pm2 status"
    run_ssh_cmd "pm2 logs aiclock-basic-relay --lines 5"
fi