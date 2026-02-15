const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

async function checkData() {
  const businessId = 'biz_speaker_repairs';
  const month = '2026-02';
  
  console.log('\n📊 Checking attendance events for', businessId, month);
  
  // Check attendance events
  const attendanceSnap = await db.collection('businesses').doc(businessId)
    .collection('attendance_events')
    .where('timestamp', '>=', month + '-01')
    .where('timestamp', '<=', month + '-28')
    .get();
  
  console.log('\n  📅 Total attendance events:', attendanceSnap.size);
  
  if (attendanceSnap.size > 0) {
    // Check for testMode events
    let testModeCount = 0;
    let pendingCount = 0;
    let clockInCount = 0;
    let clockOutCount = 0;
    
    attendanceSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.testMode) testModeCount++;
      if (data.status === 'pending' && !data.resolvedManually) pendingCount++;
      if (data.type === 'clock-in') clockInCount++;
      if (data.type === 'clock-out') clockOutCount++;
    });
    
    console.log('    - Test mode events:', testModeCount);
    console.log('    - Pending unresolved:', pendingCount);
    console.log('    - Clock-in events:', clockInCount);
    console.log('    - Clock-out events:', clockOutCount);
    console.log('    - Valid events:', attendanceSnap.size - testModeCount - pendingCount);
    
    // Show first few events
    console.log('\n  📝 Sample events:');
    attendanceSnap.docs.slice(0, 3).forEach(doc => {
      const data = doc.data();
      console.log('    -', {
        employeeId: data.employeeId,
        timestamp: data.timestamp,
        type: data.type,
        status: data.status,
        testMode: data.testMode || false
      });
    });
  }
  
  // Check staff
  const staffSnap = await db.collection('businesses').doc(businessId)
    .collection('staff').get();
  
  console.log('\n  👥 Total staff:', staffSnap.size);
  
  // Check cache
  const cacheDoc = await db.collection('businesses').doc(businessId)
    .collection('assessment_cache').doc(month).get();
  
  if (cacheDoc.exists()) {
    const cache = cacheDoc.data();
    console.log('\n  💾 Cache exists');
    console.log('    - Employees in cache:', cache.employees?.length || 0);
    console.log('    - Last updated:', cache.lastUpdated);
    
    if (cache.employees && cache.employees.length > 0) {
      console.log('\n  👤 Sample employees from cache:');
      cache.employees.slice(0, 3).forEach(emp => {
        console.log('    -', {
          name: emp.employeeName,
          currentHours: emp.currentHours,
          requiredHours: emp.requiredHours,
          hoursShort: emp.hoursShort
        });
      });
    }
  } else {
    console.log('\n  ❌ No cache found');
  }
  
  process.exit(0);
}

checkData().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
