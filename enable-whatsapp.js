#!/usr/bin/env node

/**
 * SIMPLE WHATSAPP ENABLER 
 * Enable WhatsApp for Speaker Repairs business using existing system
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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

async function enableWhatsApp() {
  try {
    const businessId = 'biz_speaker_repairs';
    
    console.log('📱 Enabling WhatsApp for Speaker Repairs...\n');

    // 1. Enable WhatsApp in settings
    const settingsRef = doc(db, 'businesses', businessId, 'settings', 'whatsapp');
    await setDoc(settingsRef, {
      enabled: true,
      apiProvider: 'test',
      accessToken: 'test_token',
      phoneNumber: '+27123456789',
      businessName: 'Speaker Repairs SA',
      setupDate: new Date().toISOString(),
      testMode: true
    });
    
    console.log('✅ WhatsApp settings enabled');

    // 2. Create active clock-out template
    const templateRef = doc(db, 'businesses', businessId, 'whatsapp_templates', 'clock_out');
    await setDoc(templateRef, {
      trigger: 'clock-out',
      recipient: 'employee',
      active: true,
      templateName: 'Clock Out Notification',
      message: 'Hi {{employeeName}}! You clocked out at {{time}}. Hours worked: {{hoursWorked}}. Thanks for your hard work at Speaker Repairs! 🔧',
      createdAt: new Date().toISOString()
    });
    
    console.log('✅ Active clock-out template created');

    console.log('\n🚀 WhatsApp enabled! Now test with:');
    console.log('curl -X POST "https://sendwhatsappmessage-4q7htrps4q-uc.a.run.app" \\');
    console.log('  -H "Content-Type: application/json" \\'); 
    console.log('  -d \'{"businessId": "biz_speaker_repairs", "trigger": "clock-out", "employeeData": {"employeeName": "Test User", "hoursWorked": "8"}}\'');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

enableWhatsApp();