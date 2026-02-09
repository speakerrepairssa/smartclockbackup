/**
 * RESTORE EMPLOYEE STATUS FOR SR COMPONENTS
 * Fixes employees with invalid/missing lastClockTime data
 * Sets them as clocked out with a valid timestamp
 */

const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function restoreEmployeeStatus() {
  try {
    const businessId = 'cF9egD36y6dXX2X14bsA'; // SR Components

    console.log('🔧 Restoring employee status for SR Components...\n');

    // Get all staff members
    const staffRef = db.collection('businesses').doc(businessId).collection('staff');
    const staffSnap = await staffRef.get();

    if (staffSnap.empty) {
      console.log('❌ No staff members found');
      return;
    }

    console.log(`📋 Found ${staffSnap.size} staff members\n`);

    // Get existing status collection
    const statusRef = db.collection('businesses').doc(businessId).collection('employee_status');
    const statusSnap = await statusRef.get();

    const existingStatus = new Map();
    statusSnap.forEach(doc => {
      existingStatus.set(doc.id, doc.data());
    });

    let restoredCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each employee
    for (const staffDoc of staffSnap.docs) {
      const employeeId = staffDoc.id;
      const staff = staffDoc.data();
      const employeeName = staff.employeeName || staff.name || `Employee ${employeeId}`;

      // Skip auto-named empty slots
      if (employeeName.match(/^Employee \d+$/)) {
        console.log(`⏭️  Skipping empty slot: ${employeeName}`);
        skippedCount++;
        continue;
      }

      const existingStatusData = existingStatus.get(employeeId);

      // Check if status needs fixing
      const needsFix = !existingStatusData ||
                       !existingStatusData.lastClockTime ||
                       existingStatusData.lastClockTime === 'Invalid Date' ||
                       (typeof existingStatusData.lastClockTime === 'string' &&
                        isNaN(new Date(existingStatusData.lastClockTime).getTime()));

      if (!needsFix) {
        console.log(`✅ ${employeeName} - Status OK`);
        continue;
      }

      try {
        // Create/update status with valid data
        const statusData = {
          employeeId: employeeId,
          employeeName: employeeName,
          businessId: businessId,
          attendanceStatus: 'out',
          lastClockTime: admin.firestore.Timestamp.now(), // Current timestamp
          slot: staff.slot || parseInt(employeeId) || 0,
          active: staff.active !== false,
          updatedAt: new Date().toISOString(),
          restoredBy: 'restore-employee-status.cjs',
          restoredAt: new Date().toISOString()
        };

        await statusRef.doc(employeeId).set(statusData, { merge: true });

        console.log(`✅ ${employeeName} - Status restored (clocked out)`);
        restoredCount++;

      } catch (error) {
        console.error(`❌ Failed to restore ${employeeName}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESTORATION SUMMARY:');
    console.log(`   ✅ Restored: ${restoredCount} employees`);
    console.log(`   ⏭️  Skipped: ${skippedCount} employees (empty slots)`);
    console.log(`   ❌ Errors: ${errorCount} employees`);
    console.log('='.repeat(60));

    if (restoredCount > 0) {
      console.log('\n✅ Employee status restoration complete!');
      console.log('   All employees are now clocked out with valid timestamps.');
      console.log('   They will appear correctly in the dashboard.');
    }

  } catch (error) {
    console.error('❌ Restoration failed:', error);
  }

  process.exit(0);
}

// Run the restoration
restoreEmployeeStatus();
