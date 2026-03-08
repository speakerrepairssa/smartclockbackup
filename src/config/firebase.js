// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ENV } from './env.js';

// ─────────────────────────────────────────────────────────────────────────────
// DUAL-PROJECT DETECTION — two independent signals, either one triggers PROD
//
// Signal 1: env.js marker (set by deploy-to-aiclock.sh before each aiclock deploy)
//           → covers ALL domains including custom ones (aiclock.co.za etc.)
//
// Signal 2: hostname check (covers direct web.app URL access without deploy script)
//           → aiclock-82608.web.app / aiclock-82608.firebaseapp.com
//
// Safe default: if neither matches → TEST project (smartclock-v2-8271f)
// ─────────────────────────────────────────────────────────────────────────────

const _host = (typeof window !== 'undefined' ? window.location.hostname : '');
const _isProd = ENV === 'production' || _host.includes('aiclock-82608');

const _testConfig = {
  apiKey: "AIzaSyC6capPBwQDzIyp73i4ML0m9UwqjcfJ_WE",
  authDomain: "smartclock-v2-8271f.firebaseapp.com",
  projectId: "smartclock-v2-8271f",
  storageBucket: "smartclock-v2-8271f.firebasestorage.app",
  messagingSenderId: "994384787802",
  appId: "1:994384787802:web:e08a4db7ae7693c4199b63",
  measurementId: "G-TEXJFZERJ6",
  databaseURL: "https://smartclock-v2-8271f-default-rtdb.firebaseio.com"
};

const _prodConfig = {
  apiKey: "AIzaSyAmKmv9cmWEhTGpuxWxVu3vOKvpJLVUXx0",
  authDomain: "aiclock-82608.firebaseapp.com",
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.firebasestorage.app",
  messagingSenderId: "434208200088",
  appId: "1:434208200088:web:1ef0ac8a89a3e2cdd94a50",
  databaseURL: "https://aiclock-82608-default-rtdb.firebaseio.com"
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
