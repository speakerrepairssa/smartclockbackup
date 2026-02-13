#!/usr/bin/env node

/**
 * SPEAKER REPAIRS WHATSAPP SETUP & TEST
 * Enable WhatsApp for biz_speaker_repairs and test clock-out messaging
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc, getDocs } from 'firebase/firestore';

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

async function setupSpeakerRepairsWhatsApp() {
  try {
    console.log('🔧 SETTING UP WHATSAPP FOR SPEAKER REPAIRS BUSINESS...\n');

    const businessId = 'biz_speaker_repairs';
    
    // 1. Check existing staff in speaker repairs business
    console.log('👥 Checking existing staff...');
    const staffRef = collection(db, 'businesses', businessId, 'staff');
    const staffSnap = await getDocs(staffRef);
    
    const existingStaff = [];
    staffSnap.forEach(doc => {
      const data = doc.data();
      if (data.active !== false && data.employeeName && data.employeeName !== `Employee ${doc.id}`) {
        existingStaff.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    if (existingStaff.length > 0) {
      console.log(`✅ Found ${existingStaff.length} active staff members:`);
      existingStaff.forEach(emp => {
        console.log(`   - ${emp.employeeName} (ID: ${emp.id})`);
      });
    } else {
      console.log('⚠️  No active staff found. Creating test employee...');
      // Create a test employee for speaker repairs
      const testEmployeeRef = doc(db, 'businesses', businessId, 'staff', '1');
      await setDoc(testEmployeeRef, {
        employeeId: '1',
        employeeName: 'Test Speaker Tech',
        active: true,
        slotNumber: 1,
        badgeNumber: '1',
        position: 'Technician',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deviceId: ""
      });
      
      existingStaff.push({
        id: '1',
        employeeId: '1',
        employeeName: 'Test Speaker Tech'
      });
      
      console.log('✅ Created test employee: Test Speaker Tech');
    }

    // 2. Setup WhatsApp configuration
    console.log('\n📱 Setting up WhatsApp configuration...');
    const whatsappSettingsRef = doc(db, 'businesses', businessId, 'settings', 'whatsapp');
    const testSettings = {
      enabled: true,
      apiProvider: 'test', // Test mode for now
      accessToken: 'test_token_speaker_repairs',
      phoneNumberId: 'test_phone_speaker',
      businessAccountId: 'test_business_speaker',
      phoneNumber: '+27819876543',
      businessName: 'Speaker Repairs SA',
      setupDate: new Date().toISOString(),
      testMode: true
    };
    
    await setDoc(whatsappSettingsRef, testSettings);
    console.log('✅ WhatsApp settings configured');

    // 3. Create WhatsApp template for clock-out
    console.log('📝 Creating clock-out template...');
    const templateRef = doc(db, 'businesses', businessId, 'whatsapp_templates', 'speaker_clock_out');
    const clockOutTemplate = {
      trigger: 'clock-out',
      recipient: 'employee',
      active: true,
      templateName: 'Speaker Repairs Clock Out',
      message: 'Hi {{employeeName}}! 🔧 You have clocked out at {{time}}. Today you worked {{hoursWorked}} hours at Speaker Repairs SA. Great job fixing those speakers! 🔊',
      createdAt: new Date().toISOString(),
      testMode: true
    };
    
    await setDoc(templateRef, clockOutTemplate);
    console.log('✅ Clock-out template created');

    // 4. Create a manager notification template
    console.log('📝 Creating manager notification template...');
    const managerTemplateRef = doc(db, 'businesses', businessId, 'whatsapp_templates', 'manager_notification');
    const managerTemplate = {
      trigger: 'clock-out',
      recipient: 'manager',
      active: true,
      templateName: 'Manager Clock Out Alert',
      message: '👋 {{employeeName}} has clocked out at {{time}} after working {{hoursWorked}} hours today at Speaker Repairs SA.',
      managerPhone: '+27123456789', // Replace with actual manager number
      createdAt: new Date().toISOString(),
      testMode: true
    };
    
    await setDoc(managerTemplateRef, managerTemplate);
    console.log('✅ Manager notification template created');

    // 5. Test the setup
    console.log('\n🧪 TESTING WHATSAPP FUNCTIONALITY...');
    const testEmployee = existingStaff[0];
    
    // Test WhatsApp Cloud Function
    const response = await fetch('https://sendwhatsappmessage-4q7htrps4q-uc.a.run.app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId: businessId,
        trigger: 'clock-out',
        employeeData: {
          employeeId: testEmployee.id,
          employeeName: testEmployee.employeeName,
          hoursWorked: '8.0',
          time: new Date().toLocaleTimeString()
        }
      })
    });

    const result = await response.json();
    
    console.log('\n📱 WHATSAPP TEST RESULT:');
    if (result.success) {
      console.log('✅ WhatsApp function executed successfully!');
      console.log(`📊 Messages processed: ${result.messagesSent || 0}`);
      if (result.messages && result.messages.length > 0) {
        result.messages.forEach(msg => {
          console.log(`   📱 To: ${msg.to}`);
          console.log(`   📝 Message: ${msg.message}`);
          console.log(`   ✅ Status: ${msg.status}`);
        });
      } else {
        console.log('ℹ️  WhatsApp is in test mode - no actual messages sent');
      }
    } else {
      console.log('❌ WhatsApp function failed:', result.error);
    }

    // 6. Provide command-line test instructions
    console.log('\n🎮 SPEAKER REPAIRS CLOCK-OUT TESTING:');
    console.log('=====================================');
    console.log('\n📋 Available employees:');
    existingStaff.forEach(emp => {
      console.log(`   - ${emp.employeeName} (ID: ${emp.id})`);
    });
    
    console.log('\n🕐 To test clock-out with WhatsApp messaging, run:');
    console.log(`node speaker-repairs-clock-out.js ${testEmployee.employeeName.toLowerCase().replace(/\s+/g, '_')}`);
    
    console.log('\n📱 Manual WhatsApp test command:');
    console.log(`curl -X POST "https://sendwhatsappmessage-4q7htrps4q-uc.a.run.app" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{`);
    console.log(`    "businessId": "${businessId}",`);
    console.log(`    "trigger": "clock-out",`);
    console.log(`    "employeeData": {`);
    console.log(`      "employeeId": "${testEmployee.id}",`);
    console.log(`      "employeeName": "${testEmployee.employeeName}",`);
    console.log(`      "hoursWorked": "8.0"`);
    console.log(`    }`);
    console.log(`  }'`);

    console.log('\n🚀 Speaker Repairs WhatsApp setup complete!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup
(async () => {
  await setupSpeakerRepairsWhatsApp();
  process.exit(0);
})();