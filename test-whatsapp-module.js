#!/usr/bin/env node

/**
 * WHATSAPP MODULE TESTER
 * Test WhatsApp functionality for clock-out triggers
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc } from 'firebase/firestore';

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

async function testWhatsAppModule() {
  try {
    console.log('📱 TESTING WHATSAPP MODULE...\n');

    const businessId = 'biz_srcomponents';
    
    // 1. Setup WhatsApp settings (dummy for testing)
    console.log('⚙️ Setting up WhatsApp test configuration...');
    const whatsappSettingsRef = doc(db, 'businesses', businessId, 'settings', 'whatsapp');
    const testSettings = {
      enabled: true,
      apiProvider: 'test', // Test mode
      accessToken: 'test_token_12345',
      phoneNumberId: 'test_phone_id',
      businessAccountId: 'test_business_id',
      phoneNumber: '+27123456789',
      businessName: 'SR Components Test',
      setupDate: new Date().toISOString(),
      testMode: true
    };
    
    await setDoc(whatsappSettingsRef, testSettings);
    console.log('✅ WhatsApp settings configured for testing');

    // 2. Create a test WhatsApp template for clock-out
    console.log('📝 Creating test clock-out template...');
    const templateRef = doc(db, 'businesses', businessId, 'whatsapp_templates', 'test_clock_out');
    const testTemplate = {
      trigger: 'clock-out',
      recipient: 'employee',
      active: true,
      templateName: 'Test Clock Out',
      message: 'Hi {{employeeName}}, you have clocked out at {{time}}. Today you worked {{hoursWorked}} hours. Have a great day!',
      createdAt: new Date().toISOString(),
      testMode: true
    };
    
    await setDoc(templateRef, testTemplate);
    console.log('✅ Test template created');

    // 3. Simulate a clock-out event
    console.log('🕐 Simulating clock-out event...');
    const eventRef = collection(db, 'businesses', businessId, 'attendance_events');
    const testEvent = {
      employeeId: '10',
      employeeName: 'eric',
      type: 'clock-out',
      time: new Date().toISOString(),
      timestamp: Date.now(),
      deviceId: 'FC4349999',
      attendanceStatus: 'out',
      isTestEvent: true,
      recordedAt: new Date().toISOString()
    };
    
    await addDoc(eventRef, testEvent);
    console.log('✅ Test clock-out event created');

    // 4. Test the WhatsApp Cloud Function directly
    console.log('📨 Testing WhatsApp Cloud Function...');
    
    const response = await fetch('https://sendwhatsappmessage-4q7htrps4q-uc.a.run.app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId: businessId,
        trigger: 'clock-out',
        employeeData: {
          employeeId: '10',
          employeeName: 'eric',
          hoursWorked: '8.5',
          time: new Date().toLocaleTimeString()
        }
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ WhatsApp function executed successfully!');
      console.log(`📊 Messages sent: ${result.messagesSent}`);
      if (result.messages && result.messages.length > 0) {
        result.messages.forEach(msg => {
          console.log(`   📱 To: ${msg.to}`);
          console.log(`   📝 Message: ${msg.message}`);
          console.log(`   ✅ Status: ${msg.status}`);
        });
      }
    } else {
      console.log('❌ WhatsApp function failed:', result.error);
    }

    // 5. Create a manual trigger for testing
    console.log('\n🎯 MANUAL TEST TRIGGER:');
    console.log('Run this command to test WhatsApp manually:');
    console.log(`curl -X POST "https://sendwhatsappmessage-4q7htrps4q-uc.a.run.app" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{`);
    console.log(`    "businessId": "${businessId}",`);
    console.log(`    "trigger": "clock-out",`);
    console.log(`    "employeeData": {`);
    console.log(`      "employeeId": "10",`);
    console.log(`      "employeeName": "eric",`);
    console.log(`      "hoursWorked": "8.5"`);
    console.log(`    }`);
    console.log(`  }'`);

    console.log('\n🎮 WhatsApp Module Testing Complete!');

  } catch (error) {
    console.error('❌ WhatsApp module test failed:', error);
    process.exit(1);
  }
}

// Run test
(async () => {
  await testWhatsAppModule();
  process.exit(0);
})();