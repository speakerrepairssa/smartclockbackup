#!/usr/bin/env node

/**
 * RESTORE EMPLOYEE CLOCK-IN STATUS
 * Find recent clock-ins without clock-outs and restore Monitor Mode
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, orderBy, limit } from 'firebase/firestore';

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

async function restoreEmployeeStatus() {
  try {
    console.log('🔄 RESTORING EMPLOYEE CLOCK-IN STATUS...\n');

    const businessId = 'biz_srcomponents';
    
    // Get recent attendance events to see who should be clocked in
    const eventsRef = collection(db, 'businesses', businessId, 'attendance_events');
    const eventsSnapshot = await getDocs(eventsRef);
    
    console.log(`📅 Found ${eventsSnapshot.size} attendance events`);
    
    // Track last status for each employee
    const employeeStatuses = {};
    
    eventsSnapshot.docs.forEach(eventDoc => {
      const eventData = eventDoc.data();
      const employeeId = eventData.employeeId;
      const eventTime = new Date(eventData.time);
      const eventType = eventData.type;
      
      if (!employeeStatuses[employeeId] || eventTime > new Date(employeeStatuses[employeeId].time)) {
        employeeStatuses[employeeId] = {
          time: eventData.time,
          type: eventType,
          name: eventData.employeeName,
          timestamp: eventData.timestamp
        };
      }
    });
    
    console.log('\n📊 Last known status for each employee:');
    Object.keys(employeeStatuses).forEach(empId => {
      const status = employeeStatuses[empId];
      console.log(`   ${empId}: ${status.name} - ${status.type} at ${status.time}`);
    });
    
    // Restore data for known real employees and set proper status
    const realEmployees = {
      '9': { name: 'nabu', position: 'Technician' },
      '10': { name: 'eric', position: 'Manager' },
      '11': { name: 'umar', position: 'Technician' },
      '12': { name: 'selwyn', position: 'Technician' }
    };
    
    console.log('\n🔧 Restoring employee data and status...');
    
    for (const [slotId, empData] of Object.entries(realEmployees)) {
      const staffRef = doc(db, 'businesses', businessId, 'staff', slotId);
      
      // Determine if employee should be clocked in based on last event
      const lastStatus = employeeStatuses[slotId];
      const shouldBeActivelyClocked = lastStatus && lastStatus.type === 'clock-in';
      
      const updateData = {
        employeeName: empData.name,
        name: empData.name, // Backup field
        badgeNumber: parseInt(slotId),
        employeeId: slotId,
        active: true,
        position: empData.position,
        hourlyRate: 150,
        phone: '+27000000000', // Placeholder
        email: `${empData.name}@srcomponents.co.za`,
        
        // Restore clock status if they were clocked in
        ...(shouldBeActivelyClocked && {
          status: 'IN',
          lastClockStatus: 'IN', 
          clockInTime: lastStatus.time,
          clockInTimestamp: lastStatus.timestamp || new Date(lastStatus.time).getTime()
        }),
        
        // If not clocked in, ensure they're properly clocked out
        ...(!shouldBeActivelyClocked && {
          status: 'OUT',
          lastClockStatus: 'OUT',
          clockInTime: null,
          clockInTimestamp: null
        }),
        
        lastUpdated: new Date().toISOString(),
        restoredBy: 'emergency_status_restore'
      };
      
      await updateDoc(staffRef, updateData);
      
      const statusText = shouldBeActivelyClocked ? '🟢 CLOCKED IN' : '⚪ CLOCKED OUT';
      console.log(`   ✅ Restored ${empData.name} (Slot ${slotId}) - ${statusText}`);
    }
    
    console.log('\n🎯 RESTORATION COMPLETE!');
    console.log('🔄 Please refresh your dashboard to see restored employee status.');
    
  } catch (error) {
    console.error('❌ Status restoration failed:', error);
    process.exit(1);
  }
}

// Run restoration
(async () => {
  await restoreEmployeeStatus();
  process.exit(0);
})();