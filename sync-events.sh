#!/bin/bash

# 🎯 HIKVISION EVENT SYNC - AUTOMATED RUNNER
# Easy script to run the event sync with different options

echo "🎯 HIKVISION EVENT SYNC TOOL"
echo "============================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm init -y 2>/dev/null
    npm install axios xml2js 2>/dev/null
fi

echo "Select sync option:"
echo "1. Sync last 7 days"
echo "2. Sync last 30 days"  
echo "3. Sync specific date range"
echo "4. Sync today only"
echo "5. Custom configuration"
echo ""
read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo "📅 Syncing last 7 days..."
        START_DATE=$(date -j -v-7d +%Y-%m-%d 2>/dev/null || date -d "7 days ago" +%Y-%m-%d)
        END_DATE=$(date +%Y-%m-%d)
        ;;
    2)
        echo "📅 Syncing last 30 days..."
        START_DATE=$(date -j -v-30d +%Y-%m-%d 2>/dev/null || date -d "30 days ago" +%Y-%m-%d)
        END_DATE=$(date +%Y-%m-%d)
        ;;
    3)
        echo "📅 Enter date range (YYYY-MM-DD format):"
        read -p "Start date: " START_DATE
        read -p "End date: " END_DATE
        ;;
    4)
        echo "📅 Syncing today only..."
        START_DATE=$(date +%Y-%m-%d)
        END_DATE=$(date +%Y-%m-%d)
        ;;
    5)
        echo "📝 Edit hikvision-event-sync.js for custom configuration"
        START_DATE=""
        END_DATE=""
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

if [ -n "$START_DATE" ] && [ -n "$END_DATE" ]; then
    echo "🚀 Running sync from $START_DATE to $END_DATE..."
    
    # Create temporary config with date range
    cat > temp-config.js << EOF
const { CONFIG } = require('./hikvision-event-sync.js');

// Override date range
CONFIG.dateRange.startDate = '$START_DATE';
CONFIG.dateRange.endDate = '$END_DATE';

// Update device passwords if needed
CONFIG.devices.forEach(device => {
    if (device.password === 'your_password_here') {
        console.log('⚠️  Please update device password for', device.name);
    }
});

// Run the sync
const { main } = require('./hikvision-event-sync.js');
main().catch(console.error);
EOF

    node temp-config.js
    rm temp-config.js
else
    echo "📝 Please edit hikvision-event-sync.js to configure devices and date range"
    echo "Then run: node hikvision-event-sync.js"
fi

echo ""
echo "📋 Output files generated:"
echo "- hikvision-events.csv (spreadsheet format)"
echo "- hikvision-events.json (raw data)"
echo "- firebase-import.json (Firebase format)"
echo ""
echo "✅ Sync complete!"