# Smart Clock v2 — Full Setup Guide
> How to deploy a new client instance of Smart Clock from scratch.  
> Follow this exactly and the AI agent will reproduce the full working system.

---

## Overview of What Was Built

A web-based attendance system where:
- A **Hikvision face/card reader** records staff clock-in/out events
- Events are forwarded in real-time to **Firebase Firestore** via a **VPS relay**
- A **web dashboard** shows live attendance, timecards, and assessments
- A **historical import script** backfills all past device events into Firestore
- A **fan-out relay** allows one device (which only supports 1 HTTP slot) to push to **multiple Firebase projects simultaneously**

---

## Architecture

```
Hikvision Device (192.168.0.114)
        │
        │  HTTP POST (device slot 1)
        ▼
VPS Relay (69.62.109.168:7662)  ← hikvision-fanout.js (PM2: vps-fanout)
        │
        ├──► Firebase Project A: aiclock-82608
        │         Cloud Function: attendanceWebhook
        │
        └──► Firebase Project B: smartclock-v2-8271f   ← NEW CLIENT
                  Cloud Function: attendanceWebhook
                  Web App: https://smartclock-v2-8271f.web.app
```

---

## Part 1 — Firebase Project Setup

### 1.1 Create the Firebase Project
1. Go to https://console.firebase.google.com
2. Create new project — name it `smartclock-v2-{clientname}`
3. Enable **Blaze (pay-as-you-go)** plan — required for Cloud Functions
4. Enable **Firestore Database** (production mode)
5. Enable **Firebase Hosting**
6. Enable **Authentication** → Email/Password provider

### 1.2 Configure the Web App
In the project directory:
```bash
# Update Firebase config in src/firebase-config.js (or wherever it lives)
# Replace ALL firebaseConfig values with the new project's values from:
# Firebase Console → Project Settings → Your Apps → Web App → Config
```

Key file to update: `src/firebase-config.js` (or search for `apiKey:` in the codebase)

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "YOUR-PROJECT.firebaseapp.com",
  projectId: "YOUR-PROJECT",
  storageBucket: "YOUR-PROJECT.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

Also update `.firebaserc`:
```json
{
  "projects": {
    "default": "YOUR-PROJECT-ID"
  }
}
```

Also update `firebase.json` if it contains the project ID.

### 1.3 Deploy Functions and Hosting
```bash
cd "/path/to/project"
firebase deploy --only functions
firebase deploy --only hosting
```

The Cloud Function URL will be:
`https://attendancewebhook-XXXXXXXXXX-uc.a.run.app`

Note this URL — you need it for the VPS fan-out relay.

---

## Part 2 — Firestore Data Structure

Create the following documents manually in Firestore Console or via script.

### Business document
```
businesses/{BUSINESS_ID}/
```
`BUSINESS_ID` format: `biz_{clientname_snake_case}` e.g. `biz_speaker_repairs_sa`

### Device registration
```
businesses/{BUSINESS_ID}/devices/{DEVICE_SERIAL}
```
Fields:
```json
{
  "deviceId": "FC4349999",
  "businessId": "biz_speaker_repairs_sa",
  "ip": "192.168.0.114",
  "name": "Main Entrance",
  "active": true,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```
> ⚠️ If this document does not exist, the Cloud Function returns 400 and rejects all scans.

### Staff slots
```
businesses/{BUSINESS_ID}/staff/1
businesses/{BUSINESS_ID}/staff/2
... up to however many staff
```
Fields per slot:
```json
{
  "employeeId": "1",
  "employeeName": "azam",
  "badgeNumber": "1",
  "slot": 1,
  "active": true,
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```
Placeholder for unknown slots:
```json
{
  "employeeId": "2",
  "employeeName": "Employee 2",
  "badgeNumber": "2",
  "slot": 2,
  "active": true
}
```

### Status documents (one per staff slot)
```
businesses/{BUSINESS_ID}/status/1
```
Fields:
```json
{
  "employeeId": "1",
  "employeeName": "azam",
  "attendanceStatus": "out",
  "lastClockTime": "2026-01-01T00:00:00.000Z",
  "slot": 1,
  "active": true
}
```

