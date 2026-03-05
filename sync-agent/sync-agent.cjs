/**
 * SmartClock Connector  v1.0.0
 * ─────────────────────────────
 * Runs on the client's LAN machine (Windows/Mac/Linux).
 * • First run  → opens setup UI at http://localhost:7663
 * • After setup → background service that:
 *     - Syncs device events to Firestore every 5 minutes
 *     - Sends heartbeat to Firestore every 60 seconds
 *     - Responds to manual "Sync Now" requests from the dashboard instantly
 */

'use strict';

const https  = require('https');
const http   = require('http');
const os     = require('os');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ── Constants ────────────────────────────────────────────────────────────────
const CONFIG_FILE        = path.join(__dirname, 'connector-config.json');
const LOG_FILE           = path.join(__dirname, 'connector.log');
const FIREBASE_API_KEY   = 'AIzaSyC6capPBwQDzIyp73i4ML0m9UwqjcfJ_WE';
const FIREBASE_PROJECT   = 'smartclock-v2-8271f';
const AGENT_VERSION      = '1.0.0';
const SETUP_PORT         = 7663;
const SYNC_INTERVAL      = 5 * 60 * 1000;   // 5 minutes
const HEARTBEAT_INTERVAL = 60 * 1000;        // 60 seconds
const POLL_INTERVAL      = 30 * 1000;        // 30 seconds (sync request watcher)

// ── Logging ──────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
    // Keep log under 2MB
    const stat = fs.statSync(LOG_FILE);
    if (stat.size > 2 * 1024 * 1024) {
      const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n');
      fs.writeFileSync(LOG_FILE, lines.slice(-500).join('\n'));
    }
  } catch (_) {}
}

// ── Config ───────────────────────────────────────────────────────────────────
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (_) {}
  return null;
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// ── Firebase Anonymous Auth ───────────────────────────────────────────────────
let _authToken     = null;
let _refreshToken  = null;
let _tokenExpiry   = 0;

