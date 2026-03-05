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
URL: http://69.62.109.168:7662/admin-webhook
```

> ⚠️ Use HTTP (not HTTPS) for the VPS URL — the device sends to the VPS, the VPS uses HTTPS to Firebase.

### Test the device connection
```bash
curl -s http://69.62.109.168:7662/health
# Should return: {"status":"ok"}
```

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

---

## Part 9 — Known Limitations

### WiFi outage gap
The VPS relay requires internet to forward events. During an outage:
- Device continues recording events to its onboard storage
- VPS never receives them — they are missing from Firestore
- When internet restores, device resumes live pushes but does **not** replay missed ones

**Workaround:** Run `node import-history.cjs` after any known outage. It will detect and backfill only the missing events.

**Permanent fix (not yet built):** A local sync agent installed on a LAN machine at the client's site that polls the device every 15 minutes and auto-backfills gaps. Requires Node.js on a machine at each client site.

### Device HTTP slot limit
Hikvision devices typically support only 1 active HTTP push slot. The fan-out relay on the VPS solves this by accepting 1 inbound connection and forwarding to multiple Firebase projects simultaneously.

---

## Key File Locations

| File | Purpose |
|---|---|
| `src/firebase-config.js` | Firebase project credentials |
| `src/pages/business-dashboard.html` | Main dashboard UI + live monitor |
| `functions/index.js` | Cloud Functions (attendanceWebhook, impersonation) |
| `import-history.cjs` | Historical device import script |
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

# Get event count from device
curl -sk -X POST "https://192.168.0.114/ISAPI/AccessControl/AcsEvent?format=json" \
  --digest -u "admin:PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"AcsEventCond":{"searchID":"test","searchResultPosition":0,"maxResults":1,"major":5,"minor":75,"startTime":"2020-01-01T00:00:00","endTime":"2030-01-01T00:00:00"}}'
```
