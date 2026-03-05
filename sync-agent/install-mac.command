#!/bin/bash
# SmartClock Connector — macOS Installer
# Double-click this file in Finder to run

set -e

INSTALL_DIR="$HOME/SmartClockConnector"
PLIST_PATH="$HOME/Library/LaunchAgents/co.smartclock.connector.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo " ====================================================="
echo "  SmartClock Connector — macOS Installer"
echo " ====================================================="
echo ""

# ── Check for Node.js ─────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo " [!] Node.js is not installed."
  echo "     Opening download page..."
  open "https://nodejs.org/en/download"
  echo ""
  echo " Please install Node.js LTS, then run this installer again."
  read -p " Press Enter to exit..."
  exit 1
fi

NODEVER=$(node --version)
echo " [ok] Node.js found: $NODEVER"

# ── Install files ─────────────────────────────────────────
echo ""
echo " Installing to: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

cp -f "$SCRIPT_DIR/sync-agent.cjs"      "$INSTALL_DIR/"
cp -f "$SCRIPT_DIR/package.json"        "$INSTALL_DIR/"
cp -f "$SCRIPT_DIR/install-service.cjs" "$INSTALL_DIR/" 2>/dev/null || true

echo " [ok] Files copied"

# ── npm install ───────────────────────────────────────────
cd "$INSTALL_DIR"
echo " [..] Installing dependencies (takes ~30 seconds)..."
npm install --prefer-offline --quiet 2>/dev/null || npm install --quiet
echo " [ok] Dependencies installed"

# ── LaunchAgent (auto-start on login) ─────────────────────
NODE_BIN="$(which node)"

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>co.smartclock.connector</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_BIN}</string>
        <string>${INSTALL_DIR}/sync-agent.cjs</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${INSTALL_DIR}/connector.log</string>
    <key>StandardErrorPath</key>
    <string>${INSTALL_DIR}/connector-error.log</string>
</dict>
</plist>
PLIST

# Load the LaunchAgent now (start immediately)
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo " [ok] LaunchAgent installed (auto-starts at login)"
echo ""
echo " ====================================================="
echo "  Setup wizard opening at http://localhost:7663"
echo " ====================================================="
echo ""

# Wait for the server to be ready (up to 20 seconds)
echo " [..] Waiting for connector to start..."
for i in $(seq 1 20); do
  if curl -s --max-time 1 http://localhost:7663 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

open "http://localhost:7663"

echo ""
echo " [ok] Done! Complete the setup in your browser."
echo ""
read -p " Press Enter to close this window..."
