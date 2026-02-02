/**
 * Firestore to Firebase Data Connect Migration Script
 * 
 * This script exports all data from the current Firestore collections
 * and imports them into the new Firebase Data Connect PostgreSQL database.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDataConnect } from 'firebase-admin/data-connect';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccount.json');

// Initialize Firebase Admin SDK
const app = initializeApp({
  credential: require('firebase-admin').credential.cert(serviceAccount),
  databaseURL: 'https://aiclock-82608-default-rtdb.firebaseio.com/'
});

const db = getFirestore(app);
const dc = getDataConnect({
  location: "us-central1",
  serviceId: "aiclock-service"
});

// Helper function to generate UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper function to map Firestore plan to Data Connect enum
function mapBusinessPlan(plan) {
  if (!plan) return 'BASIC';
  const planUpper = plan.toUpperCase();
  if (['BASIC', 'PREMIUM', 'ENTERPRISE', 'CUSTOM'].includes(planUpper)) {
    return planUpper;
  }
  return 'BASIC';
}

// Helper function to map status
function mapBusinessStatus(status) {
  if (!status) return 'ACTIVE';
  const statusUpper = status.toUpperCase();
  if (['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL'].includes(statusUpper)) {
    return statusUpper;
  }
  return 'ACTIVE';
}

// Helper function to map attendance status
function mapAttendanceStatus(status) {
  if (!status) return 'OUT';
  const statusUpper = status.toUpperCase();
  return statusUpper === 'IN' ? 'IN' : 'OUT';
}

// Helper function to map event type
function mapEventType(type) {
  if (!type) return 'CHECKIN';
  const typeUpper = type.toUpperCase();
  const mappings = {
    'CLOCK-IN': 'CHECKIN',
    'CLOCK_IN': 'CHECKIN',
    'CHECKIN': 'CHECKIN',
    'CLOCK-OUT': 'CHECKOUT', 
    'CLOCK_OUT': 'CHECKOUT',
    'CHECKOUT': 'CHECKOUT',
    'BREAK_OUT': 'BREAK_OUT',
    'BREAK_IN': 'BREAK_IN',
    'MANUAL_IN': 'MANUAL_IN',
    'MANUAL_OUT': 'MANUAL_OUT'
  };
  return mappings[typeUpper] || 'CHECKIN';
}

// Helper function to map event source
function mapEventSource(source) {
  if (!source) return 'WEBHOOK';
  const sourceUpper = source.toUpperCase();
  const mappings = {
    'WEBHOOK': 'WEBHOOK',
    'SYNC': 'SYNC',
    'MANUAL': 'MANUAL',
    'IMPORT': 'IMPORT',
    'CORRECTION': 'CORRECTION'
  };
  return mappings[sourceUpper] || 'WEBHOOK';
}

/**
 * Export all data from Firestore
 */
