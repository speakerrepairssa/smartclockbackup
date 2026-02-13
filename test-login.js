#!/usr/bin/env node

/**
 * LOGIN TEST
 * Test if business login is working after revert
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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

async function testLogin() {
  try {
    console.log('🔐 Testing business login...\n');

    const businessId = 'biz_srcomponents';
    const testPassword = 'srcomponents';
    
    const businessRef = doc(db, 'businesses', businessId);
    const businessDoc = await getDoc(businessRef);
    
    if (!businessDoc.exists()) {
      console.log('❌ Business not found!');
      return;
    }
    
    const businessData = businessDoc.data();
    
    console.log('📊 Business Data:');
    console.log(`   ID: ${businessId}`);
    console.log(`   Name: ${businessData.businessName}`);
    console.log(`   Password: ${businessData.password || 'NOT SET'}`);
    console.log(`   Slots Allowed: ${businessData.slotsAllowed}`);
    console.log(`   Status: ${businessData.status}`);
    console.log(`   Admin Email: ${businessData.adminEmail}`);
    
    // Test password match
    if (businessData.password === testPassword) {
      console.log('\n✅ LOGIN TEST PASSED!');
      console.log(`✅ Password '${testPassword}' matches!`);
      console.log('✅ You should be able to log in now!');
    } else {
      console.log('\n❌ LOGIN TEST FAILED!');
      console.log(`❌ Expected password: '${testPassword}'`);
      console.log(`❌ Actual password: '${businessData.password || 'NOT SET'}'`);
      
      // Try to fix password
      console.log('\n🔧 Need to fix password...');
    }
    
    console.log('\n🌐 Login URL: https://aiclock-82608.web.app/pages/business-login.html');
    
  } catch (error) {
    console.error('❌ Login test failed:', error);
  }
}

// Run test
(async () => {
  await testLogin();
  process.exit(0);
})();