---

## Part 3 — VPS Fan-out Relay

### VPS Details
- **IP:** `69.62.109.168`
- **SSH:** `ssh root@69.62.109.168` (password: ask project owner)
- **Process manager:** PM2

### Current PM2 processes
| PM2 Name | Port | Forwards to |
|---|---|---|
| `vps-relay` | 7660 | aiclock-82608 (DO NOT TOUCH) |
| `vps-relay-v2` | 7661 | smartclock-v2-8271f (idle) |
| `vps-fanout` | 7662 | BOTH projects simultaneously |

### Adding a new client to the fan-out relay
SSH into VPS:
```bash
ssh root@69.62.109.168
nano /root/hikvision-fanout.js
```

The fan-out relay (`hikvision-fanout.js`) has a `TARGETS` array. Add the new client's Cloud Function URL:
```javascript
const TARGETS = [
  'https://attendancewebhook-4q7htrps4q-uc.a.run.app/admin-webhook',  // aiclock
  'https://attendancewebhook-bfullfgyiq-uc.a.run.app/admin-webhook',  // smartclock-v2
  'https://YOUR-NEW-FUNCTION-URL/admin-webhook',                        // new client
];
```

Then restart:
```bash
pm2 restart vps-fanout
pm2 save
```

### If creating a separate relay for a new client
```bash
# Copy the existing relay
cp /root/hikvision-fanout.js /root/hikvision-client2.js
nano /root/hikvision-client2.js
# Change PORT and TARGET URLs

pm2 start /root/hikvision-client2.js --name vps-client2
pm2 save
```

---

## Part 4 — Hikvision Device Configuration

### Device Details (Speaker Repairs SA)
- **IP:** `192.168.0.114`
- **Auth:** Digest — `admin` / `Azam198419880001`
- **Device Serial:** `FC4349999`
- **Supports:** 1 active HTTP event slot

### Set HTTP push slot on device
Access: `https://192.168.0.114` → Configuration → Network → Advanced → Integration Protocol

Set HTTP slot 1 to:
```
Event Alarm IP/Domain Name: relay.smartclock.co.za
URL:                        /admin-webhook
Port:                       7662
Protocol:                   HTTP
```

> ⚠️ Use HTTP (not HTTPS) — the device sends plain HTTP to the relay, the relay uses HTTPS to Firebase.
> ⚠️ Do NOT use the raw VPS IP (`69.62.109.168`) — always use the domain so if the VPS IP ever changes you only update DNS in one place.

### Test the device connection
```bash
curl -s http://relay.smartclock.co.za:7662/health
# Should return: {"status":"ok"}
```

### DNS record required (WHM / Cloudflare / any DNS provider)
| Name | Type | Value | Proxy |
|---|---|---|---|
| `relay` | `A` | `69.62.109.168` | ❌ DNS only (no proxy) |

This creates `relay.smartclock.co.za` → VPS. If VPS IP ever changes, update this one record and all client devices follow automatically.

### Test a live scan reaches Firebase
Make someone scan. Then check Firestore:
```
businesses/{BUSINESS_ID}/attendance_events/{today's date}/{slot}/
```
A document should appear within 2-3 seconds.

---

## Part 5 — Historical Import Script

### File: `import-history.cjs`
Located at project root. Run from your Mac (must be on same LAN as device, OR device must be reachable from your network).

### How it works
1. **Pass 1** — Fetches all events from device via `POST /ISAPI/AccessControl/AcsEvent` with digest auth
2. **Pass 2** — Batch-checks Firestore for all event doc IDs in parallel (20 at a time)  
3. **Pass 3** — Writes only the missing events to Firestore
4. Updates `status/{slot}` with last known state per employee
5. Updates `staff/{slot}` names if device has real names for placeholder slots

### Config variables at top of script
```javascript
const DEVICE_IP   = '192.168.0.114';
const DEVICE_USER = 'admin';
const DEVICE_PASS = 'Azam198419880001';
const PROJECT     = 'smartclock-v2-8271f';   // ← change per client
const BUSINESS_ID = 'biz_speaker_repairs_sa'; // ← change per client
const START_DATE  = '2020-01-01T00:00:00';
```

