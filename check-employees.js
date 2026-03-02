#!/usr/bin/env node

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function checkEmployees() {
  try {
    console.log('\n👥 Checking Employees in SR Components...');
    console.log('='.repeat(60));
    
    const employeesRef = collection(db, 'businesses', 'biz_srcomponents', 'employees');
    const snapshot = await getDocs(employeesRef);
    
    if (snapshot.empty) {
      console.log('\n⚠️  No employees found!');
      console.log('\nYou need to add employees to SR Components first.');
      console.log('Employees must have badge numbers that match what the device sends.');
    } else {
      console.log(`\n✅ Found ${snapshot.size} employee(s):\n`);
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log('📍 Employee:', data.name || doc.id);
        console.log('   Badge Number:', data.badgeNumber || data.employeeId || 'N/A');
        console.log('   ID:', doc.id);
        console.log('   Status:', data.status || 'N/A');
        console.log('');
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkEmployees();
