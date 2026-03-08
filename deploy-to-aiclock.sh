#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy to AIClock (PRODUCTION) — aiclock-82608
#
# firebase.js now AUTO-DETECTS the environment at runtime via hostname,
# so NO config swapping is needed. Just deploy directly.
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "🚀 Deploying to aiclock-82608 (PRODUCTION)..."
firebase deploy --only hosting --project aiclock-82608

echo "✅ Production deploy complete."
