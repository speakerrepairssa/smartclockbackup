#!/bin/bash

echo "🚀 AIClock Mobile App - Build Script"
echo "================================="

# Check if Android SDK is installed
if ! command -v adb &> /dev/null; then
    echo "⚠️  Android SDK not found. Installing via Android Studio is recommended."
    echo "   Download from: https://developer.android.com/studio"
    exit 1
fi

# Navigate to mobile directory
cd "$(dirname "$0")"

echo "📦 Installing dependencies..."
npm install

echo "🔧 Setting up build environment..."

# Create app.json with proper configuration
cat > app.json << EOF
{
  "expo": {
    "name": "AIClock Staff",
    "slug": "aiclock-staff",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#667eea"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "package": "com.srsa.aiclockapp",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#667eea"
      },
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png",
      "bundler": "metro"
    },
    "extra": {
      "eas": {
        "projectId": "704c1301-f497-4481-b69f-44f9a7631d89"
      }
    }
  }
}
EOF

echo "🎨 Creating app icons..."
mkdir -p assets

# Create simple icon files (you can replace these with custom icons)
echo "Creating placeholder icons..."

# Create a simple icon using ImageMagick (if available) or provide instructions
if command -v convert &> /dev/null; then
    # Create 1024x1024 icon
    convert -size 1024x1024 canvas:#667eea -fill white -pointsize 200 -gravity center -annotate 0 "⏰" assets/icon.png
    # Create adaptive icon
    cp assets/icon.png assets/adaptive-icon.png
    # Create splash screen
    convert -size 1024x1536 canvas:#667eea -fill white -pointsize 300 -gravity center -annotate 0 "AIClock\nStaff" assets/splash.png
    # Create favicon
    convert assets/icon.png -resize 32x32 assets/favicon.png
    echo "✅ Icons created successfully"
else
    echo "⚠️  ImageMagick not found. Please add icons manually:"
    echo "   - assets/icon.png (1024x1024)"
    echo "   - assets/adaptive-icon.png (1024x1024)"
    echo "   - assets/splash.png (1024x1536)"
    echo "   - assets/favicon.png (32x32)"
fi

echo "🛠️ Build options:"
echo "1. EAS Build (Cloud)"
echo "2. Expo Development Build (Local)"
echo "3. Web Build (PWA)"
echo "4. Android Studio (Native)"

read -p "Select build option (1-4): " BUILD_OPTION

case $BUILD_OPTION in
    1)
        echo "☁️  Starting EAS Build..."
        if command -v eas &> /dev/null; then
            eas build --platform android --profile production
        else
            echo "Installing EAS CLI..."
            npm install -g eas-cli
            eas login
            eas build --platform android --profile production
        fi
        ;;
    2)
        echo "🔨 Starting Development Build..."
        npx expo run:android
        ;;
    3)
        echo "🌐 Building for Web (PWA)..."
        npx expo build:web
        echo "✅ Web build complete! Deploy the 'web-build' folder to your hosting service."
        ;;
    4)
        echo "📱 Setting up for Android Studio..."
        npx expo eject
        echo "✅ Project ejected! Open 'android' folder in Android Studio to build APK."
        ;;
    *)
        echo "❌ Invalid option selected"
        exit 1
        ;;
esac

echo "✅ Build process completed!"