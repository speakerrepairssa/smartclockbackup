const admin = require('firebase-admin');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * 🔄 MIGRATE ALL DATA TO UNIFIED ATTENDANCE_EVENTS COLLECTION
 * This script consolidates data from multiple collections into a single source of truth
 */
async function migrateToUnifiedCollections(businessId) {
  console.log(`🚀 Starting migration for business: ${businessId}`);
  
  const batch = db.batch();
  let migrationCount = 0;
  const migratedData = {
    fromEmployeeTimesheets: 0,
    fromDeviceEvents: 0,
    fromEmployeeLastAttendance: 0,
    totalEvents: 0
  };

  try {
    // 1️⃣ MIGRATE FROM EMPLOYEE_TIMESHEETS
    console.log('📊 Migrating from employee_timesheets...');
    
    const timesheetsRef = db.collection('businesses').doc(businessId).collection('employee_timesheets');
    const employeeTimesheets = await timesheetsRef.get();
    
    for (const empDoc of employeeTimesheets.docs) {
      const employeeId = empDoc.id;
      console.log(`  Processing employee ${employeeId}...`);
      
      // Get all daily sheets for this employee
      const dailySheetsRef = empDoc.ref.collection('daily_sheets');
      const dailySheets = await dailySheetsRef.get();
      
      dailySheets.forEach(dayDoc => {
        const dayData = dayDoc.data();
        const date = dayData.date;
        
        // Convert clock events to attendance_events format
        if (dayData.clockEvents && Array.isArray(dayData.clockEvents)) {
          dayData.clockEvents.forEach((clockEvent, index) => {
            const eventRef = db.collection('businesses')
              .doc(businessId)
              .collection('attendance_events')
              .doc();
            
            const attendanceStatus = clockEvent.type === 'clock-in' ? 'in' : 'out';
            
            const unifiedEvent = {
              businessId,
              slotNumber: parseInt(employeeId),
              employeeId: employeeId,
              employeeName: dayData.employeeName || `Employee ${employeeId}`,
              timestamp: clockEvent.timestamp,
              attendanceStatus,
              eventDate: date,
              eventTime: clockEvent.time,
              deviceId: 'migrated_from_timesheet',
              deviceName: 'Migrated Data',
              verifyNo: `migrated_${date}_${employeeId}_${index}`,
              source: 'timesheet_migration',
              migratedAt: new Date().toISOString(),
              originalCollection: 'employee_timesheets',
              workPeriods: dayData.workPeriods || [],
              totalHours: dayData.totalHours || 0,
              overtimeHours: dayData.overtimeHours || 0
            };
            
            batch.set(eventRef, unifiedEvent);
            migrationCount++;
            migratedData.fromEmployeeTimesheets++;
          });
        }
      });
    }

    // 2️⃣ MIGRATE FROM DEVICE-SPECIFIC EVENT COLLECTIONS
    console.log('📱 Migrating from device-specific event collections...');
    
    // Find all device event collections (pattern: device_*_events)
    const businessRef = db.collection('businesses').doc(businessId);
    const allCollections = await businessRef.listCollections();
    
    const deviceCollections = allCollections.filter(col => 
      col.id.startsWith('device_') && col.id.endsWith('_events')
    );
    
    for (const deviceCol of deviceCollections) {
      const deviceId = deviceCol.id.replace('device_', '').replace('_events', '');
      console.log(`  Processing device collection: ${deviceCol.id}`);
      
      // Get all date documents
      const dateDocs = await deviceCol.get();
      
      for (const dateDoc of dateDocs.docs) {
        const eventDate = dateDoc.id;
        
        // Get all employee slot collections for this date
        const slotCollections = await dateDoc.ref.listCollections();
        
        for (const slotCol of slotCollections) {
          const slotNumber = parseInt(slotCol.id);
          
          // Get all events for this slot/date
          const events = await slotCol.get();
          
          events.forEach(eventDoc => {
            const eventData = eventDoc.data();
            
            const eventRef = db.collection('businesses')
              .doc(businessId)
              .collection('attendance_events')
              .doc();
            
            const unifiedEvent = {
              businessId,
              slotNumber,
              employeeId: slotNumber.toString(),
              employeeName: eventData.employeeName || `Employee ${slotNumber}`,
              timestamp: eventData.timestamp || new Date().toISOString(),
              attendanceStatus: eventData.attendanceStatus || 'in',
              eventDate,
              eventTime: eventData.eventTime || new Date().toTimeString().split(' ')[0],
              deviceId: deviceId,
              deviceName: eventData.deviceName || deviceId,
              verifyNo: eventData.verifyNo || `migrated_${deviceId}_${eventDoc.id}`,
              source: 'device_migration',
              migratedAt: new Date().toISOString(),
              originalCollection: deviceCol.id,
              originalEventId: eventDoc.id
            };
            
            batch.set(eventRef, unifiedEvent);
            migrationCount++;
            migratedData.fromDeviceEvents++;
          });
        }
      }
    }

    // 3️⃣ MIGRATE CURRENT STATUS FROM EMPLOYEE_LAST_ATTENDANCE
    console.log('🏪 Updating status from employee_last_attendance...');
    
    const lastAttendanceRef = db.collection('businesses').doc(businessId).collection('employee_last_attendance');
    const lastAttendanceDocs = await lastAttendanceRef.get();
    
    lastAttendanceDocs.forEach(doc => {
      const data = doc.data();
      const slotNumber = parseInt(doc.id);
      
      // Update status collection with last known state
      const statusRef = db.collection('businesses')
        .doc(businessId)
        .collection('status')
        .doc(slotNumber.toString());
      
      const statusUpdate = {
        employeeId: slotNumber.toString(),
        employeeName: data.employeeName || `Employee ${slotNumber}`,
        badgeNumber: slotNumber.toString(),
        attendanceStatus: data.currentStatus || 'out',
        lastClockStatus: data.currentStatus || 'out',
        lastClockTime: data.lastEventTime || new Date().toISOString(),
        lastEventType: data.lastEventType || 'checkout',
        updatedAt: new Date().toISOString(),
        migratedFrom: 'employee_last_attendance'
      };
      
      batch.set(statusRef, statusUpdate, { merge: true });
      migratedData.fromEmployeeLastAttendance++;
    });

    // 4️⃣ COMMIT ALL CHANGES
    console.log(`💾 Committing ${migrationCount} events to attendance_events...`);
    
    if (migrationCount > 0) {
      await batch.commit();
      console.log('✅ Batch commit successful!');
    }

    migratedData.totalEvents = migrationCount;
    
    // 5️⃣ SUMMARY REPORT
    console.log('\n📋 MIGRATION SUMMARY:');
    console.log(`  • From employee_timesheets: ${migratedData.fromEmployeeTimesheets} events`);
    console.log(`  • From device collections: ${migratedData.fromDeviceEvents} events`);
    console.log(`  • Status updates: ${migratedData.fromEmployeeLastAttendance} employees`);
    console.log(`  • Total events migrated: ${migratedData.totalEvents}`);
    console.log(`  • Migration completed at: ${new Date().toISOString()}`);

    return migratedData;

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * 🧹 CLEANUP OLD COLLECTIONS (OPTIONAL - RUN AFTER VERIFYING MIGRATION)
 */
async function cleanupOldCollections(businessId) {
  console.log(`🧹 Starting cleanup of old collections for business: ${businessId}`);
  
  const businessRef = db.collection('businesses').doc(businessId);
  
  try {
    // Delete employee_timesheets
    console.log('🗑️ Deleting employee_timesheets...');
    const timesheetsRef = businessRef.collection('employee_timesheets');
    await deleteCollection(timesheetsRef);
    
    // Delete employee_last_attendance
    console.log('🗑️ Deleting employee_last_attendance...');
    const lastAttendanceRef = businessRef.collection('employee_last_attendance');
    await deleteCollection(lastAttendanceRef);
    
    // Delete device-specific collections
    console.log('🗑️ Deleting device-specific collections...');
    const allCollections = await businessRef.listCollections();
    const deviceCollections = allCollections.filter(col => 
      col.id.startsWith('device_') && col.id.endsWith('_events')
    );
    
    for (const deviceCol of deviceCollections) {
      console.log(`  Deleting ${deviceCol.id}...`);
      await deleteCollection(deviceCol);
    }
    
    console.log('✅ Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

/**
 * Helper function to delete a collection and all its subcollections
 */
async function deleteCollection(collectionRef, batchSize = 100) {
  const query = collectionRef.limit(batchSize);
  
  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();
  
  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }
  
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  
  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

// Export functions for use
module.exports = {
  migrateToUnifiedCollections,
  cleanupOldCollections
};

// If running directly from command line
if (require.main === module) {
  const businessId = process.argv[2] || 'biz_srcomponents';
  
  console.log('🔄 UNIFIED COLLECTION MIGRATION TOOL');
  console.log('====================================');
  
  migrateToUnifiedCollections(businessId)
    .then((result) => {
      console.log('\n✅ Migration completed successfully!');
      console.log('Next steps:');
      console.log('1. Verify data in attendance_events collection');
      console.log('2. Test your application functionality');
      console.log('3. Run cleanup script to remove old collections');
      console.log(`\nTo cleanup: node migrateToUnifiedCollections.js cleanup ${businessId}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}