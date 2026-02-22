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
