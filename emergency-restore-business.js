#!/usr/bin/env node

/**
 * EMERGENCY BUSINESS SETTINGS RESTORATION
 * Fixes business slot limits and restores correct configuration
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

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

async function restoreBusinessSettings() {
  try {
    console.log('🔧 EMERGENCY RESTORATION: Fixing business settings...\n');

    const businessId = 'biz_srcomponents';
    const businessRef = doc(db, 'businesses', businessId);
    
    // Check current state
    const businessDoc = await getDoc(businessRef);
    if (!businessDoc.exists()) {
      console.log('❌ Business not found!');
      return;
    }

    const currentData = businessDoc.data();
    console.log('📊 Current settings:');
    console.log(`   slotsAllowed: ${currentData.slotsAllowed} (WRONG - should be 20+)`);
    console.log(`   password: ${currentData.password || 'MISSING'}`);
    console.log(`   businessName: ${currentData.businessName}`);

    // Fix the settings
    const fixedSettings = {
      slotsAllowed: 20,  // Restore to proper amount
      password: 'srcomponents',  // Reset password
      apiEnabled: true,
      status: 'active',
      lastSettingsRestore: new Date().toISOString(),
      restoredBy: 'emergency_script',
      // Keep existing data
      businessName: currentData.businessName || 'SR Components',
      adminEmail: currentData.adminEmail || 'info@srcomponents.co.za',
      deviceId: currentData.deviceId || 'FC4349999',
      breakDuration: currentData.breakDuration || 60,
      approved: true,
      businessId: businessId
    };

    console.log('\n🔧 Applying fixes...');
    await updateDoc(businessRef, fixedSettings);
    
    console.log('✅ Business settings restored!');
    console.log('📋 New settings:');
    console.log(`   ✅ slotsAllowed: ${fixedSettings.slotsAllowed}`);
    console.log(`   ✅ password: ${fixedSettings.password}`);
    console.log(`   ✅ status: ${fixedSettings.status}`);
    
    console.log('\n🎯 RESTORATION COMPLETE!');
    console.log('🔄 Please refresh your admin dashboard - all staff should now be visible again.');

  } catch (error) {
    console.error('❌ Restoration failed:', error);
    process.exit(1);
  }
}

// Run restoration
(async () => {
  await restoreBusinessSettings();
  process.exit(0);
})();