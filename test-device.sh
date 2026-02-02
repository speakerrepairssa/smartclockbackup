#!/bin/bash

echo "🔍 DEVICE ENDPOINT TESTING"
echo "=========================="
echo "Device: 192.168.0.114"
echo "Credentials: admin / Azam198419880001"
echo ""

# Test basic connectivity
echo "📡 1. Basic HTTP Connectivity:"
curl -I --connect-timeout 3 http://192.168.0.114 2>/dev/null | head -1 || echo "❌ HTTP connection failed"
echo ""

# Test HTTPS connectivity  
echo "🔒 2. HTTPS Connectivity:"
curl -k -I --connect-timeout 3 https://192.168.0.114 2>/dev/null | head -1 || echo "❌ HTTPS connection failed"
echo ""

# Test device info
echo "📋 3. Device Info (with auth):"
curl -k -s --connect-timeout 3 -u admin:Azam198419880001 https://192.168.0.114/ISAPI/System/deviceInfo 2>/dev/null | head -3 || echo "❌ Device info failed"
echo ""

# Test access control events
echo "👥 4. Access Control Events:"
curl -k -s --connect-timeout 3 -u admin:Azam198419880001 https://192.168.0.114/ISAPI/AccessControl/AcsEvent 2>/dev/null | head -3 || echo "❌ AcsEvent failed"
echo ""

# Test with parameters
echo "🔍 5. Events with Parameters:"
curl -k -s --connect-timeout 3 -u admin:Azam198419880001 "https://192.168.0.114/ISAPI/AccessControl/AcsEvent?format=json&maxResults=5" 2>/dev/null | head -3 || echo "❌ Events with params failed"
echo ""

# Test capabilities
echo "🎯 6. Device Capabilities:"
curl -k -s --connect-timeout 3 -u admin:Azam198419880001 https://192.168.0.114/ISAPI/System/capabilities 2>/dev/null | head -3 || echo "❌ Capabilities failed"
echo ""

# Test HTTP version
echo "🌐 7. HTTP Events:"
curl -s --connect-timeout 3 -u admin:Azam198419880001 "http://192.168.0.114/ISAPI/AccessControl/AcsEvent?format=json" 2>/dev/null | head -3 || echo "❌ HTTP events failed"
echo ""

echo "✅ Test complete! Results show what your device actually supports."