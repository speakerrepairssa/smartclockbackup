const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function checkAttendance() {
  const snapshot = await db.collection('businesses').doc('biz_machine_2')
    .collection('attendance_events').limit(3).get();
  
  console.log(`\nFound ${snapshot.size} attendance events`);
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log('\nEvent:', doc.id);
    console.log('  employeeId:', data.employeeId);
    console.log('  timestamp:', data.timestamp);
    console.log('  status:', data.attendanceStatus);
  });
  process.exit(0);
}

checkAttendance().catch(console.error);
