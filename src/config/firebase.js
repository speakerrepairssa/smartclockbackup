// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─────────────────────────────────────────────────────────────────────────────
// DUAL-PROJECT AUTO-DETECTION
//
// This one file works for BOTH Firebase projects without needing to be swapped.
// It detects the live hostname at runtime:
//   • aiclock-82608.web.app  →  PRODUCTION  (aiclock-82608)
//   • smartclock-v2-8271f.web.app  →  TEST  (smartclock-v2-8271f)
//   • localhost / any other  →  TEST  (safe default for local dev)
//
// deploy-to-aiclock.sh can still be used but NO LONGER needs to swap this file.
// ─────────────────────────────────────────────────────────────────────────────

const _host = (typeof window !== 'undefined' ? window.location.hostname : '');
const _isProd = _host.includes('aiclock-82608') || _host.includes('aiclock82608');

const _testConfig = {
  apiKey: "AIzaSyC6capPBwQDzIyp73i4ML0m9UwqjcfJ_WE",
  authDomain: "smartclock-v2-8271f.firebaseapp.com",
  projectId: "smartclock-v2-8271f",
  storageBucket: "smartclock-v2-8271f.firebasestorage.app",
  messagingSenderId: "994384787802",
  appId: "1:994384787802:web:e08a4db7ae7693c4199b63",
  measurementId: "G-TEXJFZERJ6"
};

const _prodConfig = {
  apiKey: "AIzaSyAmKmv9cmWEhTGpuxWxVu3vOKvpJLVUXx0",
  authDomain: "aiclock-82608.firebaseapp.com",
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.firebasestorage.app",
  messagingSenderId: "434208200088",
  appId: "1:434208200088:web:1ef0ac8a89a3e2cdd94a50"
};

const firebaseConfig = _isProd ? _prodConfig : _testConfig;

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services (analytics guarded to avoid crash in restricted environments)
let analytics = null;
try { analytics = getAnalytics(app); } catch(e) {}
const db = getFirestore(app);

// Export initialized services
export { app, analytics, db };
