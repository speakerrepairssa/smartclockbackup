# Isolated Deployment Pattern Guide

## Problem
Every time a new module was deployed, it broke existing working components (VPS relay, cloud functions). The root cause was having 14 different relay files and 25 deployment scripts all deploying different versions simultaneously.

## Solution: Isolated Deployments
Each service is now deployed independently using Firebase's isolated codebase feature and dedicated deployment scripts.

---

## Current Architecture

### 1. VPS Relay (Hikvision Webhook Handler)
- **Code**: `vps/hikvision-relay.js`
- **Location**: VPS at 69.62.109.168:7660
- **Deploy Script**: `./deploy-vps-clean.sh`
- **Purpose**: Receives webhooks from Hikvision devices, forwards to Firebase
- **Status**: ✅ Working (deployed 2026-02-28)

### 2. Main Cloud Functions (Attendance Processing)
- **Code**: `functions/index.js`
- **Location**: Firebase us-central1
- **Deploy Command**: `firebase deploy --only functions`
- **Purpose**: Process attendance webhooks, handle business logic
- **Status**: ✅ Working (deployed 2026-02-28)

### 3. Payslips Service (Isolated Module)
- **Code**: `functions/payslips-service/`
- **Location**: Firebase us-central1
- **Deploy Script**: `./deploy-payslips.sh`
- **Purpose**: Generate and send payslips
- **Status**: ✅ Working (deployed 2026-02-28)

---

## Deployment Rules

### ⚠️ CRITICAL: Never deploy everything at once

**WRONG:**
```bash
firebase deploy  # Deploys EVERYTHING, breaks things
```

**RIGHT:**
```bash
# Deploy VPS relay only
./deploy-vps-clean.sh

# Deploy main functions only
firebase deploy --only functions

# Deploy payslips only
./deploy-payslips.sh
```

---

## How to Add New Modules

### Step 1: Create Isolated Service Directory
```bash
mkdir -p functions/new-module-service
cd functions/new-module-service
```

### Step 2: Create Separate package.json
```json
{
  "name": "new-module-service",
  "version": "1.0.0",
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^4.8.0"
  }
}
```

### Step 3: Configure Firebase Codebase
Edit `firebase.json`:
```json
{
  "functions": [
    {
      "codebase": "default",
      "source": "functions"
    },
    {
      "codebase": "payslips-service",
      "source": "functions/payslips-service"
    },
    {
      "codebase": "new-module-service",
      "source": "functions/new-module-service"
    }
  ]
}
```

### Step 4: Create Deployment Script
```bash
#!/bin/bash
# deploy-new-module.sh
set -e
echo "🚀 Deploying New Module Service"

# Install dependencies
cd functions/new-module-service
npm install
cd ../..

# Deploy ONLY this service
firebase deploy --only functions:new-module-service

echo "✅ New Module Deployment Complete!"
```

### Step 5: Make Script Executable
```bash
chmod +x deploy-new-module.sh
```

---

## Deployment Checklist

Before deploying ANY module:

- [ ] Verify you're using the correct deployment script
- [ ] Check current working status: `curl http://69.62.109.168:7660/health`
- [ ] Create backup commit: `git add -A && git commit -m "Backup before deployment"`
- [ ] Deploy ONLY the target module
- [ ] Verify other services still work after deployment
- [ ] Test the newly deployed module

---

## Quick Reference Commands

### Check VPS Relay Status
```bash
curl http://69.62.109.168:7660/health
sshpass -p 'Azam198419880001#' ssh root@69.62.109.168 'pm2 status'
```

### Check Firebase Functions
```bash
firebase functions:log --limit 10
```

### Rollback VPS Relay
```bash
./restore-vps-backup.sh
```

### View Deployed Functions
```bash
firebase functions:list
```

---

## Emergency Recovery

If a deployment breaks something:

### 1. VPS Relay Broken
```bash
./restore-vps-backup.sh
```

### 2. Main Functions Broken
```bash
git checkout c238643d  # Last working commit
firebase deploy --only functions
```

### 3. Payslips Broken
```bash
git checkout HEAD~1 -- functions/payslips-service/
./deploy-payslips.sh
```

---

## Historical Commits

- **7dbb4549** - Working VPS relay before cleanup
- **c238643d** - Firebase functions before payslips fix
- **Current** - All services isolated and working

---

## Why This Works

1. **Isolation**: Each service has its own `node_modules`, dependencies, and deployment path
2. **Targeted Deploys**: `--only functions:service-name` ensures only one service changes
3. **Clean Scripts**: Deployment scripts handle all cleanup and verification
4. **No Conflicts**: Services can't interfere with each other's code or processes

---

## Summary

**The golden rule:** Never deploy multiple services together. Always use isolated deployment scripts.

**Result:** You can now add/update payslips, other modules, or the VPS relay without breaking working components.