### Requirements
- Node.js installed
- `gcloud` CLI installed and authenticated (`gcloud auth login`)
- Active project set: `gcloud config set project YOUR-PROJECT-ID`
- Must be on same LAN as the Hikvision device OR device IP must be reachable

### Run
```bash
cd "/path/to/project"
node import-history.cjs
```

### Deduplication
Doc ID per event = `dev_{serialNo}` (device's own serial number per event).  
Safe to re-run any number of times — already-imported events are detected in Pass 2 and skipped.

### When to re-run
- After setting up a new Firebase project (initial backfill)
- After a VPS outage where live scans were missed
- After database reset

---

## Part 6 — Dashboard Live Monitor Fix

The dashboard's Monitor Mode uses `onSnapshot` (real-time listener) — NOT `getDocs` (one-shot).

Key pattern in `src/pages/business-dashboard.html`:
```javascript
let monitorLiveUnsubscribe = null;

function loadMonitorData() {
  // Tear down old listener
  if (monitorLiveUnsubscribe) monitorLiveUnsubscribe();

  const statusRef = collection(db, `businesses/${bizId}/status`);
  monitorLiveUnsubscribe = onSnapshot(statusRef, (snapshot) => {
    renderMonitorSnapshot(snapshot);
  });
}

function renderMonitorSnapshot(snapshot) {
  // pure render — rebuilds IN/OUT columns from snapshot docs
}
```

> ⚠️ If you ever see the monitor not updating on scan, this is the first thing to check — make sure it's `onSnapshot` not `getDocs`.

---

## Part 7 — Admin Impersonation System

Admins can log in as any business user via the admin panel. The system works by:
1. Admin selects a business from the admin panel
2. A custom Firebase Auth token is issued for that business context
3. The dashboard loads with that business's data

Check `functions/index.js` for the `impersonateUser` callable function.

---

## Part 8 — New Client Checklist

When onboarding a new client, do these steps in order:

- [ ] Create Firebase project (Blaze plan)
- [ ] Update `firebaseConfig` in codebase
- [ ] Update `.firebaserc` with new project ID
- [ ] `firebase deploy --only functions`
- [ ] `firebase deploy --only hosting`
- [ ] Create `businesses/{BUSINESS_ID}` structure in Firestore
- [ ] Create `businesses/{BUSINESS_ID}/devices/{SERIAL}` registration doc
- [ ] Create `businesses/{BUSINESS_ID}/staff/1..N` placeholder slots
- [ ] Add new Cloud Function URL to VPS fan-out relay (`/root/hikvision-fanout.js`)
- [ ] `pm2 restart vps-fanout && pm2 save` on VPS
- [ ] Configure device HTTP slot to point to `http://69.62.109.168:7662/admin-webhook`
- [ ] Test a live scan — confirm doc appears in Firestore within 3 seconds
- [ ] Update config variables in `import-history.cjs`
- [ ] Run `node import-history.cjs` to backfill historical events
- [ ] Verify staff names were auto-filled from device events
- [ ] Check dashboard at `https://YOUR-PROJECT.web.app`
- [ ] Update `FIREBASE_API_KEY` + `FIREBASE_PROJECT` constants in `sync-agent/sync-agent.cjs`
- [ ] Rebuild connector zips (see Part 10.10)
- [ ] `firebase deploy --only hosting` so updated connector zip is live
- [ ] Install connector on a LAN machine at the client site (see Part 10.8)
- [ ] Verify green connector dot on dashboard Sync tab within 2 minutes

---

## Part 9 — Known Limitations

### WiFi outage gap
The VPS relay requires internet to forward events. During an outage:
- Device continues recording events to its onboard storage
- VPS never receives them — they are missing from Firestore
- When internet restores, device resumes live pushes but does **not** replay missed ones

**Workaround 1:** Run `node import-history.cjs` after any known outage.

**Workaround 2 (preferred):** Install the SmartClock Connector on a LAN machine at the client's site — it polls the device every 5 minutes and auto-backfills gaps automatically. See **Part 10** for full details.

### Device HTTP slot limit
Hikvision devices typically support only 1 active HTTP push slot. The fan-out relay on the VPS solves this by accepting 1 inbound connection and forwarding to multiple Firebase projects simultaneously.

---

---

## Part 10 — SmartClock Connector (Direct Device Sync)

The Connector is a **self-contained Node.js background agent** installed on a Windows or Mac machine **on the same LAN as the Hikvision device**. It solves two problems:

1. **Gap recovery** — if the VPS relay misses events during an internet outage, the connector automatically detects and backfills them on the next 5-minute cycle.
2. **Direct event browsing** — the dashboard "Browse Device Events by Date" feature queries the connector in milliseconds without routing through the VPS or a Cloud Function.

The connector has NO external npm dependencies — it uses only Node.js built-ins (`https`, `http`, `fs`, `os`, `crypto`).

---

### 10.1 Architecture

```
LAN Machine (Windows / Mac)
   └─ ~/SmartClockConnector/sync-agent.cjs  (Node.js — always running)
         │
         ├── every 5 min  ──► Hikvision device ISAPI (digest HTTPS)
         │                        fetches ALL events since 2020-01-01
         │                        compares against Firestore
         │                        writes only missing events
         │
         ├── every 60 sec ──► Firestore connector_status/current (heartbeat)
         │
         ├── every 30 sec ──► Firestore connector_sync_request/current
         │                        if status='requested' → run immediate sync
         │
         ├── every 5 sec  ──► Firestore connector_event_query/current
         │                        if status='requested' → fetch events for date
         │                        write results back to same doc
         │
         └── HTTP server  ──► localhost:7663
               GET  /           → Setup wizard UI (first run) or status page
               GET  /health     → { status:'ok', ... }
               GET  /api/status → JSON of current config and status
               GET  /api/query-events?date=YYYY-MM-DD  → events from device
               POST /api/login  → validate credentials against Firestore
               POST /api/scan   → trigger LAN scan for Hikvision devices
               POST /api/save-config → save connector-config.json
               POST /api/sync   → trigger immediate sync
```

---

### 10.2 Key Firestore Documents

These documents are created automatically by the connector when it first runs. You do not need to create them manually.

#### `businesses/{bizId}/connector_status/current`
Written by connector heartbeat every 60 seconds. Read by the dashboard.
```json
{
  "active": true,
  "lastSeen": "2026-03-05T06:00:00.000Z",
  "hostname": "DESKTOP-AZAM",
  "version": "1.0.0",
  "deviceIP": "192.168.0.114",
  "deviceSerial": "FC4349999",
  "lastSyncAt": "2026-03-05T06:00:00.000Z",
  "lastSyncStatus": "ok",
  "lastSyncNewEvents": 0,
  "recentEventsJson": "[{\"name\":\"azam\",\"time\":\"...\",\"type\":\"in\",\"isNew\":false},...]"
}
```
> ⚠️ Written with `updateMask.fieldPaths=` per field on the REST PATCH call so individual fields can be updated without accidentally wiping others.

#### `businesses/{bizId}/connector_sync_request/current`
Written by dashboard "Sync Now" button. Read by connector every 30 s.
```json
{ "status": "requested" }
// connector changes to: { "status": "running", "startedAt": "..." }
// then:                 { "status": "done", "completedAt": "...", "newEvents": 3, "total": 142 }
```

#### `businesses/{bizId}/connector_event_query/current`
Written by dashboard date browser. Read by connector every 5 s.
```json
{ "status": "requested", "date": "2026-03-05" }
// connector changes to: { "status": "running", ... }
// then:                 { "status": "done", "date": "...", "eventsJson": "[...]", "totalEvents": 3, "completedAt": "..." }
```
`eventsJson` is a JSON string of `parseDeviceEvent` objects — see Section 10.5.

---

### 10.3 Device Communication (Hikvision ISAPI)

The connector talks to the device using **HTTP Digest Auth** over **HTTPS port 443** (self-signed cert, `rejectUnauthorized: false`).

**Endpoint:** `POST https://{deviceIP}/ISAPI/AccessControl/AcsEvent?format=json`

**Request body:**
```json
{
  "AcsEventCond": {
    "searchID": "connector_sync",
    "searchResultPosition": 0,
    "maxResults": 50,
    "startTime": "2020-01-01T00:00:00",
    "endTime": "2099-12-31T23:59:59"
  }
}
```

> ⚠️ **Do NOT filter by `major`/`minor`** — using `major: 5, minor: 75` limits to attendance cardswipe events and misses fingerprint access events (`major: 5, minor: 76`) and system events (door locked, remote login). Leave the filter field absent entirely to get all events.

> ⚠️ **End time must be a far future date** like `2099-12-31T23:59:59`. Using `new Date().toISOString()` for today's end time will cut off today's events because the device compares in UTC while its local time is UTC+2.

**Pagination:** The device returns max 50 events per call. Loop incrementing `searchResultPosition` until `batch.length === 0 || pos >= totalMatches`.

**Digest auth flow:**
1. First request (no auth header) → device returns `401` with `WWW-Authenticate: Digest realm="...", nonce="..."` header
2. Compute `HA1 = md5(user:realm:pass)`, `HA2 = md5(POST:/ISAPI/...)`, `response = md5(HA1:nonce:HA2)`
3. Subsequent requests include `Authorization: Digest ...` header
4. Nonces expire — if you get a `401` on a subsequent call, reset cached nonce and retry

---

### 10.4 SA Timezone Handling (Critical)

The Hikvision device stores event times using its **local clock (SAST = UTC+2)**. When you supply `startTime`/`endTime` in the `AcsEventCond`, the device treats them as **UTC**. This means to query "events on March 5 SA time" you must shift the boundaries by -2 hours:

```javascript
const SA_OFFSET_MS = 2 * 60 * 60 * 1000; // SAST is UTC+2, no daylight saving
const startMs = new Date(`${dateStr}T00:00:00Z`).getTime() - SA_OFFSET_MS;
const endMs   = new Date(`${dateStr}T23:59:59Z`).getTime() - SA_OFFSET_MS;
// For 2026-03-05:
//   startTime = "2026-03-04T22:00:00"
//   endTime   = "2026-03-05T21:59:59"
```

The UTC-2h shift means "send me everything the device recorded between SA local midnight and SA local 23:59:59".

> ⚠️ This offset is specific to SAST (UTC+2). For a different timezone, change `SA_OFFSET_MS`. For timezones with DST, you need to calculate the offset dynamically per date.

---

### 10.5 Event Parsing — `parseDeviceEvent()`

Raw device events have inconsistent fields depending on event type. This function normalises them:

```javascript
function parseDeviceEvent(e) {
  const slot      = String(e.employeeNoString || '').trim();
  const empName   = (e.name || '').trim() || (slot && slot !== '0' ? 'Employee ' + slot : '');
  const rawTime   = e.time || e.dateTime || null;
  const rawStatus = String(e.attendanceStatus || '').toLowerCase();
  const isIn  = rawStatus === 'checkin'  || rawStatus === '5' || rawStatus === '1' || rawStatus === 'in';
  const isOut = rawStatus === 'checkout' || rawStatus === '6' || rawStatus === '2' || rawStatus === 'out';
  let label = e.eventDescription || e.description || e.eventType || '';
  let type;
  if (isIn)        { type = 'in';     label = label || 'Clock In'; }
  else if (isOut)  { type = 'out';    label = label || 'Clock Out'; }
  else if (empName){ type = 'access'; label = label || 'Access Granted'; }
  else             { type = 'system'; label = label || ('Event ' + (e.major||'') + '/' + (e.minor||'')); }
  return { name: empName, time: rawTime, type, label };
}
```

**Result `type` values and what they mean:**

| `type` | Meaning | Example `label` | Employee? |
|---|---|---|---|
| `in` | Clock-in attendance | `"Clock In"` | Yes |
| `out` | Clock-out attendance | `"Clock Out"` | Yes |
| `access` | Fingerprint/card with no `attendanceStatus` | `"Access Granted"` | Yes |
| `system` | Device system event (no employee) | `"Door Locked"`, `"Remote: Login"` | No |

> ⚠️ For Firestore sync (writing attendance records), only `in` and `out` events are written. For the date browser display, **all 4 types** are shown so the user can see the full device activity log.

---

### 10.6 Firestore Write Strategy

**`writeDocApiKey(docPath, fields)`** — Used for heartbeats and query results. Uses the Firebase API key directly (no auth token required) with `updateMask.fieldPaths=` per field:

```
PATCH /v1/projects/{project}/databases/(default)/documents/{path}
  ?key={API_KEY}
  &updateMask.fieldPaths=active
  &updateMask.fieldPaths=lastSeen
  &updateMask.fieldPaths=hostname
```

This ensures only the specified fields are touched — other fields (like `recentEventsJson`) are never accidentally overwritten by a heartbeat, and `recentEventsJson` is never accidentally overwritten by a heartbeat that doesn't include it.

**`writeDoc(docPath, fields)`** — Used for attendance event writes. Gets an anonymous Firebase Auth token first, then uses `Bearer` auth on the Firestore REST API. Anonymous auth tokens are refreshed automatically.

---

### 10.7 Dashboard Integration

The dashboard has three connector UI components, all in `src/pages/business-dashboard.html`:

#### Connector Status Card (always shown when on Sync tab)
- Green dot = connector last seen within 5 minutes
- Yellow dot = seen 5-60 minutes ago
- Red dot = not seen since connector was last active (or never installed)
- "Sync Now" button writes `{ status: 'requested' }` to `connector_sync_request/current`
- If connector never installed: shows a "Download & Install" link

**HTML element IDs:** `connectorStatusDot`, `connectorLastSeen`, `connectorHostname`, `connectorVersion`, `connectorNotInstalled`

#### Live Feed Table (shown after first connector sync)
Reads `recentEventsJson` from `connector_status/current`. Shows last 20 events from the most recent sync with badge color by type:

```javascript
// Badge colours by event type
const badgeCfg = {
  in:     { bg: '#dcfce7', color: '#15803d' },  // green
  out:    { bg: '#fef3c7', color: '#92400e' },  // amber
  access: { bg: '#dbeafe', color: '#1d4ed8' },  // blue
  system: { bg: '#f3f4f6', color: '#6b7280' },  // grey
};
```

**HTML element IDs:** `connectorLiveFeed`, `connectorLiveFeedBody`, `connectorLiveFeedCount`

#### Browse Device Events by Date Card
Date picker + "Fetch from Device" button. Uses **dual-path fetch**:

1. **Fast path (same-machine)** — tries `GET http://localhost:7663/api/query-events?date=YYYY-MM-DD` with a 4-second timeout. Returns immediately from the running connector.
2. **Firestore path (remote)** — writes `{ status: 'requested', date }` to `connector_event_query/current`, then polls the REST API every 1.5 s until `status === 'done'`, then reads `eventsJson`.

```javascript
async function queryDeviceEventsByDate() {
  const date = document.getElementById('deviceDateInput').value;
  // Fast path first
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`http://localhost:7663/api/query-events?date=${date}`, { signal: ctrl.signal });
    if (res.ok) {
      const json = await res.json();
      renderEvents(json.events || [], 'connector (local)');
      return;
    }
  } catch (_) { /* fall through to Firestore path */ }
  // Firestore path — write request, poll for result
  await setDoc(connector_event_query/current, { status: 'requested', date });
  // ...poll every 1.5s via REST API key fetch...
}
```

The REST endpoint `GET /api/query-events?date=YYYY-MM-DD` calls `fetchEventsForDate()` directly and returns:
```json
{ "events": [...parseDeviceEvent results...], "total": 3, "date": "2026-03-05" }
```

**HTML element IDs:** `deviceDateQueryCard`, `deviceDateInput`, `deviceDateBtn`, `deviceDateTitle`, `deviceDateCount`, `deviceDateStatus`, `deviceDateResults`, `deviceDateResultsBody`

**`initConnectorStatus()`** — called once when the Sync tab is opened. Sets up:
- Immediate REST fetch from `connector_status/current` (bypasses Firestore auth rules using API key URL)
- 30-second REST poll interval as fallback
- `onSnapshot` listener (if Firebase SDK available) — cancels the REST poller on success

---

### 10.8 Installation Files

#### Mac — `sync-agent/install-mac.command`
Double-click in Finder. The script:
1. Checks Node.js is installed (opens nodejs.org if not)
2. Copies files to `~/SmartClockConnector/`
3. Runs `npm install` in that directory
4. Creates `~/Library/LaunchAgents/co.smartclock.connector.plist` with `RunAtLoad=true`, `KeepAlive=true`
5. Runs `launchctl load` to start immediately
6. Opens `http://localhost:7663` in the browser for first-time setup

