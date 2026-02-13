#!/usr/bin/env node

/**
 * ANALYZE INTACT BUSINESS STRUCTURE
 * Study biz_machine_2 to see what proper employee data should look like
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

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

async function analyzeIntactBusiness() {
  try {
    console.log('🔍 ANALYZING INTACT BUSINESS STRUCTURE...\n');

    const intactBusiness = 'biz_machine_2';
    console.log(`📊 Analyzing ${intactBusiness} as reference...\n`);

    // Check business document
    const businessRef = doc(db, 'businesses', intactBusiness);
    const businessDoc = await getDoc(businessRef);
    const businessData = businessDoc.data();
    
    console.log('🏢 BUSINESS STRUCTURE:');
    console.log(`   Password: ${businessData.password}`);
    console.log(`   Slots Allowed: ${businessData.slotsAllowed}`);
    console.log(`   Working Hours: Mon-Fri ${businessData.schedule?.monday?.startTime || businessData.workStartTime} - ${businessData.schedule?.monday?.endTime || businessData.workEndTime}`);
    console.log(`   Hourly Rate: ${businessData.hourlyRate || 'Not set'}`);
    console.log(`   Currency: ${businessData.currency}`);
    console.log(`   Break Duration: ${businessData.breakDuration} minutes`);

    // Check staff structure
    const staffRef = collection(db, 'businesses', intactBusiness, 'staff');
    const staffSnapshot = await getDocs(staffRef);
    
    console.log('\n👥 EMPLOYEE DATA STRUCTURE:');
    const realEmployees = [];
    staffSnapshot.docs.forEach(staffDoc => {
      const data = staffDoc.data();
      if (data.employeeName && !data.employeeName.startsWith('Employee ')) {
        realEmployees.push({
          slot: staffDoc.id,
          name: data.employeeName,
          badge: data.badgeNumber,
          active: data.active,
          phone: data.phone,
          email: data.email,
          position: data.position,
          hourlyRate: data.hourlyRate,
          status: data.status,
          clockInTime: data.clockInTime
        });
      }
    });
    
    realEmployees.forEach(emp => {
      console.log(`   Slot ${emp.slot}: ${emp.name}`);
      console.log(`     Badge: ${emp.badge}`);
      console.log(`     Active: ${emp.active}`);
      console.log(`     Phone: ${emp.phone || 'Not set'}`);
      console.log(`     Email: ${emp.email || 'Not set'}`);
      console.log(`     Position: ${emp.position || 'Not set'}`);
      console.log(`     Hourly Rate: ${emp.hourlyRate || 'Not set'}`);
      console.log(`     Current Status: ${emp.status || 'Not set'}`);
      console.log(`     Clock In: ${emp.clockInTime || 'Not clocked in'}`);
      console.log('');
    });

    // Check settings structure
    const settingsRef = collection(db, 'businesses', intactBusiness, 'settings');
    const settingsSnapshot = await getDocs(settingsRef);
    
    console.log('⚙️ SETTINGS COLLECTIONS:');
    settingsSnapshot.docs.forEach(settingDoc => {
      console.log(`   ${settingDoc.id}: ${JSON.stringify(settingDoc.data(), null, 2)}`);
    });

    console.log('\n🎯 REFERENCE DATA STRUCTURE COMPLETE');
    console.log('Now we can restore biz_srcomponents to match this structure...');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run analysis
(async () => {
  await analyzeIntactBusiness();
  process.exit(0);
})();