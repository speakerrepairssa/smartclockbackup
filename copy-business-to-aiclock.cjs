// Copy business data from smartclock-v2-8271f to aiclock-82608
const admin = require('firebase-admin');

// Source: smartclock-v2-8271f
const srcSA = require('./functions/service-account-key.json');
const srcApp = admin.initializeApp({ credential: admin.credential.cert(srcSA) }, 'source');
const srcDb = srcApp.firestore();

// Destination: aiclock-82608
const dstSA = require('./aiclock-service-account-key.json');
const dstApp = admin.initializeApp({ credential: admin.credential.cert(dstSA) }, 'destination');
const dstDb = dstApp.firestore();

const BIZ_ID = 'biz_speaker_repairs_sa';

async function copyCollection(srcRef, dstRef, label) {
  const snap = await srcRef.get();
  console.log(`📋 ${label}: ${snap.size} documents`);
  for (const doc of snap.docs) {
    await dstRef.doc(doc.id).set(doc.data());
    console.log(`  ✅ ${doc.id}`);
  }
  return snap.size;
}

async function main() {
  try {
    // 1. Copy business document
    console.log('=== Copying business document ===');
    const bizSnap = await srcDb.collection('businesses').doc(BIZ_ID).get();
    if (!bizSnap.exists) {
      console.log('ERROR: Business not found in source');
      process.exit(1);
    }
    await dstDb.collection('businesses').doc(BIZ_ID).set(bizSnap.data());
    console.log('✅ Business document copied');
    console.log('   Email:', bizSnap.data().email);
    console.log('   Name:', bizSnap.data().businessName);

    // 2. Copy staff subcollection
    console.log('\n=== Copying staff ===');
    await copyCollection(
      srcDb.collection('businesses').doc(BIZ_ID).collection('staff'),
      dstDb.collection('businesses').doc(BIZ_ID).collection('staff'),
      'Staff'
    );

    // 3. Copy shifts subcollection
    console.log('\n=== Copying shifts ===');
    await copyCollection(
      srcDb.collection('businesses').doc(BIZ_ID).collection('shifts'),
      dstDb.collection('businesses').doc(BIZ_ID).collection('shifts'),
      'Shifts'
    );

    // 4. Copy attendance_events subcollection (top-level docs)
    console.log('\n=== Copying attendance_events ===');
    const attSnap = await srcDb.collection('businesses').doc(BIZ_ID).collection('attendance_events').get();
    console.log(`📋 Attendance events: ${attSnap.size} documents`);
    let count = 0;
    for (const doc of attSnap.docs) {
      await dstDb.collection('businesses').doc(BIZ_ID).collection('attendance_events').doc(doc.id).set(doc.data());
      count++;
      
      // Also copy sub-subcollections (nested date/employee structure)
      // Try to enumerate subcollections for each attendance_events doc
      const subCollections = await srcDb.collection('businesses').doc(BIZ_ID)
        .collection('attendance_events').doc(doc.id).listCollections();
      for (const subCol of subCollections) {
        const subSnap = await subCol.get();
        for (const subDoc of subSnap.docs) {
          await dstDb.collection('businesses').doc(BIZ_ID)
            .collection('attendance_events').doc(doc.id)
            .collection(subCol.id).doc(subDoc.id).set(subDoc.data());
          count++;
        }
      }
    }
    console.log(`✅ ${count} attendance documents copied (including nested)`);

    // 5. Copy assessment_cache subcollection
    console.log('\n=== Copying assessment_cache ===');
    await copyCollection(
      srcDb.collection('businesses').doc(BIZ_ID).collection('assessment_cache'),
      dstDb.collection('businesses').doc(BIZ_ID).collection('assessment_cache'),
      'Assessment Cache'
    );

    // 6. Copy device_map if exists
    console.log('\n=== Copying device_map ===');
    await copyCollection(
      srcDb.collection('businesses').doc(BIZ_ID).collection('device_map'),
      dstDb.collection('businesses').doc(BIZ_ID).collection('device_map'),
      'Device Map'
    );

    console.log('\n🎉 All business data copied successfully to aiclock-82608');
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

main();
