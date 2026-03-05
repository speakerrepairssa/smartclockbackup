/**
 * Historical Device Import
 * Fetches ALL events from Hikvision FC4349999 and writes them into
 * smartclock-v2-8271f Firestore under:
 *   businesses/biz_speaker_repairs_sa/attendance_events/{YYYY-MM-DD}/{slot}/{autoId}
 * Also updates status/{slot} for each employee.
 */

const https = require('https');
const http  = require('http');
const { execSync } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────
const DEVICE_IP   = '192.168.0.114';
const DEVICE_USER = 'admin';
const DEVICE_PASS = 'Azam198419880001';
const PROJECT     = 'smartclock-v2-8271f';
const BUSINESS_ID = 'biz_speaker_repairs_sa';
const START_DATE  = '2020-01-01T00:00:00';          // pull everything
const END_DATE    = new Date().toISOString().replace(/\.\d{3}Z$/, '');  // now

// ── Digest auth helper ────────────────────────────────────────────────────────
const crypto = require('crypto');
function md5(s) { return crypto.createHash('md5').update(s).digest('hex'); }

// Cached digest challenge (realm/nonce) from device — reuse across calls
let _digestChallenge = null;

function getDigestChallenge() {
  return new Promise((resolve, reject) => {
    if (_digestChallenge) return resolve(_digestChallenge);
    // Send a plain GET to trigger 401 and capture the WWW-Authenticate header
    const options = {
      hostname: DEVICE_IP,
      port: 443,
      path: '/ISAPI/AccessControl/AcsEvent?format=json',
      method: 'GET',
      rejectUnauthorized: false,
      headers: {}
    };
    const req = https.request(options, (res) => {
      res.resume(); // drain body
      if (res.statusCode === 401) {
        const wwwAuth = res.headers['www-authenticate'] || '';
        const realm = (wwwAuth.match(/realm="([^"]+)"/) || [])[1];
        const nonce = (wwwAuth.match(/nonce="([^"]+)"/) || [])[1];
        if (!realm || !nonce) return reject(new Error('No digest challenge from device'));
        _digestChallenge = { realm, nonce };
        resolve(_digestChallenge);
      } else {
        reject(new Error(`Expected 401, got ${res.statusCode}`));
      }
    });
    req.on('error', reject);
    req.end();
  });
}

async function digestRequest(devicePath, body) {
  const { realm, nonce } = await getDigestChallenge();
  const ha1  = md5(`${DEVICE_USER}:${realm}:${DEVICE_PASS}`);
  const ha2  = md5(`POST:${devicePath}`);
  const resp = md5(`${ha1}:${nonce}:${ha2}`);
  const auth = `Digest username="${DEVICE_USER}", realm="${realm}", nonce="${nonce}", uri="${devicePath}", response="${resp}"`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: DEVICE_IP,
      port: 443,
      path: devicePath,
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 401) {
          // Nonce stale — clear cache and reject (caller can retry)
          _digestChallenge = null;
          return reject(new Error('Digest 401 — nonce stale, retry'));
        }
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Bad JSON: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Firestore REST helper ─────────────────────────────────────────────────────
let ACCESS_TOKEN = null;
function getToken() {
  if (!ACCESS_TOKEN) {
    ACCESS_TOKEN = execSync('gcloud auth print-access-token').toString().trim();
  }
  return ACCESS_TOKEN;
}

function firestoreRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
      method,
      headers: {
        'Authorization': 'Bearer ' + getToken(),
        'Content-Type': 'application/json',
      }
    };
    if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({}); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Build Firestore value object
function fv(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  return { stringValue: String(val) };
}

// Check existence of multiple doc paths in parallel (batch of N)
async function checkExistingDocs(docPaths, batchSize = 20) {
  const existing = new Set();
  for (let i = 0; i < docPaths.length; i += batchSize) {
    const batch = docPaths.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(p => firestoreRequest('GET', p).then(r => ({ p, exists: !!(r && r.fields) })))
    );
    for (const { p, exists } of results) {
      if (exists) existing.add(p);
    }
    process.stdout.write(`\r   Checked ${Math.min(i + batchSize, docPaths.length)}/${docPaths.length} in Firestore...`);
  }
  return existing;
}

