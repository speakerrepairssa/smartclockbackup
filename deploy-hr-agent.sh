#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-hr-agent.sh
# Deploy SmartClock HR Avatar Agent to existing Hostinger VPS
# Runs ALONGSIDE the existing Hikvision relay — does not touch it.
# ─────────────────────────────────────────────────────────────────────────────
set -e

VPS_HOST="69.62.109.168"
VPS_USER="root"
VPS_PASSWORD="Azam198419880001#"
REMOTE_DIR="/opt/hr-avatar-agent"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)/vps/hr-avatar-agent"

echo "🚀 SmartClock HR Avatar — Deploying to VPS ${VPS_HOST}"
echo "📁 Remote dir: ${REMOTE_DIR}"

# ── Helper ────────────────────────────────────────────────────────────────────
run_ssh() {
  sshpass -p "${VPS_PASSWORD}" ssh -o StrictHostKeyChecking=no \
    "${VPS_USER}@${VPS_HOST}" "$1"
}
upload() {
  sshpass -p "${VPS_PASSWORD}" scp -o StrictHostKeyChecking=no -r \
    "$1" "${VPS_USER}@${VPS_HOST}:$2"
}

# ── Check sshpass ─────────────────────────────────────────────────────────────
if ! command -v sshpass &>/dev/null; then
  echo "⚠️  Installing sshpass..."
  brew install hudochenkov/sshpass/sshpass || { echo "❌ Install sshpass first"; exit 1; }
fi

# ── Verify .env exists (never commit real keys) ───────────────────────────────
if [[ ! -f "${LOCAL_DIR}/.env" ]]; then
  echo "❌  ${LOCAL_DIR}/.env not found."
  echo "    Copy .env.template → .env and fill in your keys before deploying."
  exit 1
fi

echo ""
echo "─── STEP 1: Upload agent files ───────────────────────────────────────────"
run_ssh "mkdir -p ${REMOTE_DIR}"
upload "${LOCAL_DIR}/agent.py"                 "${REMOTE_DIR}/"
upload "${LOCAL_DIR}/prompts.py"               "${REMOTE_DIR}/"
upload "${LOCAL_DIR}/pyproject.toml"           "${REMOTE_DIR}/"
upload "${LOCAL_DIR}/token-server.js"          "${REMOTE_DIR}/"
upload "${LOCAL_DIR}/package.json"             "${REMOTE_DIR}/"
upload "${LOCAL_DIR}/ecosystem-hr.config.js"   "${REMOTE_DIR}/"
upload "${LOCAL_DIR}/.env"                     "${REMOTE_DIR}/"
echo "✅ Files uploaded"

echo ""
echo "─── STEP 2: Install / verify Node.js ────────────────────────────────────"
run_ssh "
  if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi
  echo 'Node '$(node --version)
"

echo ""
echo "─── STEP 3: Install npm dependencies (token-server) ─────────────────────"
run_ssh "cd ${REMOTE_DIR} && npm install --omit=dev"

echo ""
echo "─── STEP 4: Install Python 3.11+ and uv ─────────────────────────────────"
run_ssh "
  # Install Python 3.11 if not present (deadsnakes PPA for Ubuntu)
  if ! python3.11 --version &>/dev/null 2>&1; then
    apt-get update -qq
    apt-get install -y software-properties-common
    add-apt-repository -y ppa:deadsnakes/ppa
    apt-get update -qq
    apt-get install -y python3.11 python3.11-venv python3.11-dev
  fi
  python3.11 --version

  # Install uv (fast Python package manager)
  if ! \$HOME/.local/bin/uv --version &>/dev/null 2>&1; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
  fi
  export PATH=\$HOME/.local/bin:\$PATH
  uv --version
"

echo ""
echo "─── STEP 5: Create venv and install Python agent deps ───────────────────"
run_ssh "
  export PATH=\$HOME/.local/bin:\$PATH
  cd ${REMOTE_DIR}
  uv venv .venv --python python3.11
  .venv/bin/pip install --upgrade pip
  uv pip install --python .venv/bin/python \
    'livekit-agents[openai,bey,silero,turn-detector]~=1.4' \
    'livekit-plugins-noise-cancellation~=0.2' \
    'python-dotenv>=1.0.0'
  echo 'Python deps installed'
"

echo ""
echo "─── STEP 6: Download LiveKit model files ────────────────────────────────"
run_ssh "
  export PATH=\$HOME/.local/bin:\$PATH
  cd ${REMOTE_DIR}
  # Download Silero VAD + turn-detector model files (required before first run)
  .venv/bin/python agent.py download-files || true
  echo 'Model files ready'
"

echo ""
echo "─── STEP 7: Install / verify PM2 ────────────────────────────────────────"
run_ssh "
  if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
  fi
  pm2 --version
"

echo ""
echo "─── STEP 8: Start HR services with PM2 ──────────────────────────────────"
run_ssh "
  cd ${REMOTE_DIR}
  # Stop old instances if they exist
  pm2 delete hr-token-server  2>/dev/null || true
  pm2 delete hr-avatar-agent  2>/dev/null || true

  # Start both services
  pm2 start ${REMOTE_DIR}/ecosystem-hr.config.js
  pm2 save
  echo 'PM2 services started'
"

echo ""
echo "─── STEP 9: Verify token server ─────────────────────────────────────────"
sleep 4
if run_ssh "curl -sf http://localhost:7680/health | grep 'ok'" ; then
  echo "✅ Token server healthy on port 7680"
else
  echo "⚠️  Token server health check failed — check logs:"
  run_ssh "pm2 logs hr-token-server --lines 20 --nostream" || true
fi

echo ""
echo "─── STEP 10: PM2 process list ───────────────────────────────────────────"
run_ssh "pm2 status"

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "✅  HR Avatar Agent deployed!"
echo ""
echo "   Token Server:   http://${VPS_HOST}:7680/health"
echo "   Test token:     http://${VPS_HOST}:7680/token?businessId=TEST&employeeName=Azam"
echo ""
echo "   The Python agent connects OUT to LiveKit Cloud — no new ports needed."
echo "   Existing Hikvision relay on port 7660/7661 is untouched."
echo ""
echo "   📋 Logs:"
echo "      pm2 logs hr-token-server"
echo "      pm2 logs hr-avatar-agent"
echo "═══════════════════════════════════════════════════════════════════════════"
