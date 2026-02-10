const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccount = require("./aiclock-82608-firebase-adminsdk-k6axj-e6a4b9e8b8.json");

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'aiclock-82608'
});

const db = getFirestore();

async function checkCurrentStatus() {
  console.log('📊 CURRENT ATTENDANCE STATUS');
  console.log('============================');
  
  const businesses = ['biz_machine_2', 'biz_srcomponents'];
  
  for (const bizId of businesses) {
    console.log(`\n🏢 ${bizId.toUpperCase()}`);
    console.log('-------------------');
    
    try {
      const statusCollection = await db.collection('businesses').doc(bizId).collection('status').get();
      
      if (statusCollection.empty) {
        console.log('No status data found');
        continue;
      }
      
      let clockedIn = [];
      let clockedOut = [];
      
      statusCollection.forEach(doc => {
        const data = doc.data();
        const slot = doc.id;
        const empName = data.employeeName || `Employee ${data.employeeId || 'Unknown'}`;
        const status = data.attendanceStatus || 'unknown';
        const lastUpdate = data.lastUpdate ? new Date(data.lastUpdate).toLocaleString() : 'Never';
        
        if (status === 'in') {
          clockedIn.push(`  Slot ${slot}: ${empName} (since ${lastUpdate})`);
        } else if (status === 'out') {
          clockedOut.push(`  Slot ${slot}: ${empName} (since ${lastUpdate})`);
        }
      });
      
      console.log('✅ CLOCKED IN:');
      if (clockedIn.length > 0) {
        clockedIn.forEach(info => console.log(info));
      } else {
        console.log('  No one currently clocked in');
      }
      
      console.log('\n❌ CLOCKED OUT:');
      if (clockedOut.length > 0) {
        clockedOut.forEach(info => console.log(info));
      } else {
        console.log('  No one currently clocked out');
      }
      
    } catch (error) {
      console.log('Error:', error.message);
    }
  }
}

checkCurrentStatus().then(() => {
  process.exit(0);
}).catch(console.error);