async function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u    = new URL(url);
    const opts = {
      hostname: u.hostname,
      port:     443,
      path:     u.pathname + u.search,
      method:   'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('Bad JSON: ' + raw.substring(0, 100))); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getAuthToken() {
  if (_authToken && Date.now() < _tokenExpiry - 60000) return _authToken;

  try {
    if (_refreshToken) {
      const r = await postJSON(
        `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
        { grant_type: 'refresh_token', refresh_token: _refreshToken }
      );
      _authToken    = r.id_token;
      _refreshToken = r.refresh_token;
      _tokenExpiry  = Date.now() + parseInt(r.expires_in) * 1000;
    } else {
      const r = await postJSON(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
        { returnSecureToken: true }
      );
      _authToken    = r.idToken;
      _refreshToken = r.refreshToken;
      _tokenExpiry  = Date.now() + parseInt(r.expiresIn) * 1000;
    }
  } catch (err) {
    log(`Auth token error: ${err.message}`);
  }
  return _authToken;
}

// ── Firestore REST ────────────────────────────────────────────────────────────
async function firestoreRequest(method, docPath, body) {
  const token = await getAuthToken();
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${docPath}`,
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (_) { resolve({}); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function firestoreQuery(collectionPath, fieldPath, op, value) {
  const token = await getAuthToken();
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collectionPath.split('/').pop() }],
        where: { fieldFilter: {
          field: { fieldPath },
          op,
          value: { stringValue: value }
        }}
      }
    });
    const parentPath = collectionPath.split('/').slice(0, -1).join('/');
    const opts = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents${parentPath ? '/' + parentPath : ''}:runQuery`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (_) { resolve([]); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// List documents in a collection — uses API key directly
function listDocs(collectionPath) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${collectionPath}?key=${FIREBASE_API_KEY}`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (_) { resolve({}); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Fetch a single doc by path — uses API key directly
function getDocByPath(docPath) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${docPath}?key=${FIREBASE_API_KEY}`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (_) { resolve(null); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Login-specific query: uses API key directly so Firestore rules can't block it
function loginQuery(email) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'businesses' }],
        where: { fieldFilter: {
          field: { fieldPath: 'email' },
          op: 'EQUAL',
          value: { stringValue: email }
        }}
      }
    });
    const opts = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (_) { resolve([]); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function fv(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  return { stringValue: String(val) };
}

async function writeDoc(docPath, fields) {
  const body = { fields: {} };
  for (const [k, v] of Object.entries(fields)) body.fields[k] = fv(v);
  return firestoreRequest('PATCH', docPath, body);
}

// Write using API key directly — used for heartbeat/status so it always works
function writeDocApiKey(docPath, fields) {
  const body = { fields: {} };
  for (const [k, v] of Object.entries(fields)) body.fields[k] = fv(v);
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${docPath}?key=${FIREBASE_API_KEY}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (_) { resolve({}); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function docExists(docPath) {
  const res = await firestoreRequest('GET', docPath);
  return !!(res && res.fields);
}

// ── Hikvision Device ──────────────────────────────────────────────────────────
function md5(s) { return crypto.createHash('md5').update(s).digest('hex'); }

let _digestChallenge = null;

function requestDeviceChallenge(ip, port) {
  port = port || 443;
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: ip, port,
      path: '/ISAPI/AccessControl/AcsEvent?format=json',
      method: 'GET', rejectUnauthorized: false,
      headers: {}, timeout: 3000
    };
    const req = (port === 443 ? https : http).request(opts, res => {
      res.resume();
      if (res.statusCode === 401) {
        const w = res.headers['www-authenticate'] || '';
        const realm = (w.match(/realm="([^"]+)"/) || [])[1];
        const nonce = (w.match(/nonce="([^"]+)"/) || [])[1];
        if (realm && nonce) resolve({ realm, nonce });
        else reject(new Error('No digest challenge'));
      } else {
        reject(new Error(`Expected 401, got ${res.statusCode}`));
      }
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function deviceRequest(ip, user, pass, body, port) {
  port = port || 443;
  if (!_digestChallenge) {
    _digestChallenge = await requestDeviceChallenge(ip, port);
  }
  const { realm, nonce } = _digestChallenge;
  const path = '/ISAPI/AccessControl/AcsEvent?format=json';
  const ha1   = md5(`${user}:${realm}:${pass}`);
  const ha2   = md5(`POST:${path}`);
  const resp  = md5(`${ha1}:${nonce}:${ha2}`);
  const auth  = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${path}", response="${resp}"`;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: ip, port, path,
      method: 'POST', rejectUnauthorized: false,
      headers: { 'Content-Type': 'application/json', 'Authorization': auth, 'Content-Length': Buffer.byteLength(data) },
      timeout: 10000
    };
    const req = (port === 443 ? https : http).request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        if (res.statusCode === 401) {
          _digestChallenge = null;
          return reject(new Error('Digest 401 — nonce stale'));
        }
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('Bad JSON from device')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

async function fetchAllDeviceEvents(ip, user, pass, port) {
  port = port || 443;
  const all = [];
  let pos = 0, total = null;
  const start = '2020-01-01T00:00:00';
  const end   = new Date().toISOString().replace(/\.\d{3}Z$/, '');

  while (true) {
    const d = await deviceRequest(ip, user, pass, {
      AcsEventCond: { searchID: 'connector_sync', searchResultPosition: pos, maxResults: 50, major: 5, minor: 75, startTime: start, endTime: end }
    }, port);
    const evts = d?.AcsEvent || {};
    if (total === null) total = evts.totalMatches || 0;
    const batch = evts.InfoList || [];
    all.push(...batch);
    pos += batch.length;
    if (batch.length === 0 || pos >= total) break;
  }
  return all;
}

// ── Device Discovery (LAN scan) ───────────────────────────────────────────────
function getLocalSubnet() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        return parts.slice(0, 3).join('.');
      }
    }
  }
  return '192.168.0';
}

