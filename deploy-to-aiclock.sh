#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy to AIClock (PRODUCTION) — aiclock-82608
# Automatically swaps firebase.js to production config, deploys, then restores.
# ─────────────────────────────────────────────────────────────────────────────

set -e

FIREBASE_JS="src/config/firebase.js"
BACKUP="src/config/firebase.js.test-backup"

echo "🔄 Backing up test firebase.js..."
cp "$FIREBASE_JS" "$BACKUP"

echo "🔧 Swapping to PRODUCTION config (aiclock-82608)..."
cat > "$FIREBASE_JS" << 'EOF'
// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// PRODUCTION environment — aiclock-82608
const firebaseConfig = {
  apiKey: "AIzaSyAmKmv9cmWEhTGpuxWxVu3vOKvpJLVUXx0",
  authDomain: "aiclock-82608.firebaseapp.com",
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.firebasestorage.app",
  messagingSenderId: "434208200088",
  appId: "1:434208200088:web:1ef0ac8a89a3e2cdd94a50"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services (analytics guarded to avoid crash in restricted environments)
let analytics = null;
try { analytics = getAnalytics(app); } catch(e) {}
const db = getFirestore(app);

// Export initialized services
export { app, analytics, db };
EOF

echo "🚀 Deploying to aiclock-82608 (PRODUCTION)..."
firebase deploy --only hosting --project aiclock-82608

echo "♻️  Restoring test firebase.js..."
cp "$BACKUP" "$FIREBASE_JS"
rm "$BACKUP"

echo "✅ Production deploy complete. firebase.js restored to TEST config."