// Write a document (PATCH = create or update)
function writeDoc(docPath, fields) {
  const body = { fields: {} };
  for (const [k, v] of Object.entries(fields)) {
    body.fields[k] = fv(v);
  }
  return firestoreRequest('PATCH', docPath, body);
}

// ── Step 1: Load staff from Firestore ────────────────────────────────────────
async function loadStaff() {
  console.log('📋 Loading staff from Firestore...');
  const res = await firestoreRequest('GET', `businesses/${BUSINESS_ID}/staff?pageSize=50`);
  const staff = {}; // slot -> { name }
  if (res.documents) {
    for (const doc of res.documents) {
      const slot = doc.name.split('/').pop();
      const name = doc.fields?.employeeName?.stringValue || `Employee ${slot}`;
      staff[slot] = name;
    }
  }
  console.log(`   Found ${Object.keys(staff).length} staff slots:`, staff);
  return staff;
}

// ── Step 2: Fetch all events from device ─────────────────────────────────────
async function fetchAllDeviceEvents() {
  const apiPath = '/ISAPI/AccessControl/AcsEvent?format=json';
  const allEvents = [];
  let pos = 0;
  let total = null;

  console.log('\n📡 Fetching events from device...');
  console.log(`   Date range: ${START_DATE} → ${END_DATE}`);

  while (true) {
    const body = JSON.stringify({
      AcsEventCond: {
        searchID: 'full_import',
        searchResultPosition: pos,
        maxResults: 50,
        major: 5,
        minor: 75,
        startTime: START_DATE,
        endTime: END_DATE
      }
    });

    let d;
    try {
      d = await digestRequest(apiPath, body);
    } catch (err) {
      console.error('   Device request error:', err.message);
      break;
    }

    const evts = d?.AcsEvent || {};
    if (total === null) {
      total = evts.totalMatches || 0;
      console.log(`   Total events on device: ${total}`);
    }

    const batch = evts.InfoList || [];
    allEvents.push(...batch);
    pos += batch.length;
    process.stdout.write(`\r   Fetched ${pos}/${total}...`);

    if (batch.length === 0 || pos >= total) break;
  }

  console.log(`\n✅ Fetched ${allEvents.length} events from device`);
  return allEvents;
}

