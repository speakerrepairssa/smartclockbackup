#!/usr/bin/env node

/**
 * EMERGENCY STAFF DATA DIAGNOSTIC
 * Checks if staff data is really missing or if there's a different issue
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkBusinessesAndStaff() {
  try {
    console.log('🔍 EMERGENCY DIAGNOSTIC: Checking Firebase Database...\n');

    // 1. Check all businesses
    console.log('📋 Checking businesses collection...');
    const businessesRef = collection(db, 'businesses');
    const businessSnapshot = await getDocs(businessesRef);
    
    if (businessSnapshot.empty) {
      console.log('❌ CRITICAL: No businesses found in database!');
      return;
    }

    console.log(`✅ Found ${businessSnapshot.size} businesses\n`);

    // 2. Check each business's staff
    for (const businessDoc of businessSnapshot.docs) {
      const businessId = businessDoc.id;
      const businessData = businessDoc.data();
      
      console.log(`🏢 Business: ${businessId}`);
      console.log(`   Name: ${businessData.businessName || 'Unnamed'}`);
      console.log(`   Admin: ${businessData.adminEmail || 'No admin email'}`);
      
      // Check staff collection
      const staffRef = collection(db, 'businesses', businessId, 'staff');
      const staffSnapshot = await getDocs(staffRef);
      
      if (staffSnapshot.empty) {
        console.log('   ❌ NO STAFF FOUND');
      } else {
        console.log(`   ✅ Staff count: ${staffSnapshot.size}`);
        
        // Show first few staff members
        const staffList = [];
        staffSnapshot.docs.slice(0, 5).forEach(staffDoc => {
          const staffData = staffDoc.data();
          staffList.push(`${staffDoc.id}: ${staffData.employeeName || staffData.name || 'Unnamed'}`);
        });
        console.log(`   👥 Staff: ${staffList.join(', ')}${staffSnapshot.size > 5 ? '...' : ''}`);
      }

      // Check if there are any attendance events
      const eventsRef = collection(db, 'businesses', businessId, 'attendance_events');
      const eventsSnapshot = await getDocs(eventsRef);
      console.log(`   📅 Attendance events: ${eventsSnapshot.size} records`);
      
      console.log('');
    }

  } catch (error) {
    console.error('❌ Database check failed:', error);
    process.exit(1);
  }
}

async function checkSpecificBusiness(businessId) {
  try {
    console.log(`🔍 Detailed check for business: ${businessId}\n`);
    
    const businessRef = doc(db, 'businesses', businessId);
    const businessDoc = await getDoc(businessRef);
    
    if (!businessDoc.exists()) {
      console.log('❌ Business not found!');
      return;
    }
    
    console.log('✅ Business exists:', businessDoc.data());
    
    // Check all subcollections
    const collections = ['staff', 'attendance_events', 'settings', 'shifts', 'whatsapp_templates'];
    
    for (const collName of collections) {
      const collRef = collection(db, 'businesses', businessId, collName);
      const snapshot = await getDocs(collRef);
      console.log(`📁 ${collName}: ${snapshot.size} documents`);
      
      if (collName === 'staff' && snapshot.size > 0) {
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log(`   👤 ${doc.id}: ${data.employeeName || data.name || 'Unnamed'} (Active: ${data.active})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Detailed check failed:', error);
  }
}

// Main execution
(async () => {
  await checkBusinessesAndStaff();
  
  // If specific business ID is provided as argument
  if (process.argv[2]) {
    await checkSpecificBusiness(process.argv[2]);
  }
  
  console.log('\n🔧 NEXT STEPS:');
  console.log('1. If staff data is missing, we need to restore from backup');
  console.log('2. If data exists but app not showing, check frontend auth');
  console.log('3. Run: node emergency-staff-check.js [businessId] for detailed check');
  console.log('4. Check Firebase console: https://console.firebase.google.com/project/aiclock-82608/firestore');
  
  process.exit(0);
})();