function probeHikvision(ip) {
  // Try a port, resolve with device info if Hikvision responds (200 or 401 = device exists)
  function tryPort(port) {
    return new Promise(resolve => {
      const opts = {
        hostname: ip, port,
        path: '/ISAPI/System/deviceInfo', method: 'GET',
        rejectUnauthorized: false, timeout: 2500
      };
      const req = (port === 443 ? https : http).request(opts, res => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          // 401 = Hikvision answered (auth required — definitely the ISAPI endpoint)
          // 200 = answered with XML
          if (res.statusCode === 401 || res.statusCode === 200) {
            const serial = (raw.match(/<serialNumber>([^<]+)</) || [])[1] || '';
            const model  = (raw.match(/<model>([^<]+)</)        || [])[1] || 'Hikvision Device';
            resolve({ ip, port, serial, model });
          } else {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    });
  }

  // Try HTTPS (443) first, fall back to HTTP (80)
  return tryPort(443).then(r => r || tryPort(80));
}

async function scanNetwork(onProgress) {
  const subnet = getLocalSubnet();
  const found  = [];
  const total  = 254;
  let   done   = 0;
  const BATCH  = 20;

  for (let start = 1; start <= total; start += BATCH) {
    const batch = [];
    for (let i = start; i < start + BATCH && i <= total; i++) {
      batch.push(probeHikvision(`${subnet}.${i}`));
    }
    const results = await Promise.all(batch);
    for (const r of results) {
      if (r) found.push(r);
    }
    done += batch.length;
    if (onProgress) onProgress(Math.round((done / total) * 100), found);
  }
  return found;
}

// ── Sync Logic ────────────────────────────────────────────────────────────────
async function runSync(config, onStatus) {
  const { deviceIP, deviceUser, devicePass, devicePort, businessId } = config;
  const port = devicePort || 443;
  _digestChallenge = null; // reset per sync

  try {
    if (onStatus) onStatus('fetching');
    const events = await fetchAllDeviceEvents(deviceIP, deviceUser, devicePass, port);
    log(`Sync: fetched ${events.length} events from device`);

    // Parse valid events
    const parsed = [];
    for (const evt of events) {
      const slot = String(evt.employeeNoString || '');
      if (!slot || isNaN(slot)) continue;
      const slotNum = parseInt(slot);
      const rawTime = evt.time || evt.dateTime;
      if (!rawTime) continue;
      const ts = new Date(rawTime);
      if (isNaN(ts.getTime())) continue;
      const rawStatus = String(evt.attendanceStatus || '').toLowerCase();
      const isIn  = rawStatus === 'checkin'  || rawStatus === '1' || rawStatus === 'in';
      const isOut = rawStatus === 'checkout' || rawStatus === '2' || rawStatus === 'out';
      if (!isIn && !isOut) continue;
      const isoTs   = ts.toISOString();
      const dateStr = isoTs.split('T')[0];
      const serialNo = evt.serialNo || null;
      const docId    = serialNo ? `dev_${serialNo}` : `dev_${ts.getTime()}_${slot}`;
      const docPath  = `businesses/${businessId}/attendance_events/${dateStr}/${slotNum}/${docId}`;
      parsed.push({ docPath, slotNum, slot, empName: evt.name || `Employee ${slot}`, isoTs, dateStr, ts, statusStr: isIn ? 'in' : 'out', serialNo });
    }

    // Batch-check existence (20 concurrent)
    if (onStatus) onStatus('comparing');
    const existingSet = new Set();
    const BATCH = 20;
    for (let i = 0; i < parsed.length; i += BATCH) {
      const batch = parsed.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(e => docExists(e.docPath).then(ex => ({ e, ex }))));
      for (const { e, ex } of results) {
        if (ex) existingSet.add(e.docPath);
      }
    }

    const toWrite = parsed.filter(e => !existingSet.has(e.docPath));
    log(`Sync: ${existingSet.size} existing, ${toWrite.length} new to write`);

    // Write missing events in parallel batches of 50
    if (onStatus) onStatus('writing');
    let written = 0;
    const WRITE_BATCH = 50;
    for (let i = 0; i < toWrite.length; i += WRITE_BATCH) {
      const batch = toWrite.slice(i, i + WRITE_BATCH);
      await Promise.all(batch.map(async e => {
        try {
          await writeDoc(e.docPath, {
            employeeId: e.slot, employeeName: e.empName, slotNumber: e.slotNum,
            time: e.ts.toLocaleTimeString('en-US', { hour12: false }),
            timestamp: e.isoTs, type: e.statusStr === 'in' ? 'clock-in' : 'clock-out',
            attendanceStatus: e.statusStr, deviceId: config.deviceSerial || 'unknown',
            serialNo: e.serialNo, recordedAt: new Date().toISOString(),
            isDuplicatePunch: false, isManual: false, source: 'connector-sync'
          });
          written++;
        } catch (err) {
          log(`Write error: ${err.message}`);
        }
      }));
    }

    log(`Sync complete: ${written} written`);
    if (onStatus) onStatus('done');
    return { total: events.length, existing: existingSet.size, written, newEvents: toWrite.length };
  } catch (err) {
    log(`Sync error: ${err.message}`);
    if (onStatus) onStatus('error');
    throw err;
  }
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
async function sendHeartbeat(config, extra = {}) {
  try {
    await writeDocApiKey(`businesses/${config.businessId}/connector_status/current`, {
      active:      true,
      lastSeen:    new Date().toISOString(),
      hostname:    os.hostname(),
      version:     AGENT_VERSION,
      deviceIP:    config.deviceIP,
      deviceSerial: config.deviceSerial || '',
      ...extra
    });
    log('Heartbeat sent OK');
  } catch (err) {
    log(`Heartbeat error: ${err.message}`);
  }
}

// ── Sync Request Watcher ──────────────────────────────────────────────────────
async function checkSyncRequest(config) {
  try {
    const doc = await firestoreRequest('GET', `businesses/${config.businessId}/connector_sync_request/current`);
    if (doc?.fields?.status?.stringValue === 'requested') {
      log('Manual sync requested from dashboard');
      await writeDoc(`businesses/${config.businessId}/connector_sync_request/current`, { status: 'running', startedAt: new Date().toISOString() });
      try {
        const result = await runSync(config);
        await writeDoc(`businesses/${config.businessId}/connector_sync_request/current`, {
          status:      'done',
          completedAt: new Date().toISOString(),
          newEvents:   result.written,
          total:       result.total
        });
        log(`Manual sync done: ${result.written} new events`);
      } catch (err) {
        await writeDoc(`businesses/${config.businessId}/connector_sync_request/current`, {
          status: 'error',
          error:  err.message,
          completedAt: new Date().toISOString()
        });
      }
    }
  } catch (_) {}
}

// ── Setup HTML (embedded) ─────────────────────────────────────────────────────
const SETUP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SmartClock Connector Setup</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f4ff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
  .card { background: white; border-radius: 16px; padding: 2.5rem; width: 100%; max-width: 480px; box-shadow: 0 4px 24px rgba(0,0,0,0.12); }
  .logo { text-align: center; margin-bottom: 2rem; }
  .logo h1 { font-size: 1.8rem; color: #1a1a2e; }
  .logo p { color: #64748b; margin-top: 0.25rem; font-size: 0.95rem; }
  .step { display: none; }
  .step.active { display: block; }
  label { display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.4rem; margin-top: 1rem; }
  input { width: 100%; padding: 0.75rem; border: 1.5px solid #d1d5db; border-radius: 8px; font-size: 0.95rem; outline: none; transition: border-color 0.2s; }
  input:focus { border-color: #667eea; }
  .btn { display: block; width: 100%; padding: 0.9rem; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 1.5rem; transition: opacity 0.2s; }
  .btn:hover { opacity: 0.9; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-outline { background: white; color: #667eea; border: 1.5px solid #667eea; }
  .status { padding: 0.75rem 1rem; border-radius: 8px; margin-top: 1rem; font-size: 0.9rem; }
  .status.error { background: #fef2f2; color: #dc2626; }
  .status.info  { background: #f0f4ff; color: #4f46e5; }
  .status.success { background: #f0fdf4; color: #16a34a; }
  .progress-bar { background: #e5e7eb; border-radius: 99px; height: 8px; margin: 1rem 0; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 99px; transition: width 0.3s; }
  .device-list { margin-top: 1rem; }
  .device-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1rem; border: 1.5px solid #e5e7eb; border-radius: 8px; cursor: pointer; margin-bottom: 0.5rem; transition: border-color 0.2s, background 0.2s; }
  .device-item:hover, .device-item.selected { border-color: #667eea; background: #f0f4ff; }
  .device-icon { font-size: 1.5rem; }
  .device-info { flex: 1; }
  .device-info strong { display: block; font-size: 0.95rem; color: #1f2937; }
  .device-info small { color: #6b7280; font-size: 0.8rem; }
  .done-icon { font-size: 3rem; text-align: center; margin: 1rem 0; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <h1>🕐 SmartClock</h1>
    <p>Connector Setup</p>
  </div>

  <!-- Step 1: Login -->
  <div class="step active" id="step-login">
    <h2 style="color:#1f2937;font-size:1.2rem;">Sign in to your account</h2>
    <p style="color:#6b7280;font-size:0.9rem;margin-top:0.5rem;">Use the same email and password you use to log into the SmartClock dashboard.</p>
    <label>Email Address</label>
    <input type="email" id="email" placeholder="you@example.com" autocomplete="email">
    <label>Password</label>
    <input type="password" id="password" placeholder="Your password" autocomplete="current-password">
    <div id="loginStatus" class="status" style="display:none;"></div>
    <button class="btn" id="loginBtn" onclick="doLogin()">Sign In & Continue →</button>
  </div>

  <!-- Step 2: Scan for devices -->
  <div class="step" id="step-scan">
    <h2 style="color:#1f2937;font-size:1.2rem;">Looking for your device...</h2>
    <p style="color:#6b7280;font-size:0.9rem;margin-top:0.5rem;">Scanning your local network for Hikvision devices. This takes about 30 seconds.</p>
    <div class="progress-bar"><div class="progress-fill" id="scanProgress" style="width:0%"></div></div>
    <p id="scanLabel" style="color:#6b7280;font-size:0.85rem;text-align:center;">Scanning... 0%</p>
    <div id="deviceList" class="device-list"></div>
    <div id="scanStatus" class="status" style="display:none;"></div>
    <button class="btn" id="selectDeviceBtn" style="display:none;" onclick="goToDevicePassword()">Use Selected Device →</button>
    <button class="btn btn-outline" id="manualIPBtn" style="margin-top:0.75rem;" onclick="goToManualIP()">Enter IP Manually</button>
  </div>

  <!-- Step 3: Device password -->
  <div class="step" id="step-devpass">
    <h2 style="color:#1f2937;font-size:1.2rem;">Device Password</h2>
    <p id="selectedDeviceInfo" style="color:#6b7280;font-size:0.9rem;margin-top:0.5rem;"></p>
    <label>Device Admin Password</label>
    <input type="password" id="devicePass" placeholder="Device admin password" autocomplete="off">
    <p style="color:#6b7280;font-size:0.8rem;margin-top:0.5rem;">This is the password to log into the Hikvision device web interface (typically set during device installation).</p>
    <div id="devPassStatus" class="status" style="display:none;"></div>
    <button class="btn" id="testDeviceBtn" onclick="testDevice()">Test & Save →</button>
    <button class="btn btn-outline" style="margin-top:0.75rem;" onclick="showStep('step-scan')">← Back</button>
  </div>

  <!-- Step 4: Manual IP fallback -->
  <div class="step" id="step-manual">
    <h2 style="color:#1f2937;font-size:1.2rem;">Enter Device IP</h2>
    <label>Device IP Address</label>
    <input type="text" id="manualIP" placeholder="e.g. 192.168.0.114">
    <label>Device Admin Username</label>
    <input type="text" id="manualUser" placeholder="admin" value="admin">
    <label>Device Admin Password</label>
    <input type="password" id="manualPass" placeholder="Device admin password">
    <div id="manualStatus" class="status" style="display:none;"></div>
    <button class="btn" onclick="testManual()">Test & Save →</button>
    <button class="btn btn-outline" style="margin-top:0.75rem;" onclick="showStep('step-scan')">← Back</button>
  </div>

  <!-- Step 5: Done -->
  <div class="step" id="step-done">
    <div class="done-icon">✅</div>
    <h2 style="color:#1f2937;font-size:1.3rem;text-align:center;">Connector is Running!</h2>
    <p style="color:#6b7280;font-size:0.9rem;margin-top:0.75rem;text-align:center;">Your SmartClock Connector is now active. It will automatically sync your device events every 5 minutes and recover any missed events after internet outages.</p>
    <div class="status success" style="display:block;margin-top:1.5rem;">
      ✅ Connected to your dashboard<br>
      ✅ Device sync active<br>
      ✅ Auto-recovery enabled
    </div>
    <p style="color:#9ca3af;font-size:0.8rem;margin-top:1.5rem;text-align:center;">You can close this window. The connector runs in the background.</p>
  </div>
</div>

<script>
let selectedDevice = null;
let loginData = null;

function showStep(id) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showStatus(id, msg, type) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = 'status ' + type;
  el.style.display = 'block';
}

async function doLogin() {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) { showStatus('loginStatus', 'Please enter email and password.', 'error'); return; }
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  showStatus('loginStatus', 'Verifying credentials...', 'info');
  try {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const d = await r.json();
    if (!d.success) throw new Error(d.error || 'Login failed');
    loginData = d;

    if (d.device && d.device.ip && d.device.pass) {
      // Device credentials found — auto-connect without manual scan
      showStatus('loginStatus', 'Logged in as ' + d.businessName + '. Connecting to device ' + d.device.ip + '...', 'success');
      btn.textContent = 'Connecting...';
      const tr = await fetch('/api/test-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: d.device.ip,
          port: 443,
          user: d.device.user,
          pass: d.device.pass,
          serial: d.device.serial,
          model: d.device.model,
          businessId: d.businessId
        })
      });
      const td = await tr.json();
      if (td.success) {
        showStep('step-done');
      } else {
        // Auto-connect failed — fall through to scan so user can pick device
        showStatus('loginStatus', 'Logged in. Auto-connect failed (' + td.error + ') - scanning for device...', 'info');
        showStep('step-scan');
        startScan();
      }
    } else {
      // No device on file — run scan
      showStep('step-scan');
      startScan();
    }
  } catch (e) {
    showStatus('loginStatus', e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Sign In & Continue ->';
  }
}

async function startScan() {
  document.getElementById('deviceList').innerHTML = '';
  document.getElementById('selectDeviceBtn').style.display = 'none';
  document.getElementById('scanStatus').style.display = 'none';

  const eventsource = new EventSource('/api/scan');
  eventsource.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.progress !== undefined) {
      document.getElementById('scanProgress').style.width = d.progress + '%';
      document.getElementById('scanLabel').textContent = 'Scanning... ' + d.progress + '%';
    }
    if (d.device) {
      const list = document.getElementById('deviceList');
      const item = document.createElement('div');
      item.className = 'device-item';
      item.dataset.ip     = d.device.ip;
      item.dataset.port   = d.device.port || 443;
      item.dataset.serial = d.device.serial;
      item.dataset.model  = d.device.model;
  item.innerHTML = '<div class="device-icon">CAM</div><div class="device-info"><strong>' + d.device.model + '</strong><small>' + d.device.ip + ':' + (d.device.port || 443) + (d.device.serial ? ' - ' + d.device.serial : '') + '</small></div>';
      item.onclick = () => selectDevice(item);
      list.appendChild(item);
    }
    if (d.done) {
      eventsource.close();
      document.getElementById('scanProgress').style.width = '100%';
      document.getElementById('scanLabel').textContent = 'Scan complete';
      const items = document.querySelectorAll('.device-item');
      if (items.length === 0) {
        showStatus('scanStatus', 'No Hikvision devices found. Use "Enter IP Manually" below.', 'error');
      } else if (items.length === 1) {
        selectDevice(items[0]);
      }
    }
  };
  eventsource.onerror = () => { eventsource.close(); };
}

function selectDevice(item) {
  document.querySelectorAll('.device-item').forEach(i => i.classList.remove('selected'));
  item.classList.add('selected');
  selectedDevice = { ip: item.dataset.ip, port: parseInt(item.dataset.port) || 443, serial: item.dataset.serial, model: item.dataset.model };
  document.getElementById('selectDeviceBtn').style.display = 'block';
}

function goToDevicePassword() {
  if (!selectedDevice) return;
  document.getElementById('selectedDeviceInfo').textContent = 'Device: ' + selectedDevice.model + ' at ' + selectedDevice.ip;
  showStep('step-devpass');
}

function goToManualIP() {
  showStep('step-manual');
}

async function testDevice() {
  const pass = document.getElementById('devicePass').value;
  if (!pass) { showStatus('devPassStatus', 'Please enter the device password.', 'error'); return; }
  const btn = document.getElementById('testDeviceBtn');
  btn.disabled = true; btn.textContent = 'Testing connection...';
  showStatus('devPassStatus', 'Testing device connection...', 'info');
  try {
    const r = await fetch('/api/test-device', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip: selectedDevice.ip, port: selectedDevice.port || 443, user: 'admin', pass, serial: selectedDevice.serial, model: selectedDevice.model, businessId: loginData.businessId }) });
    const d = await r.json();
    if (!d.success) throw new Error(d.error);
    showStep('step-done');
  } catch (e) {
    showStatus('devPassStatus', e.message, 'error');
    btn.disabled = false; btn.textContent = 'Test & Save →';
  }
}

async function testManual() {
  const ip   = document.getElementById('manualIP').value.trim();
  const user = document.getElementById('manualUser').value.trim() || 'admin';
  const pass = document.getElementById('manualPass').value;
  if (!ip || !pass) { showStatus('manualStatus', 'Please fill in all fields.', 'error'); return; }
  showStatus('manualStatus', 'Testing connection...', 'info');
  try {
    const r = await fetch('/api/test-device', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip, port: 443, user, pass, serial: '', model: 'Hikvision Device', businessId: loginData.businessId }) });
    const d = await r.json();
    if (!d.success) throw new Error(d.error);
    showStep('step-done');
  } catch (e) {
    showStatus('manualStatus', e.message, 'error');
  }
}
</script>
</body>
</html>`;

// ── Setup HTTP Server ─────────────────────────────────────────────────────────
function startSetupServer(onComplete) {
  let scanClients = [];

  const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    if (req.method === 'GET' && url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(SETUP_HTML);
    }

    // SSE scan endpoint
    if (req.method === 'GET' && url === '/api/scan') {
      res.writeHead(200, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive'
      });
      scanClients.push(res);
      req.on('close', () => { scanClients = scanClients.filter(c => c !== res); });

      scanNetwork(
        (progress, found) => {
          const last = found[found.length - 1];
          if (last && !last._sent) {
            last._sent = true;
            res.write(`data: ${JSON.stringify({ progress, device: last })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ progress })}\n\n`);
          }
        }
      ).then(found => {
        res.write(`data: ${JSON.stringify({ done: true, count: found.length })}\n\n`);
        res.end();
      });
      return;
    }

    // JSON endpoints
    let body = '';
    req.on('data', c => body += c);
    await new Promise(r => req.on('end', r));
    let parsed = {};
    try { parsed = JSON.parse(body); } catch (_) {}

    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'POST' && url === '/api/login') {
      try {
        const results = await loginQuery(parsed.email);
        const match = Array.isArray(results) && results.find(r => r.document);
        if (!match) throw new Error('Account not found. Please check your email address.');
        const fields = match.document.fields;
        if (!fields.password?.stringValue) throw new Error('Account has no password set. Contact support.');
        if (fields.password.stringValue !== parsed.password) throw new Error('Incorrect password.');
        const bizId   = match.document.name.split('/').pop();
        const bizName = fields.businessName?.stringValue || 'Your Business';

        // Look up linked device credentials from businesses/{bizId}/devices subcollection
        let deviceInfo = null;
        try {
          const devList = await listDocs(`businesses/${bizId}/devices`);
          const devDocs = devList.documents || [];
          for (const devRef of devDocs) {
            const deviceId = devRef.name.split('/').pop();
            const globalDev = await getDocByPath(`devices/${deviceId}`);
            if (globalDev && globalDev.fields) {
              const f = globalDev.fields;
              if (f.ipAddress?.stringValue && f.password?.stringValue) {
                deviceInfo = {
                  ip:       f.ipAddress.stringValue,
                  user:     f.username?.stringValue || 'admin',
                  pass:     f.password.stringValue,
                  serial:   f.serialNumber?.stringValue || '',
                  model:    f.deviceName?.stringValue || 'Hikvision Device'
                };
                break;
              }
            }
          }
        } catch (_) { /* device lookup failure is non-fatal */ }

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, businessId: bizId, businessName: bizName, device: deviceInfo }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (req.method === 'POST' && url === '/api/test-device') {
      try {
        _digestChallenge = null;
        const events = await fetchAllDeviceEvents(parsed.ip, parsed.user, parsed.pass, parsed.port || 443);
        // Save config
        const cfg = {
          businessId:   parsed.businessId,
          deviceIP:     parsed.ip,
          devicePort:   parsed.port || 443,
          deviceUser:   parsed.user,
          devicePass:   parsed.pass,
          deviceSerial: parsed.serial || '',
          deviceModel:  parsed.model  || 'Hikvision Device',
          setupAt:      new Date().toISOString()
        };
        saveConfig(cfg);
        log(`Setup complete. Business: ${cfg.businessId}, Device: ${cfg.deviceIP} (${events.length} events)`);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, eventCount: events.length }));
        // Kick off background agent after short delay
        setTimeout(() => { server.close(); onComplete(cfg); }, 2000);
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    res.writeHead(404);
    res.end('{}');
  });

  server.listen(SETUP_PORT, '127.0.0.1', () => {
    log(`Setup server running at http://localhost:${SETUP_PORT}`);
    console.log('\n======================================================');
    console.log('  SmartClock Connector — First-time Setup');
    console.log(`  Open in your browser: http://localhost:${SETUP_PORT}`);
    console.log('======================================================\n');
    // Try to open browser automatically
    const { exec } = require('child_process');
    const url = `http://localhost:${SETUP_PORT}`;
    if (process.platform === 'win32')  exec(`start ${url}`);
    else if (process.platform === 'darwin') exec(`open ${url}`);
    else exec(`xdg-open ${url}`);
  });
}

