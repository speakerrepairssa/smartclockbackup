const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, orderBy, limit, getDocs, doc, getDoc } = require('firebase/firestore');

const app = initializeApp({
  apiKey: "AIzaSyBzkE6e8QAAh_v8DhcPZVTiSRZgKKUdbNQ",
  authDomain: "aiclock-82608.firebaseapp.com",
  projectId: "aiclock-82608"
});
const db = getFirestore(app);

async function check() {
  const deviceDoc = await getDoc(doc(db, 'businesses', 'biz_srcomponents', 'devices', 'ADMIN'));
  console.log('Device ADMIN exists:', deviceDoc.exists());
  if (deviceDoc.exists()) console.log('Device data:', JSON.stringify(deviceDoc.data(), null, 2));

  const eventsRef = collection(db, 'businesses', 'biz_srcomponents', 'attendance_events');
  const q = query(eventsRef, orderBy('timestamp', 'desc'), limit(5));
  const snap = await getDocs(q);
  console.log('\nRecent attendance events:', snap.size);
  snap.forEach(d => {
    const data = d.data();
    const ts = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp;
    console.log('  ' + d.id + ': ' + (data.employeeName || data.name) + ' - ' + data.attendanceStatus + ' - ' + ts);
  });

  const statusRef = collection(db, 'businesses', 'biz_srcomponents', 'status');
  const statusSnap = await getDocs(statusRef);
  console.log('\nStatus docs:', statusSnap.size);
  statusSnap.forEach(d => {
    const data = d.data();
    const ls = data.lastSeen && data.lastSeen.toDate ? data.lastSeen.toDate() : data.lastSeen;
    console.log('  ' + d.id + ': ' + (data.employeeName || data.name) + ' - ' + data.status + ' - lastSeen: ' + ls);
  });

  const devicesRef = collection(db, 'businesses', 'biz_srcomponents', 'devices');
  const devSnap = await getDocs(devicesRef);
  console.log('\nRegistered devices:', devSnap.size);
  devSnap.forEach(d => {
    const data = d.data();
    console.log('  DocID: ' + d.id + ' | deviceId: ' + (data.deviceId || 'N/A') + ' | IP: ' + (data.deviceIP || data.ipAddress || 'N/A') + ' | serial: ' + (data.serialNumber || 'N/A'));
  });

  process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
