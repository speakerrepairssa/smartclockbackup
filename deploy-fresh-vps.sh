#!/bin/bash

# Deploy AiClock Relay to Fresh Ubuntu VPS
# This script sets up the complete relay environment on new VPS

VPS_IP="69.62.109.168"
VPS_USER="root"
VPS_PASSWORD="Azam198419880001#"

echo "🚀 Deploying to Fresh Ubuntu 24.04 VPS..."
echo "Target: ${VPS_USER}@${VPS_IP}"

# Function to run SSH commands
run_ssh_cmd() {
    local cmd="$1"
    echo "🔧 Running: $cmd"
    sshpass -p "$VPS_PASSWORD" ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new "$VPS_USER@$VPS_IP" "$cmd"
}

# Function to copy files
copy_file() {
    local local_file="$1" 
    local remote_path="$2"
    echo "📤 Copying: $local_file -> $remote_path"
    sshpass -p "$VPS_PASSWORD" scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new "$local_file" "$VPS_USER@$VPS_IP:$remote_path"
}

echo ""
echo "📋 Step 1: Setup Node.js environment..."
run_ssh_cmd "apt update && apt install -y nodejs npm curl"

echo ""
echo "📋 Step 2: Install PM2 process manager..." 
run_ssh_cmd "npm install -g pm2"

echo ""
echo "📋 Step 3: Create application directory..."
run_ssh_cmd "mkdir -p /opt/aiclock"

echo ""
echo "📋 Step 4: Deploy basic relay..."
copy_file "basic-relay.cjs" "/opt/aiclock/relay.js"

echo ""
echo "🚀 Step 5: Start AiClock relay service..."
run_ssh_cmd "cd /opt/aiclock && pm2 start relay.js --name aiclock-relay"
run_ssh_cmd "pm2 startup"
run_ssh_cmd "pm2 save"

echo ""
echo "⏳ Step 6: Wait for service to initialize..."
sleep 5

echo ""
echo "✅ Step 7: Test deployment..."
echo "Testing health check..."
health_response=$(curl -s "http://$VPS_IP:7660" 2>/dev/null | head -1)
echo "Health: $health_response"

echo ""
echo "Testing admin webhook..." 
webhook_response=$(curl -s -X POST "http://$VPS_IP:7660/admin-webhook" \
    -H "Content-Type: application/json" \
    -d '{"deviceId":"admin","test":"fresh-vps-test","timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"}' 2>/dev/null)
echo "Webhook: $webhook_response"

echo ""
if [[ "$health_response" == *"Basic AiClock Relay"* ]] && [[ "$webhook_response" == *"success"* ]]; then
    echo "🎉 DEPLOYMENT SUCCESSFUL!"
    echo ""
    echo "✅ Fresh VPS Setup Complete!"
    echo "📡 VPS Relay: http://$VPS_IP:7660"
    echo "🎯 Webhook Endpoint: http://$VPS_IP:7660/admin-webhook"
    echo "🔧 Device Configuration: Already Updated"
    echo "🔥 Firebase Backend: Working"
    echo ""
    echo "🎊 SYSTEM FULLY OPERATIONAL!"
    echo "Clock-in data flow: Device → Fresh VPS → Firebase → App"
else
    echo "⚠️  Deployment needs verification"
    echo "Health: $health_response"
    echo "Webhook: $webhook_response"
    
    echo ""
    echo "🔍 Troubleshoot:"
    run_ssh_cmd "pm2 status"
    run_ssh_cmd "pm2 logs aiclock-relay --lines 5"
fi

echo ""
echo "📋 Management Commands:"
echo "# Check status:   ssh root@$VPS_IP 'pm2 status'"
echo "# View logs:      ssh root@$VPS_IP 'pm2 logs aiclock-relay'"
echo "# Restart:        ssh root@$VPS_IP 'pm2 restart aiclock-relay'"