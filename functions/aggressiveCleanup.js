const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.aggressiveCleanup = onRequest(async (req, res) => {
  try {
    const { businessId, confirm } = req.query;
    
    if (!businessId || confirm !== 'true') {
      return res.status(400).json({ error: 'Missing businessId or confirm=true' });
    }

    const businessRef = db.collection('businesses').doc(businessId);
    const deletedItems = [];
    
    const collectionsToRemove = [
      'employee_timesheets', 'employee_last_attendance', 'employee_last_checkout',
      'employee_last_clockin', 'timecards', 'employees', 'schedules', 
      'employee_monthly_summary'
    ];
    
    const allCollections = await businessRef.listCollections();
    const deviceCollections = allCollections.filter(col => 
      col.id.startsWith('device_') && col.id.endsWith('_events')
    );
    collectionsToRemove.push(...deviceCollections.map(col => col.id));
    
    for (const collectionName of collectionsToRemove) {
      try {
        const collectionRef = businessRef.collection(collectionName);
        const docs = await collectionRef.get();
        
        if (docs.size > 0) {
          const batch = db.batch();
          docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          deletedItems.push(`${collectionName} (${docs.size})`);
        }
      } catch (e) {
        // Continue if collection doesn't exist
      }
    }
    
    // Also clean structure docs from remaining collections
    try {
      const attendanceRef = businessRef.collection('attendance_events');
      const attendanceDocs = await attendanceRef.get();
      
      const batch = db.batch();
      let structureDocsRemoved = 0;
      
      attendanceDocs.forEach(doc => {
        const data = doc.data();
        if (doc.id === '_structure' || !data.timestamp) {
          batch.delete(doc.ref);
          structureDocsRemoved++;
        }
      });
      
      if (structureDocsRemoved > 0) {
        await batch.commit();
        deletedItems.push(`structure docs (${structureDocsRemoved})`);
      }
    } catch (e) {}
    
    res.json({
      success: true,
      message: 'Aggressive cleanup completed',
      deletedItems
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});