// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBssR7qaFYd1Bcm7urHQrKfLPVvdoZJ1kw",
  authDomain: "aiclock-82608.firebaseapp.com",
  databaseURL: "https://aiclock-82608-default-rtdb.firebaseio.com",
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.appspot.com",
  messagingSenderId: "847148296718",
  appId: "1:847148296718:web:a8bf69cb527ee7c7e1ea5f",
  measurementId: "G-L6LMK5WY01"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Export initialized services
export { app, analytics, db };
