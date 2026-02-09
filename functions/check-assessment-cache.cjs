const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function checkAssessmentCache() {
  try {
    const businessId = 'biz_machine_2';
    const month = '2026-02';

    console.log(`\n📊 Checking assessment cache for ${businessId}, month: ${month}\n`);

    const cacheRef = db.collection('businesses').doc(businessId)
      .collection('assessment_cache').doc(month);

    const cacheSnap = await cacheRef.get();

    if (!cacheSnap.exists) {
      console.log('❌ No cache found for this month');
      process.exit(0);
    }

    const cacheData = cacheSnap.data();

    console.log('✅ Cache found!');
    console.log('━'.repeat(60));
    console.log('\n📋 SUMMARY:');
    if (cacheData.summary) {
      console.log('  Total Employees:', cacheData.summary.totalEmployees);
      console.log('  Total Hours Worked:', cacheData.summary.totalHoursWorked);
      console.log('  Total Amount Due:', cacheData.summary.totalAmountDue);
      console.log('  Last Updated:', cacheData.lastUpdated);
    }

    console.log('\n👥 EMPLOYEES:');
    if (cacheData.employees && cacheData.employees.length > 0) {
      console.log(`  Found ${cacheData.employees.length} employees\n`);

      cacheData.employees.slice(0, 5).forEach((emp, idx) => {
        console.log(`  ${idx + 1}. ${emp.employeeName || 'Unknown'}`);
        console.log(`     Current Hours: ${emp.currentHours || 0}h`);
        console.log(`     Required Hours: ${emp.requiredHours || 0}h`);
        console.log(`     Pay Rate: R${emp.payRate || 0}`);
        console.log(`     Amount Due: R${emp.currentIncomeDue || 0}`);
        console.log(`     Status: ${emp.status || 'Unknown'}`);
        console.log('');
      });

      if (cacheData.employees.length > 5) {
        console.log(`  ... and ${cacheData.employees.length - 5} more employees`);
      }
    } else {
      console.log('  ⚠️  No employees in cache!');
    }

    console.log('━'.repeat(60));

  } catch (error) {
    console.error('❌ Error checking cache:', error);
  }

  process.exit(0);
}

checkAssessmentCache().catch(console.error);
