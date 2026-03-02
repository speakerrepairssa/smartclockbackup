#!/bin/bash
# Isolated Payslips Service Deployment
# This script deploys ONLY the payslips service without affecting VPS relay or main functions

set -e

echo "🚀 Deploying Payslips Service"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if payslips service directory exists
if [ ! -d "functions/payslips-service" ]; then
    echo "❌ Error: functions/payslips-service directory not found"
    exit 1
fi

echo "✓ Payslips service directory found"

# Install dependencies if node_modules doesn't exist
if [ ! -d "functions/payslips-service/node_modules" ]; then
    echo ""
    echo "📋 Step 1: Installing dependencies..."
    cd functions/payslips-service
    npm install
    cd ../..
    echo "✓ Dependencies installed"
else
    echo "✓ Dependencies already installed"
fi

# Deploy payslips service only
echo ""
echo "📋 Step 2: Deploying payslips service to Firebase..."
echo ""

firebase deploy --only functions:payslips-service

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Payslips Service Deployment Complete!"
echo ""
echo "📊 Deployed Functions:"
echo "  • sendPayslips (us-central1)"
echo "  • processScheduledPayslips (us-central1)"
echo ""
echo "🔍 Verify:"
echo "  firebase functions:log --only payslips-service"
echo ""
