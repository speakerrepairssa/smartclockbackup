const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function syncDeviceStaffToFirebase(businessId, deviceId = 'admin') {
  console.log(`🔄 Syncing staff from device ${deviceId} to Firebase for business ${businessId}`);
  
  try {
    const businessRef = db.collection('businesses').doc(businessId);
    
    // Create staff entries for missing slots
    // This is a manual sync - you'll need to provide the staff data
    const staffSlots = [
      { slot: 1, employeeName: 'azam', employeeId: '1' },
      { slot: 2, employeeName: 'roshana', employeeId: '2' },
      { slot: 3, employeeName: 'ashley raubenheimer', employeeId: '3' },
      { slot: 4, employeeName: 'dinnel moodley', employeeId: '4' },
      { slot: 5, employeeName: 'abdullah', employeeId: '5' },
      { slot: 6, employeeName: 'isaac', employeeId: '6' },
      { slot: 7, employeeName: 'EMPLOYEE_NAME_SLOT_7', employeeId: '7' }, // YOU NEED TO UPDATE THIS
      // Add more slots as needed
    ];
    
    console.log('Current staff configuration to sync:');
    staffSlots.forEach(staff => {
      console.log(`  Slot ${staff.slot}: ${staff.employeeName}`);
    });
    
    // Sync to staff collection
    const staffRef = businessRef.collection('staff');
    
    for (const staff of staffSlots) {
      const staffDocRef = staffRef.doc(staff.employeeId);
      
      const staffData = {
        employeeName: staff.employeeName,
        employeeId: staff.employeeId,
        slot: staff.slot,
        deviceId: deviceId,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await staffDocRef.set(staffData, { merge: true });
      console.log(`✅ Synced slot ${staff.slot}: ${staff.employeeName}`);
    }
    
    // Also sync to status collection to ensure they appear in monitoring
    const statusRef = businessRef.collection('status');
    
    for (const staff of staffSlots) {
      const statusDocRef = statusRef.doc(staff.employeeId);
      
      const statusData = {
        employeeName: staff.employeeName,
        employeeId: staff.employeeId,
        slot: staff.slot,
        attendanceStatus: 'out', // Default to out
        lastEventTime: null,
        lastClockTime: null, // Will be set when they first punch
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await statusDocRef.set(statusData, { merge: true });
      console.log(`✅ Created status entry for slot ${staff.slot}: ${staff.employeeName}`);
    }
    
    console.log('\n🎉 Staff sync completed successfully!');
    console.log('📝 Next steps:');
    console.log('1. Update EMPLOYEE_NAME_SLOT_7 with the actual name');
    console.log('2. Run the sync again');
    console.log('3. Check the app - Slot 7 should now show the correct name');
    
  } catch (error) {
    console.error('❌ Error syncing staff:', error);
    throw error;
  }
}

// Function to check current Firebase data
async function checkFirebaseStaffData(businessId) {
  console.log(`🔍 Checking current Firebase staff data for business ${businessId}`);
  
  try {
    const businessRef = db.collection('businesses').doc(businessId);
    
    // Check staff collection
    console.log('\n📋 STAFF COLLECTION:');
    const staffRef = businessRef.collection('staff');
    const staffSnap = await staffRef.get();
    
    if (staffSnap.empty) {
      console.log('  ⚠️  No staff documents found');
    } else {
      staffSnap.forEach(doc => {
        const staff = doc.data();
        console.log(`  Slot ${staff.slot || 'N/A'}: ${staff.employeeName || 'Unknown'} (ID: ${doc.id})`);
      });
    }
    
    // Check status collection
    console.log('\n📊 STATUS COLLECTION:');
    const statusRef = businessRef.collection('status');
    const statusSnap = await statusRef.get();
    
    if (statusSnap.empty) {
      console.log('  ⚠️  No status documents found');
    } else {
      statusSnap.forEach(doc => {
        const status = doc.data();
        console.log(`  Slot ${status.slot || 'N/A'}: ${status.employeeName || 'Unknown'} (ID: ${doc.id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking Firebase data:', error);
  }
}

// Export functions
exports.syncDeviceStaffToFirebase = syncDeviceStaffToFirebase;
exports.checkFirebaseStaffData = checkFirebaseStaffData;

// For direct execution
if (require.main === module) {
  const businessId = process.argv[2] || 'biz_machine_2'; // Default to machine 2
  const action = process.argv[3] || 'check'; // check or sync
  
  if (action === 'sync') {
    syncDeviceStaffToFirebase(businessId)
      .then(() => {
        console.log('✨ Sync completed');
        process.exit(0);
      })
      .catch(error => {
        console.error('💥 Sync failed:', error);
        process.exit(1);
      });
  } else {
    checkFirebaseStaffData(businessId)
      .then(() => {
        console.log('\n✨ Check completed');
        console.log('\n💡 To sync staff data, run: node syncStaff.js', businessId, 'sync');
        process.exit(0);
      })
      .catch(error => {
        console.error('💥 Check failed:', error);
        process.exit(1);
      });
  }
}