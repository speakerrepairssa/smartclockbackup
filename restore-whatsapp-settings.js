#!/usr/bin/env node

/**
 * RESTORE WHATSAPP API SETTINGS
 * Copy working API settings from biz_machine_2 to current business
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBzkE6e8QAAh_v8DhcPZVTiSRZgKKUdbNQ",
  authDomain: "aiclock-82608.firebaseapp.com",
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.appspot.com",
  messagingSenderId: "847148296718",
  appId: "1:847148296718:web:7afe6f8c3c8b77e3a8b456"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function restoreWhatsAppSettings() {
  try {
    console.log('🔧 RESTORING WHATSAPP API SETTINGS...\n');

    // Get the working settings from biz_machine_2
    const sourceSettingsRef = doc(db, 'businesses', 'biz_machine_2', 'settings', 'whatsapp');
    const sourceDoc = await getDoc(sourceSettingsRef);
    
    if (!sourceDoc.exists()) {
      console.log('❌ No source settings found');
      return;
    }
    
    const workingSettings = sourceDoc.data();
    console.log('✅ Found working WhatsApp settings:');
    console.log(`   Phone Number: ${workingSettings.phoneNumber}`);
    console.log(`   Business Account ID: ${workingSettings.businessAccountId}`);
    console.log(`   Phone Number ID: ${workingSettings.phoneNumberId}`);
    console.log(`   Templates: ${workingSettings.templateNames?.length || 0} available`);
    
    // Apply to Speaker Repairs business (assuming that's what you're looking at)
    const targetBusinessId = 'biz_speaker_repairs';
    
    console.log(`\n📱 Applying settings to ${targetBusinessId}...`);
    
    const targetSettingsRef = doc(db, 'businesses', targetBusinessId, 'settings', 'whatsapp');
    const restoredSettings = {
      enabled: true,
      apiProvider: 'whatsapp-business',
      accessToken: workingSettings.accessToken,
      phoneNumber: workingSettings.phoneNumber,
      phoneNumberId: workingSettings.phoneNumberId,
      businessAccountId: workingSettings.businessAccountId,
      businessName: 'Speaker Repairs SA',
      setupDate: new Date().toISOString(),
      testMode: false, // Production mode
      templateNames: workingSettings.templateNames || [],
      templateCount: workingSettings.templateNames?.length || 0
    };
    
    await setDoc(targetSettingsRef, restoredSettings);
    
    console.log('✅ WhatsApp settings restored!');
    console.log('\n📋 Restored settings:');
    console.log(`   ✅ Access Token: ${workingSettings.accessToken ? 'SET' : 'MISSING'}`);
    console.log(`   ✅ Phone Number: ${workingSettings.phoneNumber}`);
    console.log(`   ✅ Phone Number ID: ${workingSettings.phoneNumberId}`);
    console.log(`   ✅ Business Account ID: ${workingSettings.businessAccountId}`);
    console.log(`   ✅ Templates: ${workingSettings.templateNames?.length || 0} available`);
    
    console.log('\n🚀 READY TO USE!');
    console.log('Refresh the WhatsApp settings page to see the restored settings.');
    
  } catch (error) {
    console.error('❌ Restore failed:', error);
  }
}

restoreWhatsAppSettings();