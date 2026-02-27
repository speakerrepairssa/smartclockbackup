#!/usr/bin/env node

/**
 * Check Device Registration Status - Client SDK Version
 * Verify if FC4349999 device is properly registered to biz_srcomponents
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

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

async function checkDeviceRegistration() {
  console.log('🔍 Checking Device Registration Status');
  console.log('=====================================\n');

  try {
    // Check business configuration
    console.log('📋 Step 1: Check business configuration...');
    const businessRef = doc(db, 'businesses', 'biz_srcomponents');
    const businessSnap = await getDoc(businessRef);
    
    if (!businessSnap.exists()) {
      console.log('❌ Business "biz_srcomponents" not found!');
      return;
    }

    const businessData = businessSnap.data();
    console.log('✅ Business found:', businessData.businessName);
    console.log('📱 Device ID:', businessData.deviceId);
    console.log('🔗 Linked Devices:', businessData.linkedDevices);

    // Check devices collection
    console.log('\n📋 Step 2: Check devices subcollection...');
    const devicesRef = collection(db, 'businesses', 'biz_srcomponents', 'devices');
    const devicesSnapshot = await getDocs(devicesRef);
    
    console.log('📱 Registered devices count:', devicesSnapshot.size);
    
    if (devicesSnapshot.empty) {
      console.log('⚠️  No devices registered in subcollection!');
    } else {
      console.log('📱 Registered devices:');
      devicesSnapshot.forEach(deviceDoc => {
        console.log(`   - ${deviceDoc.id}:`, JSON.stringify(deviceDoc.data(), null, 2));
      });
    }

    // Check for FC4349999 specifically
    console.log('\n📋 Step 3: Check FC4349999 device specifically...');
    const deviceRef = doc(db, 'businesses', 'biz_srcomponents', 'devices', 'FC4349999');
    const deviceSnap = await getDoc(deviceRef);
    
    if (deviceSnap.exists()) {
      console.log('✅ FC4349999 device found:');
      console.log(JSON.stringify(deviceSnap.data(), null, 2));
    } else {
      console.log('❌ FC4349999 device NOT found in devices collection!');
      
      // Try lowercase version
      console.log('\n🔍 Checking lowercase variant...');
      const lowercaseDeviceRef = doc(db, 'businesses', 'biz_srcomponents', 'devices', 'fc4349999');
      const lowercaseDeviceSnap = await getDoc(lowercaseDeviceRef);
      if (lowercaseDeviceSnap.exists()) {
        console.log('⚠️  Found lowercase "fc4349999":');
        console.log(JSON.stringify(lowercaseDeviceSnap.data(), null, 2));
      } else {
        console.log('❌ "fc4349999" also not found');
      }
    }

    // Check webhook configuration expectations
    console.log('\n📋 Step 4: Webhook Configuration Analysis');
    console.log('- Device webhook URL: /fc4349999-webhook (lowercase)');
    console.log('- Expected device ID: FC4349999 (uppercase)'); 
    console.log('- Business linkedDevices:', businessData.linkedDevices);
    
    const hasUppercase = businessData.linkedDevices && businessData.linkedDevices.includes('FC4349999');
    const hasLowercase = businessData.linkedDevices && businessData.linkedDevices.includes('fc4349999');
    
    console.log('✅ Has uppercase FC4349999:', hasUppercase);
    console.log('❌ Has lowercase fc4349999:', hasLowercase);

    // Recommendations
    console.log('\n🎯 RECOMMENDATIONS:');
    if (!hasUppercase && !hasLowercase) {
      console.log('❌ CRITICAL: Device not in linkedDevices array!');
      console.log('   Action: Update business.linkedDevices to include device ID');
    }
    
    if (!deviceSnap.exists()) {
      console.log('❌ CRITICAL: Device not registered in devices collection!'); 
      console.log('   Action: Register FC4349999 in devices subcollection');
    }

    console.log('🔧 Case Sensitivity Solution:');
    console.log('   - Current webhook uses: fc4349999 (lowercase)');
    console.log('   - Business expects: FC4349999 (uppercase)');
    console.log('   - Fix Option 1: Update VPS relay to convert fc4349999 → FC4349999');
    console.log('   - Fix Option 2: Update Firebase function to be case-insensitive');
    console.log('   - Fix Option 3: Update device webhook URL to use FC4349999');

  } catch (error) {
    console.error('❌ Error checking device registration:', error);
  }
}

checkDeviceRegistration().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});