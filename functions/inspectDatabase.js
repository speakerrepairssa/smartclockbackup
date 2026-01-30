const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');

// Initialize if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * 🔍 INSPECT DATABASE STATE
 * Shows current state of all collections for debugging
 */
exports.inspectDatabaseState = onRequest(async (req, res) => {
  try {
    const { businessId } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: businessId' 
      });
    }

    logger.info("🔍 Inspecting database state", { businessId });
    
    const businessRef = db.collection('businesses').doc(businessId);
    const report = {
      businessId,
      timestamp: new Date().toISOString(),
      collections: {}
    };

    // Get all collections for this business
    const allCollections = await businessRef.listCollections();
    
    for (const collection of allCollections) {
      const collectionName = collection.id;
      const docs = await collection.get();
      
      report.collections[collectionName] = {
        exists: true,
        documentCount: docs.size,
        sampleDocs: []
      };

      // Sample first 3 documents
      let count = 0;
      docs.forEach(doc => {
        if (count < 3) {
          const data = doc.data();
          report.collections[collectionName].sampleDocs.push({
            id: doc.id,
            timestamp: data.timestamp || data.lastUpdate || data.createdAt || 'no-timestamp',
            type: data.attendanceStatus || data.currentStatus || 'unknown'
          });
          count++;
        }
      });
    }

    // Check attendance_events specifically
    try {
      const attendanceEventsRef = businessRef.collection('attendance_events');
      const attendanceEventsDocs = await attendanceEventsRef.orderBy('timestamp', 'desc').limit(5).get();
      
      report.attendanceEventsDetails = {
        totalCount: attendanceEventsDocs.size,
        latestEvents: []
      };
      
      attendanceEventsDocs.forEach(doc => {
        const data = doc.data();
        report.attendanceEventsDetails.latestEvents.push({
          id: doc.id,
          slotNumber: data.slotNumber,
          employeeName: data.employeeName,
          attendanceStatus: data.attendanceStatus,
          timestamp: data.timestamp,
          source: data.source || 'unknown',
          eventDate: data.eventDate
        });
      });
    } catch (e) {
      report.attendanceEventsDetails = { error: e.message };
    }

    // Check if problematic collections still exist
    const oldCollectionNames = ['employee_timesheets', 'employee_last_attendance'];
    for (const oldName of oldCollectionNames) {
      if (!report.collections[oldName]) {
        report.collections[oldName] = { exists: false, status: 'PROPERLY_DELETED' };
      } else {
        report.collections[oldName].status = 'STILL_EXISTS_PROBLEM';
      }
    }

    // Check for device collections
    const deviceCollections = Object.keys(report.collections).filter(name => 
      name.startsWith('device_') && name.endsWith('_events')
    );
    
    report.deviceCollectionsStillPresent = deviceCollections;

    logger.info("Database inspection completed", { 
      collectionsFound: Object.keys(report.collections),
      attendanceEventsFound: report.attendanceEventsDetails?.totalCount || 0
    });

    res.json({
      success: true,
      summary: `Found ${Object.keys(report.collections).length} collections, ${report.attendanceEventsDetails?.totalCount || 0} attendance events`,
      report: report
    });

  } catch (error) {
    logger.error("❌ Inspection failed", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Inspection failed'
    });
  }
});