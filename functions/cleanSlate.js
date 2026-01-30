const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function cleanAttendanceEvents() {
  console.log('🧹 Starting clean slate for attendance events...');
  
  try {
    // Get all businesses
    const businessesSnapshot = await db.collection('businesses').get();
    console.log(`Found ${businessesSnapshot.size} businesses to clean`);
    
    for (const businessDoc of businessesSnapshot.docs) {
      const businessId = businessDoc.id;
      const businessData = businessDoc.data();
      
      console.log(`\n🏢 Cleaning business: ${businessId} (${businessData.businessName || 'Unknown'})`);
      
      try {
        const attendanceEventsRef = db.collection('businesses').doc(businessId).collection('attendance_events');
        
        // Get all documents
        const allDocs = await attendanceEventsRef.get();
        console.log(`  Found ${allDocs.size} documents to delete`);
        
        if (allDocs.size === 0) {
          console.log('  ✅ Already clean');
          continue;
        }
        
        // Delete in batches
        const batchSize = 500;
        let deletedCount = 0;
        
        for (let i = 0; i < allDocs.docs.length; i += batchSize) {
          const batch = db.batch();
          const batchDocs = allDocs.docs.slice(i, i + batchSize);
          
          for (const doc of batchDocs) {
            // Check if it's a date document with subcollections
            const datePattern = /^\d{4}-\d{2}-\d{2}$/;
            if (datePattern.test(doc.id)) {
              console.log(`  🗂️ Deleting date document and subcollections: ${doc.id}`);
              
              // Delete subcollections first
              try {
                const subcollections = await doc.ref.listCollections();
                for (const subcoll of subcollections) {
                  const subDocs = await subcoll.get();
                  for (const subDoc of subDocs.docs) {
                    batch.delete(subDoc.ref);
                    deletedCount++;
                  }
                }
              } catch (error) {
                console.log(`    Error deleting subcollections: ${error.message}`);
              }
            }
            
            // Delete the document itself
            batch.delete(doc.ref);
            deletedCount++;
          }
          
          await batch.commit();
          console.log(`  ✅ Deleted batch of ${batchDocs.length} documents`);
        }
        
        console.log(`  ✅ Total deleted: ${deletedCount} documents`);
        
        // Create a fresh structure marker
        await attendanceEventsRef.doc('_structure').set({
          _created: admin.firestore.FieldValue.serverTimestamp(),
          _type: 'collection_marker',
          _note: 'Clean slate - ready for fresh punch data'
        });
        
        console.log('  ✅ Created fresh collection structure');
        
      } catch (error) {
        console.error(`  ❌ Error cleaning business ${businessId}:`, error);
      }
    }
    
    console.log('\n🎉 Clean slate complete! All businesses ready for fresh punch data.');
    console.log('\n📝 Next steps:');
    console.log('1. Have employees use their normal punch devices');
    console.log('2. Each punch will create clean, standardized data');
    console.log('3. Use the Punches module to view and manage the new data');
    
  } catch (error) {
    console.error('💥 Error during clean slate operation:', error);
    throw error;
  }
}

// Export for Cloud Function
exports.cleanAttendanceEvents = cleanAttendanceEvents;

// For direct execution
if (require.main === module) {
  cleanAttendanceEvents()
    .then(() => {
      console.log('✨ Clean slate completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Clean slate failed:', error);
      process.exit(1);
    });
}