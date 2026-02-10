const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkStaffData() {
  console.log('📊 CHECKING STAFF DATA');
  console.log('=====================');
  
  const businesses = ['biz_machine_2', 'biz_srcomponents'];
  
  for (const bizId of businesses) {
    console.log(`\n🏢 ${bizId.toUpperCase()}`);
    console.log('-------------------');
    
    try {
      const staffCollection = await db.collection('businesses').doc(bizId).collection('staff').get();
      
      if (staffCollection.empty) {
        console.log('No staff data found');
        continue;
      }
      
      console.log(`Found ${staffCollection.size} staff records:`);
      
      staffCollection.forEach(doc => {
        const data = doc.data();
        const slotId = doc.id;
        const employeeName = data.employeeName || data.name || 'NO NAME';
        const employeeId = data.employeeId || 'NO ID';
        const isActive = data.isActive !== false;
        
        console.log(`  Slot ${slotId}: ID=${employeeId}, Name="${employeeName}", Active=${isActive}`);
      });
      
      // Also check status to see what names are being used there
      console.log('\n📋 STATUS COLLECTION:');
      const statusCollection = await db.collection('businesses').doc(bizId).collection('status').get();
      
      statusCollection.forEach(doc => {
        const data = doc.data();
        const slot = doc.id;
        const empName = data.employeeName || 'NO NAME';
        const empId = data.employeeId || 'NO ID';
        const status = data.attendanceStatus || 'unknown';
        
        console.log(`  Slot ${slot}: ID=${empId}, Name="${empName}", Status=${status}`);
      });
      
    } catch (error) {
      console.log('Error:', error.message);
    }
  }
}

checkStaffData().then(() => {
  process.exit(0);
}).catch(console.error);