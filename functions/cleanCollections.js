const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Clean all collections and recreate with proper slot-based structure
 */
const cleanAndRecreateCollections = onRequest(async (req, res) => {
  try {
    console.log("🧹 Starting collection cleanup...");

    // Get businessId from query parameter or body
    const businessId = req.query.businessId || req.body?.businessId || 'biz_srcomponents';
    
    if (!businessId) {
      return res.status(400).json({
        error: 'businessId is required',
        usage: 'Add ?businessId=your_business_id to the URL or include in request body'
      });
    }
    
    console.log(`🎯 Cleaning collections for business: ${businessId}`);
    
    // Collections to clean
    const collectionsToClean = [
      'attendance_events',
      'employee_last_attendance', 
      'employee_timesheets',
      'status'
    ];

    // 1. Delete all documents in problematic collections
    for (const collectionName of collectionsToClean) {
      const collectionRef = db.collection('businesses').doc(businessId).collection(collectionName);
      
      if (collectionName === 'attendance_events') {
        // For attendance_events, need to delete date documents and their subcollections
        const dateSnapshot = await collectionRef.get();
        console.log(`🗑️ Cleaning ${collectionName}: ${dateSnapshot.size} date documents`);
        
        for (const dateDoc of dateSnapshot.docs) {
          // Delete all slot collections within this date
          const slotCollections = await dateDoc.ref.listCollections();
          for (const slotCollection of slotCollections) {
            const slotSnapshot = await slotCollection.get();
            const slotBatch = db.batch();
            slotSnapshot.docs.forEach(doc => {
              slotBatch.delete(doc.ref);
            });
            if (slotSnapshot.size > 0) {
              await slotBatch.commit();
            }
          }
          // Delete the date document itself
          await dateDoc.ref.delete();
        }
      } else {
        // Regular collection cleanup
        const snapshot = await collectionRef.get();
        console.log(`🗑️ Cleaning ${collectionName}: ${snapshot.size} documents`);
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        if (snapshot.size > 0) {
          await batch.commit();
        }
      }
      
      console.log(`✅ Cleaned ${collectionName}`);
    }

    // 2. Recreate status collection with proper slot structure
    console.log("📝 Recreating status collection...");
    const statusRef = db.collection('businesses').doc(businessId).collection('status');
    
    for (let slotId = 1; slotId <= 6; slotId++) {
      await statusRef.doc(slotId.toString()).set({
        employeeId: slotId.toString(),
        employeeName: `Employee ${slotId}`,
        currentStatus: 'out',
        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true,
        slotNumber: slotId
      });
    }

    // 3. Initialize employee_last_attendance with empty structure
    console.log("📝 Recreating employee_last_attendance collection...");
    const lastAttendanceRef = db.collection('businesses').doc(businessId).collection('employee_last_attendance');
    
    for (let slotId = 1; slotId <= 6; slotId++) {
      await lastAttendanceRef.doc(slotId.toString()).set({
        employeeId: slotId.toString(),
        employeeName: `Employee ${slotId}`,
        lastClockIn: null,
        lastClockOut: null,
        currentStatus: 'out',
        lastUpdate: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // 4. Update staff collection to ensure proper slot structure
    console.log("📝 Updating staff collection...");
    const staffRef = db.collection('businesses').doc(businessId).collection('staff');
    
    const staffData = {
      1: { employeeName: 'azam', badgeNumber: '1', isActive: true },
      2: { employeeName: 'omer', badgeNumber: '2', isActive: true },
      3: { employeeName: 'Employee 3', badgeNumber: '3', isActive: false },
      4: { employeeName: 'Employee 4', badgeNumber: '4', isActive: false },
      5: { employeeName: 'Employee 5', badgeNumber: '5', isActive: false },
      6: { employeeName: 'Employee 6', badgeNumber: '6', isActive: false }
    };

    for (const [slotId, data] of Object.entries(staffData)) {
      await staffRef.doc(slotId).set({
        employeeId: slotId,
        employeeName: data.employeeName,
        badgeNumber: data.badgeNumber,
        isActive: data.isActive,
        slotNumber: parseInt(slotId),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log("✅ Collections cleaned and recreated successfully!");

    res.status(200).json({
      success: true,
      message: 'Collections cleaned and recreated with proper slot structure',
      cleaned: collectionsToClean,
      slotsCreated: [1, 2, 3, 4, 5, 6]
    });

  } catch (error) {
    console.error("❌ Error cleaning collections:", error);
    res.status(500).json({
      error: 'Failed to clean collections',
      details: error.message
    });
  }
});

module.exports = { cleanAndRecreateCollections };