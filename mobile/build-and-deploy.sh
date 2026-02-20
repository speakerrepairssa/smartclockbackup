#!/bin/bash

# AIClock Staff App - Build and Deploy Script
# This script builds the Android APK and deploys it to Firebase Hosting

set -e  # Exit on error

echo "🚀 AIClock Staff App - Build & Deploy"
echo "======================================"
echo ""

# Step 1: Check if we're in the mobile directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from mobile/ directory"
    exit 1
fi

# Step 2: Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Step 3: Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "📥 Installing EAS CLI globally..."
    npm install -g eas-cli
fi

# Step 4: Login to Expo (if not already logged in)
echo "🔐 Checking Expo login status..."
if ! eas whoami &> /dev/null; then
    echo "Please login to your Expo account:"
    eas login
fi

# Step 5: Configure EAS Build (if not configured)
if [ ! -f "eas.json" ]; then
    echo "⚙️  Configuring EAS Build..."
    cat > eas.json <<EOF
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
EOF
fi

# Step 6: Build the APK
echo "🔨 Building Android APK..."
echo "This may take 10-15 minutes. Build will run on Expo's servers."
eas build --platform android --profile preview --non-interactive

# Step 7: Download the APK
echo "📥 Build complete! Downloading APK..."
echo "Please download the APK from the link provided by EAS Build above."
echo ""
echo "To upload to Firebase Hosting:"
echo "1. Download the APK from the EAS Build link"
echo "2. Rename it to: aiclock-staff-v1.0.0.apk"
echo "3. Create directory: mkdir -p ../src/downloads"
echo "4. Move APK: mv ~/Downloads/build-*.apk ../src/downloads/aiclock-staff-v1.0.0.apk"
echo "5. Deploy: cd .. && firebase deploy --only hosting"
echo ""
echo "✅ Build script complete!"
