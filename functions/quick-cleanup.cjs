// Quick cleanup script
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function cleanupExtraCollections() {
  const businessId = "biz_srcomponents";
  const extraCollections = ['employee_monthly_summary', 'employee_timesheets'];
  
  console.log(`Cleaning up extra collections from ${businessId}`);
  
  for (const collectionName of extraCollections) {
    try {
      const collectionRef = db.collection('businesses').doc(businessId).collection(collectionName);
      const snapshot = await collectionRef.get();
      
      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`🗑️ Deleted ${snapshot.size} docs from ${collectionName}`);
      } else {
        console.log(`📭 ${collectionName} is already empty`);
      }
    } catch (error) {
      console.error(`Error cleaning ${collectionName}:`, error.message);
    }
  }
  
  console.log("✅ Cleanup completed");
}

cleanupExtraCollections().then(() => process.exit(0)).catch(console.error);