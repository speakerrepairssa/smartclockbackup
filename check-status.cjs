const https = require('https');
const { execSync } = require('child_process');

const project = 'smartclock-v2-8271f';
const biz = 'biz_speaker_repairs_sa';
const rawToken = execSync('gcloud auth print-access-token').toString().trim();

function fetchFirestore(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${project}/databases/(default)/documents/${path}`,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + rawToken }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== STATUS COLLECTION ===');
  const status = await fetchFirestore(`businesses/${biz}/status?pageSize=10`);
  if (status.documents) {
    status.documents.forEach(doc => {
      const f = doc.fields;
      const name = doc.name.split('/').pop();
      console.log(`Slot ${name}: ${f.employeeName?.stringValue} | ${f.attendanceStatus?.stringValue} | ${f.lastClockTime?.stringValue?.substring(0,19)}`);
    });
  } else {
    console.log(JSON.stringify(status).substring(0, 300));
  }

  console.log('\n=== ATTENDANCE_EVENTS (today) ===');
  const today = new Date().toISOString().split('T')[0];
  const events = await fetchFirestore(`businesses/${biz}/attendance_events/${today}/1?pageSize=5`);
  if (events.documents) {
    events.documents.forEach(doc => {
      const f = doc.fields;
      console.log(`  ${f.timestamp?.stringValue?.substring(0,19)} | ${f.type?.stringValue} | ${f.employeeName?.stringValue}`);
    });
  } else {
    console.log('Today:', JSON.stringify(events).substring(0, 300));
  }
}

main().catch(console.error);
