// Firebase configuration for AIClock Staff App
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBssR7qaFYd1Bcm7urHQrKfLPVvdoZJ1kw",
  authDomain: "aiclock-82608.firebaseapp.com",
  databaseURL: "https://aiclock-82608-default-rtdb.firebaseio.com",
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.appspot.com",
  messagingSenderId: "847148296718",
  appId: "1:847148296718:web:a8bf69cb527ee7c7e1ea5f",
  measurementId: "G-L6LMK5WY01"

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
