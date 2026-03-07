// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Production database — all data lives in aiclock-82608
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

// Initialize services (analytics guarded to avoid crash when measurementId missing)
let analytics = null;
try { analytics = getAnalytics(app); } catch(e) {}
const db = getFirestore(app);

// Export initialized services
export { app, analytics, db };