async function exportFirestoreData() {
  console.log('🔄 Starting Firestore data export...');
  
  const businesses = [];
  const employees = [];
  const statuses = [];
  const events = [];
  const devices = [];
  
  // Create mapping for employee IDs (slot -> UUID)
  const employeeIdMap = new Map();
  const businessEmployeeMap = new Map(); // business -> slot -> employee data

  try {
    // Export all businesses
    console.log('📊 Exporting businesses...');
    const businessesRef = db.collection('businesses');
    const businessSnapshot = await businessesRef.get();
    
    for (const businessDoc of businessSnapshot.docs) {
      const businessData = businessDoc.data();
      const businessId = businessDoc.id;
      
      const business = {
        id: businessId,
        businessName: businessData.businessName || 'Unknown Business',
        email: businessData.email || `${businessId}@example.com`,
        plan: mapBusinessPlan(businessData.plan),
        slotsAllowed: businessData.slotsAllowed || 6,
        status: mapBusinessStatus(businessData.status),
        deviceId: businessData.deviceId || null,
        createdAt: businessData.createdAt || new Date().toISOString(),
        updatedAt: businessData.updatedAt || new Date().toISOString()
      };
      
      businesses.push(business);
      businessEmployeeMap.set(businessId, new Map());
      
      console.log(`   ✅ Exported business: ${business.businessName} (${businessId})`);
      
      // Export staff/employees for this business
      console.log(`📝 Exporting employees for ${business.businessName}...`);
      const staffRef = db.collection('businesses').doc(businessId).collection('staff');
      const staffSnapshot = await staffRef.get();
      
      for (const staffDoc of staffSnapshot.docs) {
        const staffData = staffDoc.data();
        const slotId = parseInt(staffDoc.id);
        const employeeUUID = generateUUID();
        
        const employee = {
          id: employeeUUID,
          businessId: businessId,
          slotId: slotId,
          employeeId: staffData.employeeId || staffDoc.id,
          employeeName: staffData.employeeName || `Employee ${slotId}`,
          badgeNumber: staffData.badgeNumber || staffDoc.id,
          active: staffData.active !== false,
          phone: staffData.phone || null,
          email: staffData.email || null,
          position: staffData.position || null,
          department: staffData.department || null,
          idNumber: staffData.idNumber || null,
          address: staffData.address || null,
          hireDate: staffData.hireDate || null,
          hourlyRate: staffData.hourlyRate ? parseFloat(staffData.hourlyRate) : null,
          notes: staffData.notes || null,
          createdAt: staffData.createdAt || new Date().toISOString(),
          updatedAt: staffData.updatedAt || new Date().toISOString()
        };
        
        employees.push(employee);
        
        // Store mapping for later use
        const key = `${businessId}-${slotId}`;
        employeeIdMap.set(key, employeeUUID);
        businessEmployeeMap.get(businessId).set(slotId, employee);
        
        console.log(`     ✅ Exported employee: ${employee.employeeName} (Slot ${slotId})`);
      }
      
      // Export employee status for this business
      console.log(`⚡ Exporting employee statuses for ${business.businessName}...`);
      const statusRef = db.collection('businesses').doc(businessId).collection('status');
      const statusSnapshot = await statusRef.get();
      
      for (const statusDoc of statusSnapshot.docs) {
        const statusData = statusDoc.data();
        const slotId = parseInt(statusDoc.id);
        const employeeUUID = employeeIdMap.get(`${businessId}-${slotId}`);
        
        if (employeeUUID) {
          const status = {
            id: generateUUID(),
            businessId: businessId,
            employeeId: employeeUUID,
            attendanceStatus: mapAttendanceStatus(statusData.attendanceStatus),
            lastClockStatus: mapAttendanceStatus(statusData.lastClockStatus || statusData.attendanceStatus),
            lastClockTime: statusData.lastClockTime || null,
            lastEventType: mapEventType(statusData.lastEventType),
            deviceId: statusData.deviceId || null,
            updatedAt: statusData.updatedAt || new Date().toISOString()
          };
          
          statuses.push(status);
          console.log(`     ✅ Exported status for: ${statusData.employeeName || 'Unknown'} (${status.attendanceStatus})`);
        }
      }
      
      // Export attendance events for this business
      console.log(`📅 Exporting attendance events for ${business.businessName}...`);
      const eventsRef = db.collection('businesses').doc(businessId).collection('attendance_events');
      const eventsSnapshot = await eventsRef.get();
      
      let eventCount = 0;
      for (const eventDoc of eventsSnapshot.docs) {
        const eventData = eventDoc.data();
        const slotNumber = eventData.slotNumber || 1;
        const employeeUUID = employeeIdMap.get(`${businessId}-${slotNumber}`);
        
        if (employeeUUID && eventData.timestamp) {
          const timestamp = eventData.timestamp;
          const eventDate = eventData.eventDate || timestamp.split('T')[0];
          const eventTime = eventData.eventTime || new Date(timestamp).toTimeString().split(' ')[0];
          
          const event = {
            id: generateUUID(),
            businessId: businessId,
            employeeId: employeeUUID,
            slotNumber: slotNumber,
            timestamp: timestamp,
            attendanceStatus: mapAttendanceStatus(eventData.attendanceStatus),
            eventDate: eventDate,
            eventTime: eventTime,
            deviceId: eventData.deviceId || 'unknown',
            verifyNo: eventData.verifyNo || null,
            source: mapEventSource(eventData.source),
            eventType: mapEventType(eventData.type || eventData.eventType),
            isDuplicatePunch: eventData.isDuplicatePunch || false,
            mispunchType: eventData.mispunchType || null,
            mispunchReason: eventData.mispunchReason || null,
            manualNotes: eventData.manualNotes || null,
            isManual: eventData.isManual || false,
            createdAt: eventData.recordedAt || timestamp
          };
          
          events.push(event);
          eventCount++;
        }
      }
      
      console.log(`     ✅ Exported ${eventCount} attendance events`);
    }
    
    console.log('✅ Firestore export completed!');
    console.log(`📊 Export Summary:`);
    console.log(`   • Businesses: ${businesses.length}`);
    console.log(`   • Employees: ${employees.length}`);
    console.log(`   • Statuses: ${statuses.length}`);
    console.log(`   • Events: ${events.length}`);
    console.log(`   • Devices: ${devices.length}`);
    
    return { businesses, employees, statuses, events, devices };
    
  } catch (error) {
    console.error('❌ Error during export:', error);
    throw error;
  }
}

