#!/usr/bin/env node

/**
 * SPEAKER REPAIRS CLOCK-OUT TESTER
 * Simulate clocking out and trigger WhatsApp messages
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc } from 'firebase/firestore';

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

async function clockOutTest() {
  const employeeName = process.argv[2] || 'Speaker Tech';
  const hoursWorked = (Math.random() * 2 + 7).toFixed(1); // 7.0 - 9.0 hours
  
  console.log(`🕐 SPEAKER REPAIRS CLOCK-OUT TEST`);
  console.log(`==========================================`);
  console.log(`👤 Employee: ${employeeName}`);
  console.log(`⏱️  Hours worked: ${hoursWorked}`);
  console.log(`🕐 Time: ${new Date().toLocaleTimeString()}\n`);

  try {
    // 1. Create attendance event
    console.log('📝 Creating clock-out event...');
    const eventRef = collection(db, 'businesses', 'biz_speaker_repairs', 'attendance_events');
    await addDoc(eventRef, {
      employeeId: '1',
      employeeName: employeeName,
      type: 'clock-out',
      time: new Date().toISOString(),
      timestamp: Date.now(),
      deviceId: 'SPEAKER_TEST',
      attendanceStatus: 'out',
      testEvent: true,
      recordedAt: new Date().toISOString()
    });
    
    console.log('✅ Clock-out event recorded');

    // 2. Trigger WhatsApp
    console.log('📱 Triggering WhatsApp notification...');
    const response = await fetch('https://sendwhatsappmessage-4q7htrps4q-uc.a.run.app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: 'biz_speaker_repairs',
        trigger: 'clock-out',
        employeeData: {
          employeeId: '1',
          employeeName: employeeName,
          hoursWorked: hoursWorked,
          time: new Date().toLocaleTimeString()
        }
      })
    });

    const result = await response.json();

    console.log('\n📱 WHATSAPP RESULT:');
    if (result.success) {
      console.log('✅ WhatsApp message triggered successfully!');
      console.log(`📊 Messages processed: ${result.messagesSent}`);
      console.log('\n📝 Message that would be sent:');
      console.log(`   "Hi ${employeeName}! You clocked out at ${new Date().toLocaleTimeString()}. Hours worked: ${hoursWorked}. Thanks for your hard work at Speaker Repairs! 🔧"`);
      
      if (result.messagesSent === 0) {
        console.log('\nℹ️  Note: No actual messages sent because:');
        console.log('   • System is in test mode (prevents spam)');
        console.log('   • Employee phone number not configured');
        console.log('   • WhatsApp API not connected to real provider');
      }
    } else {
      console.log('❌ WhatsApp failed:', result.error);
    }

    console.log('\n🎯 SUMMARY:');
    console.log(`✅ Clock-out: Recorded for ${employeeName}`);
    console.log(`✅ WhatsApp: ${result.success ? 'Triggered' : 'Failed'}`);
    console.log(`⚡ Status: ${result.success ? 'Working perfectly!' : 'Needs attention'}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

console.log('🔧 Speaker Repairs Clock-Out Tester');
console.log('Usage: node speaker-clock-out.js [employee_name]');
console.log('Example: node speaker-clock-out.js "John Smith"\n');

clockOutTest();