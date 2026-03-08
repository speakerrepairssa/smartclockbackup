#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy to AIClock (PRODUCTION) — aiclock-82608
#
# Flips src/config/env.js to 'production' so firebase.js picks the correct
# project even on custom domains (e.g. aiclock.co.za).
# Restores env.js to 'development' after deploy.
# ─────────────────────────────────────────────────────────────────────────────

set -e

ENV_JS="src/config/env.js"

echo "🔧 Setting env.js → production..."
cat > "$ENV_JS" << 'EOF'
// Environment marker — managed by deploy-to-aiclock.sh
export const ENV = 'production';
EOF

echo "🚀 Deploying to aiclock-82608 (PRODUCTION)..."
firebase deploy --only hosting --project aiclock-82608

echo "♻️  Restoring env.js → development..."
cat > "$ENV_JS" << 'EOF'
// Environment marker — automatically managed by deploy-to-aiclock.sh
// Committed value: 'development' (safe default → smartclock-v2-8271f test project)
// On aiclock production deploy, the script temporarily sets this to 'production'
// DO NOT manually edit this file.
export const ENV = 'development';
EOF

echo "✅ Production deploy complete. env.js restored to development."
