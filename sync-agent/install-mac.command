#!/bin/bash
# SmartClock Connector — macOS Installer
# Double-click this file in Finder to run

INSTALL_DIR="$HOME/SmartClockConnector"
PLIST_PATH="$HOME/Library/LaunchAgents/co.smartclock.connector.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo " ====================================================="
echo "  SmartClock Connector — macOS Installer"
echo " ====================================================="
echo ""

# ── Detect macOS version + architecture ──────────────────
MACOS_VER=$(sw_vers -productVersion)
MACOS_MAJOR=$(echo "$MACOS_VER" | cut -d. -f1)
MACOS_MINOR=$(echo "$MACOS_VER" | cut -d. -f2)
ARCH=$(uname -m)   # arm64 = Apple Silicon, x86_64 = Intel

echo " [i] macOS version : $MACOS_VER"
if [ "$ARCH" = "arm64" ]; then
  echo " [i] Chip          : Apple Silicon (M1/M2/M3)"
else
  echo " [i] Chip          : Intel (x86_64)"
fi

# ── Resolve required Node.js version and direct download URL ──
# Compatibility matrix:
#   macOS 10.13 High Sierra  → Node v16 (last supported), Intel only
#   macOS 10.14 Mojave       → Node v16 (last supported), Intel only
#   macOS 10.15 Catalina     → Node v18 (last supported), Intel only
#   macOS 11 Big Sur+        → Node v20 LTS, Intel or Apple Silicon
#   macOS 12 Monterey+       → Node v20 LTS, Intel or Apple Silicon
resolve_node_url() {
  if [ "$MACOS_MAJOR" -eq 10 ] && [ "$MACOS_MINOR" -le 14 ]; then
    NODE_VER="v16.20.2"
    NODE_LABEL="v16 LTS (required for macOS $MACOS_VER)"
    NODE_URL="https://nodejs.org/dist/v16.20.2/node-v16.20.2.pkg"
  elif [ "$MACOS_MAJOR" -eq 10 ] && [ "$MACOS_MINOR" -eq 15 ]; then
    NODE_VER="v18.20.8"
    NODE_LABEL="v18 LTS (required for macOS $MACOS_VER)"
    NODE_URL="https://nodejs.org/dist/v18.20.8/node-v18.20.8.pkg"
  else
    NODE_VER="v20.19.0"
    if [ "$ARCH" = "arm64" ]; then
      NODE_LABEL="v20 LTS — Apple Silicon"
      NODE_URL="https://nodejs.org/dist/v20.19.0/node-v20.19.0-darwin-arm64.pkg"
    else
      NODE_LABEL="v20 LTS — Intel"
      NODE_URL="https://nodejs.org/dist/v20.19.0/node-v20.19.0-darwin-x64.pkg"
    fi
  fi
}

# ── Check for Node.js ─────────────────────────────────────
NODE_OK=false
if command -v node &>/dev/null; then
  NODEVER=$(node --version 2>/dev/null) && NODE_OK=true || true
fi

if [ "$NODE_OK" = false ]; then
  resolve_node_url
  echo ""
  echo " [!] Node.js is not installed or is incompatible with your macOS."
  echo ""
  echo " Required : Node.js $NODE_LABEL"
  echo " Direct download link:"
  echo " $NODE_URL"
  echo ""
  echo " Opening installer download now..."
  open "$NODE_URL"
  echo ""
  echo " ── Steps ────────────────────────────────────────────"
  echo "  1. Wait for the .pkg file to finish downloading"
  echo "  2. Open it and follow the installer steps"
  echo "  3. Once installed, run this installer again"
  echo " ─────────────────────────────────────────────────────"
  echo ""
  read -p " Press Enter to exit..."
  exit 1
fi

echo " [ok] Node.js found: $NODEVER"

set -e

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