**LaunchAgent label:** `co.smartclock.connector`  
**Log files:** `~/SmartClockConnector/connector.log` and `connector-error.log`

To restart manually:
```bash
launchctl unload  ~/Library/LaunchAgents/co.smartclock.connector.plist
launchctl load    ~/Library/LaunchAgents/co.smartclock.connector.plist
```

#### Windows — `sync-agent/install-windows.bat` + `install-service.cjs`
Similar flow — installs to `%USERPROFILE%\SmartClockConnector\`, registers as a Windows service via node-windows so it runs at startup regardless of who is logged in.

---

### 10.9 Setup Wizard Flows (localhost:7663)

**First run** (no `connector-config.json` exists): Shows setup wizard with 4 steps:
1. **Login** — email + password — validated against Firestore `businesses` collection (API key query)
2. **LAN scan** — scans `{subnet}.1–254` in batches of 20 probing HTTPS port 443 then HTTP port 80 for `GET /ISAPI/System/deviceInfo` — 401 or 200 = Hikvision identified
3. **Device password** — user enters device admin password; connector tests it with a real `AcsEvent` call
4. **Done** — saves `connector-config.json`, starts sync loop

**Subsequent runs**: Loads config; starts sync immediately; shows status page at `localhost:7663`.

**Config file** (`~/SmartClockConnector/connector-config.json`):
```json
{
  "businessId": "biz_speaker_repairs_sa",
  "deviceIP": "192.168.0.114",
  "deviceUser": "admin",
  "devicePass": "...",
  "devicePort": 443,
  "deviceSerial": "FC4349999"
}
```

---

### 10.10 Building the Download Packages

After any change to `sync-agent.cjs`, rebuild the downloadable zips:

```bash
cd "/path/to/project/sync-agent"

