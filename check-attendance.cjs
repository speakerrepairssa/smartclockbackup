const admin = require('firebase-admin');
const serviceAccount = require('./aiclock-82608-firebase-adminsdk-e5yud-5fb0d65aa0.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAttendance() {
  const snapshot = await db.collection('businesses').doc('biz_machine_2')
    .collection('attendance_events').limit(5).get();
  
  console.log(`\nTotal attendance events found: ${snapshot.size}`);
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log('\nEvent:', {
      id: doc.id,
      employeeId: data.employeeId,
      timestamp: data.timestamp,
      status: data.attendanceStatus,
      employeeName: data.employeeName
    });
  });
  
  process.exit(0);
}

checkAttendance().catch(console.error);
