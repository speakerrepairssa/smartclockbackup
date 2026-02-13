#!/usr/bin/env node

/**
 * FIX PASSWORD AND CREATE DEVICE EMPLOYEE SYNC
 * 1. Fix any password issues
 * 2. Create script to pull employee data directly from device
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBzkE6e8QAAh_v8DhcPZVTiSRZgKKUdbNQ",
  authDomain: "aiclock-82608.firebaseapp.com",
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.appspot.com",
  messagingSenderId: "847148296718",
  appId: "1:847148296718:web:7afe6f8c3c8b77e3a8b456",
  measurementId: "G-HF5YNKQCR8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixPasswordIssue() {
  try {
    console.log('🔧 FIXING PASSWORD ISSUE...\n');

    const businessId = 'biz_srcomponents';
    const businessRef = doc(db, 'businesses', businessId);
    
    // Force update password and ensure it's correct
    const passwordFix = {
      password: 'srcomponents',
      adminEmail: 'info@srcomponents.co.za', 
      email: 'info@srcomponents.co.za',
      businessName: 'SR Components',
      slotsAllowed: 20,
      status: 'active',
      approved: true,
      lastPasswordFix: new Date().toISOString()
    };

    await updateDoc(businessRef, passwordFix);
    console.log('✅ Password fixed to: srcomponents');
    console.log('✅ Email confirmed: info@srcomponents.co.za');
    
  } catch (error) {
    console.error('❌ Password fix failed:', error);
    process.exit(1);
  }
}

// Run password fix
(async () => {
  await fixPasswordIssue();
  process.exit(0);
})();