# Mac package
zip -j ../src/downloads/smartclock-connector-mac.zip \
  sync-agent.cjs package.json install-mac.command

# Windows package
zip -j ../src/downloads/smartclock-connector.zip \
  sync-agent.cjs package.json install-windows.bat install-service.cjs

# Copy to running installation
cp sync-agent.cjs ~/SmartClockConnector/sync-agent.cjs

# Restart LaunchAgent
launchctl unload  ~/Library/LaunchAgents/co.smartclock.connector.plist
sleep 1
launchctl load    ~/Library/LaunchAgents/co.smartclock.connector.plist
```

---

### 10.11 Debugging the Connector

```bash
# View live log
tail -f ~/SmartClockConnector/connector.log

# Check if HTTP server is up
curl http://localhost:7663/health

# Test date query directly (bypasses Firestore)
curl "http://localhost:7663/api/query-events?date=2026-03-05"

# Verify connector heartbeat reached Firestore
# (replace YOUR-PROJECT and BIZ-ID)
curl "https://firestore.googleapis.com/v1/projects/YOUR-PROJECT/databases/(default)/documents/businesses/BIZ-ID/connector_status/current?key=YOUR-API-KEY"
```

**Common issues:**

| Symptom | Cause | Fix |
|---|---|---|
| No events for today on date browser | End time in query is `now()` (UTC) but device clock is UTC+2 | Use far future end: `2099-12-31T23:59:59` |
| Fingerprint events missing (only card swipes shown) | `major:5, minor:75` filter in AcsEventCond | Remove the major/minor filter entirely |
| `401` on every device request | Nonce cached after first request expires | Reset `_digestChallenge = null` before each new operation |
| Heartbeat wipes `recentEventsJson` | PATCH without `updateMask` replaces the whole document | Use `updateMask.fieldPaths=` per field |
| Dashboard shows connector offline but it's running | Dashboard uses `onSnapshot` which is blocked by Firestore rules | REST fallback at API key URL should still work — check console errors |

---

### 10.12 Constants to Change Per Client

In `sync-agent.cjs` (top of file):
```javascript
const FIREBASE_API_KEY = 'AIzaSy...'        // from Firebase project settings
const FIREBASE_PROJECT = 'YOUR-PROJECT-ID'  // e.g. smartclock-v2-8271f
```

In `src/pages/business-dashboard.html` — search for `FIREBASE_API_KEY` and `connector_status`:
The dashboard uses the same API key for REST reads of `connector_status/current`. Update whenever deploying to a new Firebase project.

---

### 10.13 New Client Connector Checklist

- [ ] Update `FIREBASE_API_KEY` and `FIREBASE_PROJECT` constants in `sync-agent.cjs`
- [ ] Rebuild zips: `zip -j ../src/downloads/smartclock-connector-mac.zip sync-agent.cjs package.json install-mac.command`
- [ ] `firebase deploy --only hosting` so the updated zip is downloadable from the new project
- [ ] Client installs connector on a machine that: (a) is on 24/7, (b) is on the same LAN as the device, (c) has internet access
- [ ] Client runs `install-mac.command` (Mac) or `install-windows.bat` (Windows)
- [ ] Verify green dot appears in dashboard within 2 minutes of install
- [ ] Test date browser: pick today's date → confirm events appear

---

## Key File Locations

| File | Purpose |
|---|---|
| `src/firebase-config.js` | Firebase project credentials |
| `src/pages/business-dashboard.html` | Main dashboard UI + live monitor |
| `functions/index.js` | Cloud Functions (attendanceWebhook, impersonation) |
| `import-history.cjs` | Historical device import script |
| `sync-agent/sync-agent.cjs` | SmartClock Connector — self-contained Node.js agent |
| `sync-agent/install-mac.command` | macOS installer (double-click to run) |
| `sync-agent/install-windows.bat` | Windows installer |
| `sync-agent/install-service.cjs` | Windows service helper |
| `sync-agent/package.json` | Connector dependencies (none — uses only Node built-ins) |
| `src/downloads/smartclock-connector-mac.zip` | Downloadable Mac connector package |
| `src/downloads/smartclock-connector.zip` | Downloadable Windows connector package |
| `.firebaserc` | Active Firebase project target |
| `firebase.json` | Hosting + functions config |
| `/root/hikvision-fanout.js` (VPS) | Fan-out relay — forwards to all Firebase projects |

---

## Useful Commands

```bash
# Deploy everything
firebase deploy