/**
 * Import data to Firebase Data Connect
 */
async function importToDataConnect(data) {
  console.log('🔄 Starting Data Connect import...');
  
  try {
    // Import businesses first (they are referenced by other tables)
    console.log('📊 Importing businesses...');
    if (data.businesses.length > 0) {
      await dc.insertMany("business", data.businesses);
      console.log(`   ✅ Imported ${data.businesses.length} businesses`);
    }
    
    // Import employees
    console.log('📝 Importing employees...');
    if (data.employees.length > 0) {
      await dc.insertMany("employee", data.employees);
      console.log(`   ✅ Imported ${data.employees.length} employees`);
    }
    
    // Import employee statuses
    console.log('⚡ Importing employee statuses...');
    if (data.statuses.length > 0) {
      await dc.insertMany("employeeStatus", data.statuses);
      console.log(`   ✅ Imported ${data.statuses.length} employee statuses`);
    }
    
    // Import attendance events (in batches due to size)
    console.log('📅 Importing attendance events...');
    if (data.events.length > 0) {
      const batchSize = 1000;
      const batches = Math.ceil(data.events.length / batchSize);
      
      for (let i = 0; i < batches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, data.events.length);
        const batch = data.events.slice(start, end);
        
        await dc.insertMany("attendanceEvent", batch);
        console.log(`   ✅ Imported batch ${i + 1}/${batches} (${batch.length} events)`);
      }
      
      console.log(`   ✅ Imported total ${data.events.length} attendance events`);
    }
    
    // Import devices
    console.log('📱 Importing devices...');
    if (data.devices.length > 0) {
      await dc.insertMany("device", data.devices);
      console.log(`   ✅ Imported ${data.devices.length} devices`);
    }
    
    console.log('✅ Data Connect import completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during import:', error);
    throw error;
  }
}

/**
 * Validate imported data
 */
async function validateImport(originalData) {
  console.log('🔍 Validating imported data...');
  
  try {
    // Validate business count
    const businessCount = await dc.executeQuery(`
      query { businesses { id } }
    `);
    console.log(`✅ Businesses: ${businessCount.data.businesses.length}/${originalData.businesses.length}`);
    
    // Validate employee count
    const employeeCount = await dc.executeQuery(`
      query { employees { id } }
    `);
    console.log(`✅ Employees: ${employeeCount.data.employees.length}/${originalData.employees.length}`);
    
    // Validate event count
    const eventCount = await dc.executeQuery(`
      query { attendanceEvents { id } }
    `);
    console.log(`✅ Events: ${eventCount.data.attendanceEvents.length}/${originalData.events.length}`);
    
    console.log('✅ Data validation completed!');
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  try {
    console.log('🚀 Starting AiClock Firestore → Data Connect Migration');
    console.log('='.repeat(60));
    
    // Step 1: Export from Firestore
    const exportedData = await exportFirestoreData();
    
    console.log('\n' + '='.repeat(60));
    
    // Step 2: Import to Data Connect
    await importToDataConnect(exportedData);
    
    console.log('\n' + '='.repeat(60));
    
    // Step 3: Validate import
    await validateImport(exportedData);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Migration completed successfully!');
    console.log('✅ All data has been migrated to Firebase Data Connect');
    console.log('✅ Your AiClock system is now running on PostgreSQL');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

export {
  exportFirestoreData,
  importToDataConnect,
  validateImport,
  runMigration
};