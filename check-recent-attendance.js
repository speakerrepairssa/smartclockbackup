const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkAttendance() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  console.log('🔍 Checking attendance for:', todayStr, 'and', yesterdayStr);
  
  const businesses = ['biz_machine_2', 'biz_srcomponents'];
  
  for (const biz of businesses) {
    console.log('\n📊', biz.toUpperCase());
    
    for (const date of [todayStr, yesterdayStr]) {
      console.log('\n📅 Date:', date);
      
      try {
        const eventsRef = db.collection('businesses').doc(biz).collection('attendance_events').doc(date);
        const snapshot = await eventsRef.get();
        
        if (snapshot.exists) {
          const data = snapshot.data();
          console.log('Events found:', Object.keys(data).length, 'employees');
          
          Object.entries(data).forEach(([empId, events]) => {
            console.log('  Employee', empId + ':', events.length, 'events');
            events.forEach((event, i) => {
              const time = new Date(event.timestamp).toLocaleTimeString();
              console.log('    ', i+1 + '.', time, '-', event.attendanceStatus.toUpperCase(), event.deviceId || 'unknown device');
            });
          });
        } else {
          console.log('No events found');
        }
      } catch (error) {
        console.log('Error:', error.message);
      }
    }
  }
}

checkAttendance().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(console.error);