# Deploy functions only
firebase deploy --only functions

# Deploy hosting only
firebase deploy --only hosting

# Run historical import
node import-history.cjs

# Check VPS relay status
ssh root@69.62.109.168 "pm2 list"

# Restart fan-out relay
ssh root@69.62.109.168 "pm2 restart vps-fanout"

# View fan-out logs
ssh root@69.62.109.168 "pm2 logs vps-fanout --lines 50"

# Test device reachability
curl -sk https://192.168.0.114 -o /dev/null -w "%{http_code}"

# Get ALL events from device (no major/minor filter — gets everything)
curl -sk -X POST "https://192.168.0.114/ISAPI/AccessControl/AcsEvent?format=json" \
  --digest -u "admin:PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"AcsEventCond":{"searchID":"test","searchResultPosition":0,"maxResults":5,"startTime":"2026-03-01T00:00:00","endTime":"2099-12-31T23:59:59"}}'

# View connector log (on Mac after install)
tail -f ~/SmartClockConnector/connector.log

# Restart connector LaunchAgent (Mac)
launchctl unload  ~/Library/LaunchAgents/co.smartclock.connector.plist
launchctl load    ~/Library/LaunchAgents/co.smartclock.connector.plist

# Test connector REST endpoint
curl http://localhost:7663/health
curl "http://localhost:7663/api/query-events?date=2026-03-05"
```
