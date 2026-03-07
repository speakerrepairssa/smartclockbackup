// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Single Firebase project — all data lives here
const firebaseConfig = {
  apiKey: "AIzaSyC6capPBwQDzIyp73i4ML0m9UwqjcfJ_WE",
  authDomain: "smartclock-v2-8271f.firebaseapp.com",
  projectId: "smartclock-v2-8271f",
  storageBucket: "smartclock-v2-8271f.firebasestorage.app",
  messagingSenderId: "994384787802",
  appId: "1:994384787802:web:e08a4db7ae7693c4199b63",
  measurementId: "G-TEXJFZERJ6",
  databaseURL: "https://smartclock-v2-8271f-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services (analytics guarded in case of restricted environments)
let analytics = null;
try {
  if (firebaseConfig.measurementId) analytics = getAnalytics(app);
} catch (e) { /* analytics not critical */ }
const db = getFirestore(app);

// Export initialized services
export { app, analytics, db };
