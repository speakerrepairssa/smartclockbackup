# SmartClock — Project Architecture (READ THIS FIRST)

## Two Completely Separate Environments

| | SmartClock V2 (TEST) | AIClock (PRODUCTION) |
|---|---|---|
| **Purpose** | Development & testing | Live client app |
| **Firebase Project** | `smartclock-v2-8271f` | `aiclock-82608` |
| **Hosting URL** | `smartclock-v2-8271f.web.app` | `aiclock-82608.web.app` |
| **Firestore DB** | `smartclock-v2-8271f` (test data) | `aiclock-82608` (real client data) |
| **Realtime DB** | `smartclock-v2-8271f-default-rtdb` | `aiclock-82608-default-rtdb` |
| **Firebase config file** | `src/config/firebase.js` → points to `smartclock-v2-8271f` | Same file BUT swapped to `aiclock-82608` before deploying |

> **Both projects have the SAME code structure and views.**
> **They share the same VPS.**
> **Each has its OWN separate database — data does NOT cross over.**

---

## The Golden Rule: Test First, Then Deploy to Production

```
1. Make changes in this repo (smart clock v2)
2. Deploy to TEST only:   firebase deploy --only hosting --project smartclock-v2-8271f
3. Verify everything works on smartclock-v2-8271f.web.app
4. User approves
5. Deploy to PRODUCTION:  npm run deploy:aiclock   (uses the deploy script below)
    OR manually: swap config → deploy → swap back
```

**NEVER deploy to `aiclock-82608` while `firebase.js` still points to `smartclock-v2-8271f` — that would break the production site's database connection.**

---

## firebase.js — The Critical File

`src/config/firebase.js` must point to the correct project for whichever site you're deploying to.

**Current file (TEST — always leave it like this in this repo):**
```js
projectId: "smartclock-v2-8271f"   // ← TEST
```

**When deploying to aiclock (PRODUCTION), the deploy script temporarily swaps to:**
```js
projectId: "aiclock-82608"          // ← PRODUCTION
```

---

## Deploy Script

Use `npm run deploy:aiclock` to deploy to production safely.
The script (`deploy-to-aiclock.sh`) will:
1. Swap `firebase.js` to the aiclock config
2. Deploy to `aiclock-82608`
3. Restore `firebase.js` back to the test config immediately after

```bash
# Deploy to TEST only
firebase deploy --only hosting --project smartclock-v2-8271f

# Deploy to PRODUCTION (handles config swap automatically)
bash deploy-to-aiclock.sh
```

---

## Firebase Configs

### TEST — smartclock-v2-8271f
```js
{
  apiKey: "AIzaSyC6capPBwQDzIyp73i4ML0m9UwqjcfJ_WE",
  authDomain: "smartclock-v2-8271f.firebaseapp.com",
  projectId: "smartclock-v2-8271f",
  storageBucket: "smartclock-v2-8271f.firebasestorage.app",
  messagingSenderId: "994384787802",
  appId: "1:994384787802:web:e08a4db7ae7693c4199b63",
  measurementId: "G-TEXJFZERJ6"
}
```

### PRODUCTION — aiclock-82608
```js
{
  apiKey: "AIzaSyAmKmv9cmWEhTGpuxWxVu3vOKvpJLVUXx0",
  authDomain: "aiclock-82608.firebaseapp.com",
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.firebasestorage.app",
  messagingSenderId: "434208200088",
  appId: "1:434208200088:web:1ef0ac8a89a3e2cdd94a50"
}
```

---

## File Structure Notes

- `src/config/firebase.js` — **always keep pointing to TEST** in this repo
- `src/pages/monitor-v2.html` — imports `db` from `../config/firebase.js` (inherits correct project)
- `src/pages/business-dashboard.html` — imports `db` from `../config/firebase.js`
- All other pages/modules — same, they all use the shared firebase.js

---

## Common Mistakes To Avoid

| Mistake | Impact |
|---|---|
| Directly deploying to aiclock without swapping firebase.js | Production site reads from empty test DB — clients lose all data |
| Hardcoding `aiclock-82608` config inside any page | Works in production but breaks in test |
| Hardcoding `smartclock-v2-8271f` config inside any page | Works in test but breaks in production |
| Running `firebase deploy` without `--project` flag | Deploys to whichever project is set as default in `.firebaserc` |

---

## .firebaserc (Both projects registered)

```json
{
  "projects": {
    "default": "smartclock-v2-8271f",
    "aiclock": "aiclock-82608"
  }
}
```

Default is always test. Production requires explicit `--project aiclock-82608`.
