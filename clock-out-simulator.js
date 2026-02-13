#!/usr/bin/env node

/**
 * CLOCK-OUT SIMULATOR WITH WHATSAPP TRIGGER
 * Run this to simulate clocking out and test WhatsApp messaging
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

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

// Available test employees
const EMPLOYEES = [
  { id: '1', name: 'nabu' },
  { id: '10', name: 'eric' },
  { id: '13', name: 'umar' },
  { id: '27', name: 'selwyn' }
];

async function simulateClockOut() {
  const args = process.argv.slice(2);
  
  // Select employee (default to eric if none specified)
  let employee = EMPLOYEES.find(emp => emp.name === args[0]) || EMPLOYEES[1];
  
  console.log(`🕐 SIMULATING CLOCK-OUT FOR: ${employee.name.toUpperCase()}`);
  console.log(`📱 Employee ID: ${employee.id}\n`);

  try {
    const businessId = 'biz_srcomponents';
    const now = new Date();
    
    // 1. Create attendance event
    console.log('📝 Creating clock-out event...');
    const eventRef = collection(db, 'businesses', businessId, 'attendance_events');
    const clockOutEvent = {
      employeeId: employee.id,
      employeeName: employee.name,
      type: 'clock-out',
      time: now.toISOString(),
      timestamp: Date.now(),
      deviceId: 'FC4349999',
      attendanceStatus: 'out',
      simulatedEvent: true,
      recordedAt: now.toISOString()
    };
    
    await addDoc(eventRef, clockOutEvent);
    console.log('✅ Clock-out event recorded');

    // 2. Calculate work hours (simulate 8-9 hours)
    const hoursWorked = (Math.random() * 2 + 7).toFixed(1); // 7.0 - 9.0 hours
    
    // 3. Trigger WhatsApp notification
    console.log('📨 Triggering WhatsApp notification...');
    
    const response = await fetch('https://sendwhatsappmessage-4q7htrps4q-uc.a.run.app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId: businessId,
        trigger: 'clock-out',
        employeeData: {
          employeeId: employee.id,
          employeeName: employee.name,
          hoursWorked: hoursWorked,
          time: now.toLocaleTimeString()
        }
      })
    });

    const result = await response.json();
    
    console.log('\n📱 WHATSAPP RESULT:');
    if (result.success) {
      console.log(`✅ WhatsApp function executed successfully!`);
      console.log(`📊 Messages processed: ${result.messagesSent || 0}`);
      if (result.messages && result.messages.length > 0) {
        result.messages.forEach(msg => {
          console.log(`   📱 To: ${msg.to}`);
          console.log(`   📝 Message: ${msg.message}`);
          console.log(`   ✅ Status: ${msg.status}`);
        });
      } else {
        console.log('ℹ️  No WhatsApp messages sent (may be in test mode or no recipients configured)');
      }
    } else {
      console.log('❌ WhatsApp function failed:', result.error);
    }

    console.log('\n🎯 SUMMARY:');
    console.log(`👤 Employee: ${employee.name}`);
    console.log(`🕐 Clock-out time: ${now.toLocaleTimeString()}`);
    console.log(`⏱️  Hours worked: ${hoursWorked}`);
    console.log(`📱 WhatsApp: ${result.success ? 'Triggered' : 'Failed'}`);

  } catch (error) {
    console.error('❌ Clock-out simulation failed:', error);
    process.exit(1);
  }
}

// Show usage if no args or help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('🕐 CLOCK-OUT SIMULATOR');
  console.log('Usage: node clock-out-simulator.js [employee_name]');
  console.log('\nAvailable employees:');
  EMPLOYEES.forEach(emp => {
    console.log(`  - ${emp.name} (ID: ${emp.id})`);
  });
  console.log('\nExample: node clock-out-simulator.js eric');
  console.log('         node clock-out-simulator.js nabu');
  process.exit(0);
}

// Run simulation
(async () => {
  await simulateClockOut();
  process.exit(0);
})();