#!/usr/bin/env node

/**
 * STAFF COLLECTION DETAILED INSPECTION
 * Check actual employee data and current status
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

async function inspectStaffData() {
  try {
    console.log('🔍 DETAILED STAFF INSPECTION...\n');

    const businessId = 'biz_srcomponents';
    const staffRef = collection(db, 'businesses', businessId, 'staff');
    const staffSnapshot = await getDocs(staffRef);
    
    console.log(`📊 Total staff documents: ${staffSnapshot.size}\n`);
    
    const activeEmployees = [];
    const clockedInEmployees = [];
    const emptySlots = [];
    
    staffSnapshot.docs.forEach(staffDoc => {
      const slotId = staffDoc.id;
      const data = staffDoc.data();
      
      console.log(`👤 SLOT ${slotId}:`);
      console.log(`   Name: ${data.employeeName || data.name || 'EMPTY'}`);
      console.log(`   Badge: ${data.badgeNumber || 'Not set'}`);
      console.log(`   Active: ${data.active}`);
      console.log(`   Status: ${data.status || 'Not set'}`);
      console.log(`   Phone: ${data.phone || 'Not set'}`);
      console.log(`   Clock In Time: ${data.clockInTime || 'Not set'}`);
      console.log(`   Last Clock: ${data.lastClockStatus || 'Not set'}`);
      console.log(`   Position: ${data.position || 'Not set'}`);
      console.log('');
      
      if (data.employeeName && data.employeeName !== `Employee ${slotId}`) {
        activeEmployees.push(`${slotId}: ${data.employeeName}`);
        if (data.active === true || data.status === 'IN') {
          clockedInEmployees.push(`${slotId}: ${data.employeeName}`);
        }
      } else {
        emptySlots.push(slotId);
      }
    });
    
    console.log('📋 SUMMARY:');
    console.log(`✅ Active employees: ${activeEmployees.length}`);
    activeEmployees.forEach(emp => console.log(`   - ${emp}`));
    
    console.log(`🟢 Currently clocked in: ${clockedInEmployees.length}`);
    clockedInEmployees.forEach(emp => console.log(`   - ${emp}`));
    
    console.log(`⚪ Empty slots: ${emptySlots.length}`);
    console.log(`   Slots: ${emptySlots.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Staff inspection failed:', error);
    process.exit(1);
  }
}

// Run inspection
(async () => {
  await inspectStaffData();
  process.exit(0);
})();