// ── Background Agent ──────────────────────────────────────────────────────────
async function startAgent(config) {
  log(`Agent starting. Business: ${config.businessId}, Device: ${config.deviceIP}`);

  // Initial sync + heartbeat
  await sendHeartbeat(config, { lastSyncStatus: 'starting' });
  try {
    const result = await runSync(config);
    await sendHeartbeat(config, { lastSyncStatus: 'ok', lastSyncAt: new Date().toISOString(), lastSyncNewEvents: result.written });
  } catch (err) {
    await sendHeartbeat(config, { lastSyncStatus: 'error', lastSyncError: err.message });
  }

  // Heartbeat every 60s
  setInterval(async () => {
    await sendHeartbeat(config);
  }, HEARTBEAT_INTERVAL);

  // Sync every 5 min
  setInterval(async () => {
    log('Scheduled sync starting...');
    try {
      const result = await runSync(config);
      await sendHeartbeat(config, { lastSyncStatus: 'ok', lastSyncAt: new Date().toISOString(), lastSyncNewEvents: result.written });
    } catch (err) {
      log(`Scheduled sync failed: ${err.message}`);
      await sendHeartbeat(config, { lastSyncStatus: 'error', lastSyncError: err.message });
    }
  }, SYNC_INTERVAL);

  // Watch for manual sync requests every 30s
  setInterval(() => checkSyncRequest(config), POLL_INTERVAL);

  log('Agent running. Press Ctrl+C to stop.');

  // Always serve a status page on the setup port so the browser link works
  startStatusServer(config);
}