// ── Step 3: Import events into Firestore ─────────────────────────────────────
async function importEvents(events, staff) {
  console.log('\n� Pass 1: Parsing device events...');

  const parsed = [];
  let invalidCount = 0;

  for (const evt of events) {
    const slot = String(evt.employeeNoString || evt.verifyNo || '');
    if (!slot || isNaN(slot)) { invalidCount++; continue; }

    const slotNum  = parseInt(slot);
    const empName  = evt.name || staff[slot] || `Employee ${slot}`;
    const rawTime  = evt.time || evt.dateTime;
    if (!rawTime) { invalidCount++; continue; }

    const ts = new Date(rawTime);
    if (isNaN(ts.getTime())) { invalidCount++; continue; }

    const isoTs   = ts.toISOString();
    const dateStr = isoTs.split('T')[0];
    const timeStr = ts.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const rawStatus = String(evt.attendanceStatus || '').toLowerCase();
    const isIn  = rawStatus === 'checkin'  || rawStatus === '1' || rawStatus === 'in';
    const isOut = rawStatus === 'checkout' || rawStatus === '2' || rawStatus === 'out';
    if (!isIn && !isOut) { invalidCount++; continue; }

    const statusStr = isIn ? 'in' : 'out';
    const serialNo  = evt.serialNo || evt.frontSerialNo || null;
    const docId     = serialNo ? `dev_${serialNo}` : `dev_${ts.getTime()}_${slot}`;
    const docPath   = `businesses/${BUSINESS_ID}/attendance_events/${dateStr}/${slotNum}/${docId}`;

    parsed.push({ docPath, slotNum, slot, empName, isoTs, dateStr, timeStr, statusStr, serialNo });
  }

  console.log(`   Valid events: ${parsed.length} | Invalid/skipped: ${invalidCount}`);

  // ── Pass 2: Batch-check Firestore for existing docs ────────────────────────
  console.log('\n📥 Pass 2: Fetching existing doc IDs from Firestore...');
  const allDocPaths = parsed.map(e => e.docPath);
  const existingSet = await checkExistingDocs(allDocPaths);
  const toWrite = parsed.filter(e => !existingSet.has(e.docPath));
  console.log(`\n   Already in Firestore: ${existingSet.size} | New to write: ${toWrite.length}`);

  if (toWrite.length === 0) {
    console.log('\n✅ All events already in Firestore — nothing to write.');
  } else {
    // ── Pass 3: Write only missing docs ───────────────────────────────────────
    console.log('\n🔥 Pass 3: Writing new events to Firestore...');
    let written = 0;
    let errors  = 0;

    for (const e of toWrite) {
      try {
        await writeDoc(e.docPath, {
          employeeId:       e.slot,
          employeeName:     e.empName,
          slotNumber:       e.slotNum,
          time:             e.timeStr,
          timestamp:        e.isoTs,
          type:             e.statusStr === 'in' ? 'clock-in' : 'clock-out',
          attendanceStatus: e.statusStr,
          deviceId:         'FC4349999',
          serialNo:         e.serialNo,
          recordedAt:       new Date().toISOString(),
          isDuplicatePunch: false,
          isManual:         false,
          source:           'historical-import'
        });
        written++;
        if (written % 20 === 0) process.stdout.write(`\r   Written ${written}/${toWrite.length}...`);
      } catch (err) {
        errors++;
        if (errors <= 5) console.error('\n   Write error:', err.message);
      }
    }
    console.log(`\n✅ Done. Written: ${written} | Errors: ${errors}`);
  }

  // ── Build lastStatus from ALL parsed events (not just new ones) ────────────
  const lastStatus = {};
  for (const e of parsed) {
    if (!lastStatus[e.slot] || new Date(e.isoTs) > new Date(lastStatus[e.slot].ts)) {
      lastStatus[e.slot] = { ts: e.isoTs, status: e.statusStr, name: e.empName };
    }
  }

  // ── Update status collection ───────────────────────────────────────────────
  console.log('\n📊 Updating status collection...');
  for (const [slot, info] of Object.entries(lastStatus)) {
    const empName = staff[slot] || info.name || `Employee ${slot}`;
    await writeDoc(`businesses/${BUSINESS_ID}/status/${slot}`, {
      employeeId:       slot,
      employeeName:     empName,
      badgeNumber:      slot,
      attendanceStatus: info.status,
      lastClockTime:    info.ts,
      lastClockStatus:  info.status,
      lastEventType:    info.status === 'in' ? 'checkin' : 'checkout',
      deviceId:         'FC4349999',
      slot:             parseInt(slot),
      active:           true,
      updatedAt:        new Date().toISOString()
    });
    console.log(`   Slot ${slot} (${empName}): ${info.status} @ ${info.ts}`);
  }

  // ── Update staff names from device ────────────────────────────────────────
  console.log('\n👥 Updating staff names from device events...');
  for (const [slot, info] of Object.entries(lastStatus)) {
    if (info.name && info.name !== `Employee ${slot}` && staff[slot] === `Employee ${slot}`) {
      await writeDoc(`businesses/${BUSINESS_ID}/staff/${slot}`, {
        employeeId:   slot,
        employeeName: info.name,
        badgeNumber:  slot,
        slot:         parseInt(slot),
        active:       true,
        updatedAt:    new Date().toISOString()
      });
      console.log(`   Updated slot ${slot}: "Employee ${slot}" → "${info.name}"`);
    }
  }

  console.log('\n🎉 Historical import complete!');
  console.log(`   Check: https://smartclock-v2-8271f.web.app/pages/business-dashboard.html`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Smart Clock v2 — Historical Device Import');
  console.log(`   Device:   ${DEVICE_IP} (FC4349999)`);
  console.log(`   Project:  ${PROJECT}`);
  console.log(`   Business: ${BUSINESS_ID}`);
  console.log('');

  const staff  = await loadStaff();
  const events = await fetchAllDeviceEvents();

  if (events.length === 0) {
    console.log('❌ No events fetched from device. Aborting.');
    process.exit(1);
  }

  await importEvents(events, staff);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
