// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Auto-detect project from hostname
const isLive = typeof location !== 'undefined' &&
  (location.hostname.includes('aiclock') || location.hostname.includes('aiclock-82608'));

const firebaseConfig = isLive ? {
  apiKey: "AIzaSyAmKmv9cmWEhTGpuxWxVu3vOKvpJLVUXx0",
  authDomain: "aiclock-82608.firebaseapp.com",
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.firebasestorage.app",
  messagingSenderId: "434208200088",
  appId: "1:434208200088:web:1ef0ac8a89a3e2cdd94a50"
} : {
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

// Initialize services
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Export initialized services
export { app, analytics, db };