// ── Status Server (agent mode) ────────────────────────────────────────────────
function startStatusServer(config) {
  const STATUS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SmartClock Connector</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#fff;border-radius:16px;padding:2rem 2.5rem;max-width:420px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center}
  .logo{font-size:2.5rem;margin-bottom:.5rem}
  h1{font-size:1.3rem;color:#1f2937;margin:.5rem 0}
  .status-dot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;vertical-align:middle}
  .dot-green{background:#22c55e} .dot-red{background:#ef4444}
  .info{background:#f9fafb;border-radius:8px;padding:1rem;text-align:left;font-size:.85rem;color:#374151;line-height:1.8;margin:1.2rem 0}
  .info strong{color:#111}
  .btn{display:inline-block;padding:.65rem 1.5rem;border-radius:8px;border:none;cursor:pointer;font-size:.9rem;font-weight:600;margin:.3rem}
  .btn-blue{background:#3b82f6;color:#fff} .btn-blue:hover{background:#2563eb}
  .btn-red{background:#ef4444;color:#fff} .btn-red:hover{background:#dc2626}
  .btn-green{background:#22c55e;color:#fff} .btn-green:hover{background:#16a34a}
  #msg{margin-top:1rem;font-size:.85rem;color:#6b7280}
</style>
</head>
<body>
<div class="card">
  <div class="logo">🔗</div>
  <h1>SmartClock Connector</h1>
  <p style="color:#6b7280;font-size:.85rem;margin:.25rem 0 1rem">Running in background</p>
  <div><span class="status-dot dot-green"></span><strong style="color:#15803d">Active</strong></div>
  <div class="info">
    <div><strong>Business:</strong> ${config.businessId}</div>
    <div><strong>Device:</strong> ${config.deviceIP}:${config.devicePort || 443}</div>
    <div><strong>Version:</strong> ${AGENT_VERSION}</div>
    <div><strong>Host:</strong> ${os.hostname()}</div>
  </div>
  <button class="btn btn-green" onclick="syncNow()">🔄 Sync Now</button>
  <button class="btn btn-red" onclick="resetConfig()">⚙️ Reconfigure</button>
  <div id="msg"></div>
</div>
<script>
async function syncNow() {
  document.getElementById('msg').textContent = 'Sync triggered…';
  await fetch('/api/sync-now', { method: 'POST' });
  document.getElementById('msg').textContent = 'Sync started — check your dashboard.';
}
async function resetConfig() {
  if (!confirm('This will delete the saved setup and restart configuration. Continue?')) return;
  await fetch('/api/reset', { method: 'POST' });
  document.getElementById('msg').textContent = 'Config cleared. Restarting setup…';
  setTimeout(() => location.reload(), 3000);
}
</script>
</body></html>`;

  const srv = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/api/sync-now' && req.method === 'POST') {
      log('Manual sync triggered from status page');
      runSync(config).catch(e => log('Manual sync error: ' + e.message));
      res.writeHead(200); res.end('{}');
      return;
    }
    if (url === '/api/reset' && req.method === 'POST') {
      log('Config reset requested from status page');
      try { fs.unlinkSync(CONFIG_FILE); } catch (_) {}
      res.writeHead(200); res.end('{}');
      setTimeout(() => process.exit(0), 500); // service manager will restart
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(STATUS_HTML);
  });

  srv.listen(SETUP_PORT, '127.0.0.1', () => {
    log(`Status server running at http://localhost:${SETUP_PORT}`);
  });
  srv.on('error', () => {}); // ignore if port already in use
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log('SmartClock Connector v' + AGENT_VERSION + ' starting...');

  const config = loadConfig();

  if (!config) {
    // First run — start setup server
    startSetupServer(cfg => {
      log('Setup complete — starting background agent');
      startAgent(cfg);
    });
  } else {
    log('Config found — starting background agent directly');
    await startAgent(config);
  }
}

main().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
