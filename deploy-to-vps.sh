#!/bin/bash

# Automated SSH Deployment Script for Hikvision WebSDK Service
# Deploys to Hostinger VPS: 69.62.109.168

set -e

# VPS Configuration
VPS_HOST="69.62.109.168"
VPS_USER="root"
VPS_PASSWORD="Azam198419880001#"
SERVICE_NAME="hikvision-websdk"
REMOTE_DIR="/opt/hikvision-sync"

echo "🚀 Starting automated deployment to Hostinger VPS..."
echo "📡 Target: ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}"

# Function to run SSH commands
run_ssh() {
    sshpass -p "${VPS_PASSWORD}" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" "$1"
}

# Function to upload files
upload_files() {
    echo "📤 Uploading WebSDK service files..."
    sshpass -p "${VPS_PASSWORD}" scp -o StrictHostKeyChecking=no -r \
        "hikvision-sync-service/" \
        "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/"
}

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo "⚠️  sshpass not found. Installing..."
    if command -v brew &> /dev/null; then
        brew install hudochenkov/sshpass/sshpass
    else
        echo "❌ Please install sshpass manually: brew install hudochenkov/sshpass/sshpass"
        exit 1
    fi
fi

# Test VPS connection
echo "🔍 Testing VPS connection..."
if run_ssh "echo 'VPS connection successful'"; then
    echo "✅ VPS connection established"
else
    echo "❌ Failed to connect to VPS"
    exit 1
fi

# Create remote directory
echo "📁 Creating remote directory..."
run_ssh "mkdir -p ${REMOTE_DIR}"

# Upload files
upload_files

# Install Node.js if not present
echo "🔧 Setting up Node.js environment..."
run_ssh "
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    fi
    node --version
    npm --version
"

# Install dependencies
echo "📦 Installing NPM dependencies..."
run_ssh "cd ${REMOTE_DIR} && npm install"

# Install PM2 for process management
echo "🔄 Installing PM2..."
run_ssh "npm install -g pm2"

# Stop existing service if running
echo "🛑 Stopping existing service..."
run_ssh "pm2 delete ${SERVICE_NAME} || true"

# Start the WebSDK service
echo "🚀 Starting WebSDK service..."
run_ssh "cd ${REMOTE_DIR} && pm2 start websdk-server.js --name ${SERVICE_NAME}"

# Save PM2 configuration
run_ssh "pm2 save && pm2 startup"

# Test service
echo "🔍 Testing deployed service..."
sleep 5

if run_ssh "curl -s http://localhost:3002/health | grep 'healthy'"; then
    echo "✅ Service is running successfully!"
    
    # Show service status
    run_ssh "pm2 status"
    
    echo ""
    echo "🎉 Deployment Complete!"
    echo "📊 Service Status: http://${VPS_HOST}:3002/health"
    echo "🔧 WebSDK Interface: http://${VPS_HOST}:3002/interface"
    echo "🎯 Extract Endpoint: http://${VPS_HOST}:3002/device/extract"
    echo ""
    echo "💡 Update your AiClock dashboard VPS URL to: http://${VPS_HOST}:3002"
    
else
    echo "❌ Service failed to start properly"
    run_ssh "pm2 logs ${SERVICE_NAME} --lines 20"
    exit 1
fi