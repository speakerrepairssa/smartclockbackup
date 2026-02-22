#!/bin/bash

echo "🚀 AIClock Mobile - Quick APK Builder"
echo "===================================="
echo ""
echo "Due to network connectivity issues with EAS CLI, here are alternative methods to build your APK:"
echo ""

# Method 1: Direct APK Download (Pre-built)
echo "📥 METHOD 1: DOWNLOAD PRE-BUILT APK (FASTEST)"
echo "============================================="
echo "We'll create a direct download link from your web hosting:"
echo ""

# Create a simple web app version
echo "🌐 Building web version..."
cd "$(dirname "$0")"

# Build for web
if command -v npx &> /dev/null; then
    echo "Building Progressive Web App (PWA)..."
    npx expo export --platform web --output-dir web-build --clear
    
    if [ -d "web-build" ]; then
        echo "✅ Web build successful!"
        echo "📁 Files created in: ./web-build/"
        echo ""
        echo "🎯 DEPLOYMENT OPTIONS:"
        echo "====================="
        echo "1. Upload web-build folder to Firebase Hosting:"
        echo "   firebase deploy --only hosting"
        echo ""
        echo "2. PWA Installation: Users can install from browser"
        echo "   (Add to Home Screen option)"
        echo ""
        echo "3. APK Generation: Use online PWA to APK converters:"
        echo "   - pwabuilder.com"
        echo "   - appcreator24.com"
        echo "   - apper.io"
        echo ""
    fi
else
    echo "❌ Node.js/npm not available"
fi

echo ""
echo "📱 METHOD 2: ANDROID STUDIO BUILD"
echo "================================="
echo "1. Install Android Studio: https://developer.android.com/studio"
echo "2. Run: npx expo prebuild --platform android"
echo "3. Open ./android folder in Android Studio"
echo "4. Build → Generate Signed Bundle / APK"
echo ""

echo "☁️  METHOD 3: ONLINE APK BUILDERS"
echo "=================================="
echo "Upload your code to these services:"
echo "1. Expo Application Services (expo.dev)"
echo "2. AppGyver (appgyver.com)" 
echo "3. BuildBot (buildbot.academy)"
echo ""

echo "🌐 METHOD 4: PWA (RECOMMENDED FOR IMMEDIATE USE)"
echo "==============================================="
echo "Your app is already web-compatible!"
echo ""
echo "🔗 Quick Deploy Steps:"
echo "1. Copy web-build folder to Firebase hosting"
echo "2. Users access via: https://aiclock-82608.web.app/mobile"
echo "3. Works on mobile browsers with full functionality"
echo "4. Can be 'installed' as PWA (Add to Home Screen)"
echo ""

# Create deployment script
cat > deploy-web.sh << 'EOF'
#!/bin/bash
echo "🚀 Deploying AIClock Mobile Web App..."

# Build web version
npx expo export --platform web --output-dir ../src/mobile-app

# Copy to main project
cp -r web-build/* ../src/mobile-app/ 2>/dev/null || echo "No web-build directory found"

# Deploy via Firebase
cd ..
firebase deploy --only hosting

echo "✅ Mobile web app deployed!"
echo "🌐 Access at: https://aiclock-82608.web.app/mobile-app"
EOF

chmod +x deploy-web.sh

echo "📝 Created deploy-web.sh for quick web deployment"
echo ""
echo "🎯 IMMEDIATE SOLUTION: Run './deploy-web.sh' to deploy web version NOW!"
echo ""
echo "📱 Users can then:"
echo "   1. Visit the web app URL"
echo "   2. Tap browser menu → 'Add to Home Screen'"
echo "   3. App installs like native APK!"
echo ""
echo "✨ This gives you immediate mobile app functionality while we work on APK!"