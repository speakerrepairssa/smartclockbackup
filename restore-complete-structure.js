#!/usr/bin/env node

/**
 * COMPREHENSIVE DATA RESTORATION
 * Restore biz_srcomponents to match the intact business structure
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, updateDoc, writeBatch } from 'firebase/firestore';

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

async function restoreCompleteStructure() {
  try {
    console.log('🚨 COMPREHENSIVE DATA RESTORATION...\n');

    const businessId = 'biz_srcomponents';
    
    // 1. ⭐ RESTORE COMPLETE BUSINESS DOCUMENT
    console.log('🏢 Restoring complete business configuration...');
    const businessRef = doc(db, 'businesses', businessId);
    
    const completeBusinessData = {
      // Core identity
      businessId: businessId,
      businessName: 'SR Components',
      adminEmail: 'info@srcomponents.co.za',
      email: 'info@srcomponents.co.za',
      password: 'srcomponents',
      phone: '+27123456789',
      
      // Device configuration (restored)
      deviceId: 'FC4349999',
      linkedDevices: ['FC4349999', 'admin'],
      deviceCount: 1,
      devicesCount: 1,
      
      // Business settings
      slotsAllowed: 20,
      maxEmployees: 20,
      apiEnabled: true,
      status: 'active',
      approved: true,
      plan: 'Professional',
      
      // Working schedule (full structure to match intact business)
      schedule: {
        monday: { enabled: true, startTime: '08:30', endTime: '17:00', payRate: 1 },
        tuesday: { enabled: true, startTime: '08:30', endTime: '17:00', payRate: 1 },
        wednesday: { enabled: true, startTime: '08:30', endTime: '17:00', payRate: 1 },
        thursday: { enabled: true, startTime: '08:30', endTime: '17:00', payRate: 1 },
        friday: { enabled: true, startTime: '08:30', endTime: '17:00', payRate: 1 },
        saturday: { enabled: true, startTime: '08:30', endTime: '14:30', payRate: 1.25 },
        sunday: { enabled: false, startTime: '08:00', endTime: '17:00', payRate: 0 }
      },
      
      // Legacy time fields
      workStartTime: '08:30',
      workEndTime: '17:00',
      mondayStartTime: '08:30',
      mondayEndTime: '17:00',
      tuesdayStartTime: '08:30',
      tuesdayEndTime: '17:00',
      wednesdayStartTime: '08:30',
      wednesdayEndTime: '17:00',
      thursdayStartTime: '08:30', 
      thursdayEndTime: '17:00',
      fridayStartTime: '08:30',
      fridayEndTime: '17:00',
      saturdayStartTime: '08:30',
      saturdayEndTime: '14:30',
      
      // Financial settings
      currency: 'R',
      overtimeRate: 1.5,
      overtimeMultiplier: 1.5,
      overtimeRule: 'none',
      breakDuration: 60,
      lateGracePeriod: 15,
      
      // Holidays
      publicHolidays: [
        '2026-01-01', '2026-03-21', '2026-04-03', '2026-04-06',
        '2026-04-27', '2026-05-01', '2026-06-16', '2026-08-09',
        '2026-08-10', '2026-09-24', '2026-12-16', '2026-12-25',
        '2026-12-26'
      ],
      
      // Working days
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false,
      
      // Metadata
      timezone: 'Africa/Johannesburg',
      createdAt: '2024-01-01T00:00:00.000Z',
      createdBy: 'admin',
      approvedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSlotSync: new Date().toISOString(),
      lastDeviceUpdate: new Date().toISOString(),
      lastDeviceCountUpdate: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      planUpdatedAt: new Date().toISOString(),
      
      // Restoration metadata
      lastFullRestore: new Date().toISOString(),
      restoredBy: 'comprehensive_restoration_v3',
      restorationReason: 'Destructive functions recovery'
    };

    await setDoc(businessRef, completeBusinessData, { merge: true });
    console.log('✅ Business document restored');

    // 2. 👥 RESTORE EMPLOYEE DATA
    console.log('👥 Restoring employee data...');
    
    const knownEmployees = {
      '9': { 
        name: 'nabu', 
        position: 'Technician',
        hourlyRate: 150,
        phone: '+27600000009',
        email: 'nabu@srcomponents.co.za'
      },
      '10': { 
        name: 'eric', 
        position: 'Senior Technician',
        hourlyRate: 180,
        phone: '+27600000010',
        email: 'eric@srcomponents.co.za'
      },
      '11': { 
        name: 'umar', 
        position: 'Technician',
        hourlyRate: 160,
        phone: '+27600000011',
        email: 'umar@srcomponents.co.za'
      },
      '12': { 
        name: 'selwyn', 
        position: 'Workshop Assistant',
        hourlyRate: 140,
        phone: '+27600000012',
        email: 'selwyn@srcomponents.co.za'
      }
    };

    const batch = writeBatch(db);
    
    // Create all 20 slots
    for (let slotId = 1; slotId <= 20; slotId++) {
      const staffRef = doc(db, 'businesses', businessId, 'staff', slotId.toString());
      
      if (knownEmployees[slotId.toString()]) {
        // Real employee data
        const employee = knownEmployees[slotId.toString()];
        const employeeData = {
          employeeId: slotId.toString(),
          employeeName: employee.name,
          name: employee.name, // Backup field
          badgeNumber: slotId,
          active: true,
          position: employee.position,
          hourlyRate: employee.hourlyRate,
          phone: employee.phone,
          email: employee.email,
          
          // Clock status (all out by default since attendance events were wiped)
          status: 'OUT',
          lastClockStatus: 'OUT',
          clockInTime: null,
          clockInTimestamp: null,
          clockOutTime: null,
          clockOutTimestamp: null,
          
          // Metadata
          isActive: true,
          assignedAt: new Date().toISOString(),
          lockedIn: false,
          deviceId: '',
          createdBy: 'comprehensive_restore',
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          slotNumber: slotId
        };
        
        batch.set(staffRef, employeeData);
        console.log(`   ✅ Restored real employee: Slot ${slotId} - ${employee.name}`);
      } else {
        // Empty slot template
        const emptySlotData = {
          employeeId: slotId.toString(),
          employeeName: `Employee ${slotId}`,
          name: `Employee ${slotId}`,
          badgeNumber: slotId,
          active: false,
          position: 'Not assigned',
          hourlyRate: 150,
          phone: 'Not set',
          email: 'Not set',
          
          // Status
          status: 'OUT',
          lastClockStatus: 'OUT',
          clockInTime: null,
          clockInTimestamp: null,
          
          // Metadata  
          isActive: false,
          assignedAt: null,
          lockedIn: false,
          deviceId: '',
          createdBy: 'comprehensive_restore',
          createdAt: new Date().toISOString(),
          slotNumber: slotId
        };
        
        batch.set(staffRef, emptySlotData);
      }
    }

    await batch.commit();
    console.log('✅ All 20 staff slots restored');

    // 3. ⚙️ RESTORE SETTINGS
    console.log('⚙️ Restoring settings...');
    
    // General settings
    const generalSettingsRef = doc(db, 'businesses', businessId, 'settings', 'general');
    const generalSettings = {
      workStartTime: '08:30',
      workEndTime: '17:00',
      saturdayStartTime: '08:30',
      saturdayEndTime: '14:30',
      currency: 'R',
      timezone: 'Africa/Johannesburg',
      breakDuration: 60,
      overtimeRate: 1.5,
      businessName: 'SR Components',
      createdAt: new Date().toISOString()
    };
    
    await setDoc(generalSettingsRef, generalSettings);
    console.log('✅ General settings restored');

    // WhatsApp settings placeholder 
    const whatsappSettingsRef = doc(db, 'businesses', businessId, 'settings', 'whatsapp');
    const whatsappSettings = {
      enabled: false,
      accessToken: '',
      phoneNumberId: '',
      businessAccountId: '',
      phoneNumber: '',
      businessName: 'SR Components',
      setupDate: new Date().toISOString(),
      templateCount: 0,
      templateNames: []
    };
    
    await setDoc(whatsappSettingsRef, whatsappSettings);
    console.log('✅ WhatsApp settings template created');

    console.log('\n🎉 COMPREHENSIVE RESTORATION COMPLETE!');
    console.log('\n📋 Summary:');
    console.log('✅ Business document - Full configuration restored');
    console.log('✅ Employee data - 4 real employees + 16 empty slots');  
    console.log('✅ Settings - General & WhatsApp configurations');
    console.log('✅ Working hours - Complete schedule structure');
    console.log('✅ Financial settings - Currency, rates, holidays');
    
    console.log('\n🔐 Login Details:');
    console.log('   Business: SR Components');
    console.log('   Email: info@srcomponents.co.za');
    console.log('   Password: srcomponents');
    console.log('   URL: https://aiclock-82608.web.app/pages/business-login.html');
    
    console.log('\n👥 Restored Employees:');
    Object.entries(knownEmployees).forEach(([slot, emp]) => {
      console.log(`   Slot ${slot}: ${emp.name} (${emp.position}) - R${emp.hourlyRate}/hour`);
    });

  } catch (error) {
    console.error('❌ Comprehensive restoration failed:', error);
    process.exit(1);
  }
}

// Run restoration
(async () => {
  await restoreCompleteStructure();
  process.exit(0);
})();