// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─────────────────────────────────────────────────────────────────────────────
// TEST / STAGING environment — smartclock-v2-8271f
//
// This file belongs to the SMARTCLOCK V2 codebase (test/dev).
// Changes are made and verified here BEFORE being copied to the aiclock repo.
//
// DO NOT change this to the aiclock-82608 config.
// The aiclock project has its own separate copy of this file pointing to
// aiclock-82608.  See ## GitHub Copilot Chat.md for full architecture notes.
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC6capPBwQDzIyp73i4ML0m9UwqjcfJ_WE",
  authDomain: "smartclock-v2-8271f.firebaseapp.com",
  projectId: "smartclock-v2-8271f",
  storageBucket: "smartclock-v2-8271f.firebasestorage.app",
  messagingSenderId: "994384787802",
  appId: "1:994384787802:web:e08a4db7ae7693c4199b63",
  measurementId: "G-TEXJFZERJ6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services (analytics guarded to avoid crash in restricted environments)
let analytics = null;
try { analytics = getAnalytics(app); } catch(e) {}
const db = getFirestore(app);

// Export initialized services
export { app, analytics, db };
