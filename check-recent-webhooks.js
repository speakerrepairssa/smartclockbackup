#!/usr/bin/env node

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

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

async function checkRecentActivity() {
  try {
    console.log('\n🔍 Checking Recent Attendance for SR Components...');
    console.log('='.repeat(60));
    
    // Check attendance for SR Components in last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const attendanceRef = collection(db, 'businesses', 'biz_srcomponents', 'attendance');
    const q = query(
      attendanceRef,
      where('timestamp', '>=', yesterday),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('\n⚠️  No attendance records in the last 24 hours');
    } else {
      console.log(`\n✅ Found ${snapshot.size} attendance record(s):\n`);
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log('📍', data.timestamp?.toDate?.() || data.timestamp);
        console.log('   Employee:', data.employeeName || data.employeeId);
        console.log('   Type:', data.type);
        console.log('   Device:', data.deviceId || 'N/A');
        console.log('');
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nNote: If error mentions "timestamp", attendance might exist but without proper timestamp field');
    
    // Try without date filter
    try {
      const attendanceRef = collection(db, 'businesses', 'biz_srcomponents', 'attendance');
      const q = query(attendanceRef, limit(10));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('⚠️  No attendance records at all');
      } else {
        console.log(`\n✅ Found ${snapshot.size} attendance record(s) (no date filter):\n`);
        snapshot.forEach(doc => {
          const data = doc.data();
          console.log('📍', data.timestamp?.toDate?.() || data.timestamp);
          console.log('   Employee:', data.employeeName || data.employeeId);
          console.log('   Type:', data.type);
          console.log('   Device:', data.deviceId || 'N/A');
          console.log('');
        });
      }
    } catch (err) {
      console.error('Failed to query without filter:', err.message);
    }
    
    process.exit(1);
  }
}

checkRecentActivity();
