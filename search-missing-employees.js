#!/usr/bin/env node

/**
 * SEARCH FOR MISSING EMPLOYEE DATA
 * Look for traces of the original 10 employees in various collections
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

async function searchForMissingEmployees() {
  try {
    console.log('🔍 SEARCHING FOR MISSING EMPLOYEE DATA...\n');

    const businessId = 'biz_srcomponents';

    // 1. Check attendance events for employee names
    console.log('📅 Checking attendance events for employee names...');
    const eventsRef = collection(db, 'businesses', businessId, 'attendance_events');
    const eventsSnapshot = await getDocs(eventsRef);
    
    const employeeNames = new Set();
    eventsSnapshot.docs.forEach(eventDoc => {
      const data = eventDoc.data();
      if (data.employeeName && data.employeeName !== 'Employee 1' && data.employeeName !== 'Employee 2') {
        employeeNames.add(`${data.employeeId}: ${data.employeeName}`);
      }
    });
    
    if (employeeNames.size > 0) {
      console.log('Found employees in attendance events:');
      employeeNames.forEach(emp => console.log(`   ${emp}`));
    } else {
      console.log('❌ No employee traces found in attendance events');
    }

    // 2. Check other businesses for reference structure
    console.log('\n🏢 Checking other businesses for similar employee structure...');
    
    const speakerRepairsRef = collection(db, 'businesses', 'biz_speaker_repairs', 'staff');
    const speakerRepairsSnapshot = await getDocs(speakerRepairsRef);
    
    console.log('📋 biz_speaker_repairs staff structure:');
    const speakerEmployees = [];
    speakerRepairsSnapshot.docs.forEach(staffDoc => {
      const data = staffDoc.data();
      if (data.employeeName && !data.employeeName.startsWith('Employee ')) {
        speakerEmployees.push({
          slot: staffDoc.id,
          name: data.employeeName,
          active: data.active
        });
      }
    });
    
    speakerEmployees.forEach(emp => {
      console.log(`   Slot ${emp.slot}: ${emp.name} (Active: ${emp.active})`);
    });

    // 3. Check assessment cache for employee traces
    console.log('\n📊 Checking assessment cache for employee data...');
    const assessmentRef = collection(db, 'businesses', businessId, 'assessment_cache');
    const assessmentSnapshot = await getDocs(assessmentRef);
    
    const assessmentEmployees = new Set();
    assessmentSnapshot.docs.forEach(assessDoc => {
      const data = assessDoc.data();
      if (data.employeeAssessments) {
        Object.keys(data.employeeAssessments).forEach(empId => {
          const empData = data.employeeAssessments[empId];
          if (empData.employeeName && !empData.employeeName.startsWith('Employee ')) {
            assessmentEmployees.add(`${empId}: ${empData.employeeName}`);
          }
        });
      }
    });
    
    if (assessmentEmployees.size > 0) {
      console.log('Found employees in assessment cache:');
      assessmentEmployees.forEach(emp => console.log(`   ${emp}`));
    } else {
      console.log('❌ No employee traces found in assessment cache');
    }

    // 4. Check for any remaining device mappings
    console.log('\n🔗 Checking device mappings...');
    try {
      const mappingsRef = collection(db, 'businesses', businessId, 'device_mappings');
      const mappingsSnapshot = await getDocs(mappingsRef);
      
      if (mappingsSnapshot.size > 0) {
        console.log('Found device mappings:');
        mappingsSnapshot.docs.forEach(mappingDoc => {
          const data = mappingDoc.data();
          console.log(`   Device ${mappingDoc.id}: Slot ${data.slotId}, Employee: ${data.employeeName || 'Not set'}`);
        });
      } else {
        console.log('❌ No device mappings found');
      }
    } catch (error) {
      console.log('❌ No device mappings collection');
    }

    // 5. Check current staff for any missed employees
    console.log('\n👥 Re-checking current staff collection...');
    const staffRef = collection(db, 'businesses', businessId, 'staff');
    const staffSnapshot = await getDocs(staffRef);
    
    const currentRealEmployees = [];
    staffSnapshot.docs.forEach(staffDoc => {
      const data = staffDoc.data();
      if (data.employeeName && !data.employeeName.startsWith('Employee ') && data.active === true) {
        currentRealEmployees.push({
          slot: staffDoc.id,
          name: data.employeeName,
          position: data.position,
          hourlyRate: data.hourlyRate
        });
      }
    });
    
    console.log(`Currently restored real employees: ${currentRealEmployees.length}`);
    currentRealEmployees.forEach(emp => {
      console.log(`   Slot ${emp.slot}: ${emp.name} (${emp.position}) - R${emp.hourlyRate}`);
    });

    console.log('\n❓ MISSING EMPLOYEE IDENTIFICATION');
    console.log('We need to identify the 6 missing employees from your original 10-person team.');
    console.log('Current confirmed: nabu, eric, umar, selwyn (4 employees)');
    console.log('Missing: 6 more employees');
    
    console.log('\n💡 OPTIONS:');
    console.log('1. Can you provide the names of the other 6 employees?');
    console.log('2. Check if any appear in the other business structures above');
    console.log('3. They will need to be manually re-added with proper details');

  } catch (error) {
    console.error('❌ Search failed:', error);
    process.exit(1);
  }
}

// Run search  
(async () => {
  await searchForMissingEmployees();
  process.exit(0);
})();