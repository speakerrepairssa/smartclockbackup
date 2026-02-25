# SmartClock AI - Continuation Development Notes MK2
## Complete System Documentation & Critical Insights

**Last Updated:** February 25, 2026  
**Commit:** 5d6eaeae - Complete ROI calculator with SEO optimization and pricing updates  
**Production URL:** https://aiclock-82608.web.app

---

## 📋 Table of Contents
1. [Application Overview](#application-overview)
2. [Technology Stack](#technology-stack)
3. [Critical Insights & Solutions](#critical-insights--solutions)
4. [Architecture & Data Flow](#architecture--data-flow)
5. [Authentication System](#authentication-system)
6. [Device Synchronization](#device-synchronization)
7. [Current Issues](#current-issues)
8. [Business Logic & Pricing](#business-logic--pricing)
9. [Deployment Information](#deployment-information)
10. [Future Improvements](#future-improvements)

---

## 🎯 Application Overview

SmartClock is a multi-tenant SaaS application for employee time and attendance management with Hikvision biometric device integration. The system serves three user types:
- **Admin Owner** (System Administrator)
- **Business Users** (Business owners managing employees)
- **Employees** (Self-service portal access)

### Core Functionality
- Real-time employee clock in/out monitoring
- Biometric device integration (Hikvision face recognition terminals)
- Automated payroll calculations and assessment reports
- WhatsApp notifications for clock events
- Multi-device support with cloud synchronization
- Shift management and scheduling
- Employee self-service portal (view timecards, payslips)

---

## 🛠 Technology Stack

### Frontend
- **Pure HTML/CSS/JavaScript** (No framework - modular ES6 imports)
- Responsive design with mobile-first approach
- Real-time updates via Firestore listeners

### Backend & Database
- **Firebase Hosting** (Static site delivery)
- **Cloud Firestore** (NoSQL database)
- **Firebase Functions** (Serverless backend for device proxy)

### Device Integration
- **Hikvision ISAPI** (HTTP/HTTPS REST API)
- **VPS Relay Server** at `69.62.109.168:7660` (HTTP proxy for HTTPS mixed content)

### Analytics & SEO
- **Google Analytics/Ads** (gtag.js tracking)
- Structured data (JSON-LD schema.org)
- Comprehensive meta tags for search visibility

---

## 🔥 Critical Insights & Solutions

### 1. **THE WORKING API - Device Event Synchronization**

#### WHY IT WORKS NOW (Critical Understanding):
The breakthrough came from using a **VPS relay proxy** combined with **Firebase Functions** to solve the HTTP/HTTPS mixed content problem.

**The Problem:**
- Hikvision devices use HTTP (not HTTPS)
- Firebase Hosting serves over HTTPS
- Browsers block HTTP requests from HTTPS pages (mixed content security)
- Direct device access from browser = ❌ Blocked

**The Solution That Works:**
```
[Browser (HTTPS)] 
    ↓
[Firebase Function (HTTPS endpoint)]
    ↓
[VPS Relay Server at 69.62.109.168:7660 (HTTP)]
    ↓
[Hikvision Device (HTTP on local network)]
```

**Key Files:**
- `src/modules/device-sync/device-sync-service.js` - Uses Firebase Function endpoint
- `functions/index.js` - Firebase Function proxies requests to VPS
- VPS runs Node.js relay server listening on port 7660

**Firebase Function Endpoint:**
```javascript
https://us-central1-aiclock-82608.cloudfunctions.net/deviceProxy
```

**Why Previous Attempts Failed:**
1. ❌ Direct HTTP calls from HTTPS page → Blocked by browser
2. ❌ CORS issues with device API → Device doesn't support CORS
3. ❌ Self-signed SSL certificates → Browser security warnings
4. ✅ **VPS HTTP relay + Firebase HTTPS proxy = Success!**

### 2. **MISSED CLOCKS WHEN DEVICE IS OFFLINE**

#### The Problem:
When a Hikvision device loses power or network connection, clock in/out events are stored locally on the device but not synced to Firestore until device comes back online.

#### The Solution:
**Historical Events Importer** - Retroactive sync when device reconnects.

**Key File:** `src/modules/direct-device-data/historical-events-importer.js`

**How It Works:**
1. Device stores events locally in internal memory (up to 100,000 events)
2. When device comes back online, admin uses "Import Historical Events" feature
3. System queries device ISAPI endpoint: `/ISAPI/AccessControl/AcsEvent`
4. Fetches events by date range (e.g., yesterday to today)
5. Parses XML response and creates Firestore documents for each missed event
6. Updates employee status and assessment data retroactively

**Usage:**
```javascript
// Access from Admin Dashboard → Device Manager → Import Historical Events
// Or from: src/pages/historical-events-importer.html

// Query parameters:
startTime: "2026-02-20T00:00:00"
endTime: "2026-02-25T23:59:59"
maxResults: 1000
```

**API Endpoint Used:**
```xml
POST http://192.168.1.64/ISAPI/AccessControl/AcsEvent
<AcsEventCond>
  <searchID>1</searchID>
  <searchResultPosition>0</searchResultPosition>
  <maxResults>1000</maxResults>
  <EventType>stringList</EventType>
  <startTime>2026-02-20T00:00:00</startTime>
  <endTime>2026-02-25T23:59:59</endTime>
</AcsEventCond>
```

**Critical Notes:**
- Device must be accessible on network
- Use VPS relay if calling from browser
- Events are deduplicated by timestamp + employeeId
- Assessment cache must be recalculated after import

---

## 🏗 Architecture & Data Flow

### Firestore Database Structure

```
businesses/{businessId}
  ├── (root document)
  │   ├── businessName
  │   ├── email
  │   ├── contactNumber ⭐ NEW
  │   ├── address ⭐ NEW
  │   ├── plan: "Free Trial"
  │   ├── slotsAllowed: 10
  │   ├── modulesAccess: {...} ⭐ NEW
  │   └── trialEndDate
  │
  ├── staff/{slotNumber}
  │   ├── employeeId
  │   ├── employeeName
  │   ├── badgeNumber (for device matching)
  │   ├── deviceId
  │   ├── payRate
  │   ├── active: true/false
  │   └── position
  │
  ├── status/{slotNumber}
  │   ├── attendanceStatus: "in" | "out"
  │   ├── lastClockTime
  │   ├── lastEventType: "checkin" | "checkout"
  │   └── deviceId
  │
  ├── attendance_events/{autoId}
  │   ├── employeeId
  │   ├── badgeNumber
  │   ├── eventType: "checkin" | "checkout"
  │   ├── timestamp
  │   ├── deviceId
  │   ├── source: "device" | "manual" | "import"
  │   └── processed: true/false
  │
  ├── assessment_cache/{YYYY-MM}
  │   ├── summary: { totalEmployees, totalHoursWorked, totalAmountDue }
  │   ├── employees: [{ employeeId, hoursWorked, amountDue, ... }]
  │   └── lastUpdated
  │
  ├── assessments_realtime/{YYYY-MM}
  │   ├── summary: { total, present, percentage }
  │   └── employees: { [employeeId]: { status, hours, ... } }
  │
  ├── devices/{deviceId}
  │   ├── deviceName
  │   ├── ip: "192.168.1.64"
  │   ├── port: 80
  │   ├── username
  │   ├── password
  │   ├── status: "active" | "offline"
  │   └── lastSync
  │
  ├── settings/general
  │   ├── workStartTime: "08:30"
  │   ├── workEndTime: "17:30"
  │   ├── breakDuration: 60
  │   └── timezone: "Africa/Johannesburg"
  │
  └── whatsapp_templates/{templateId}
      ├── trigger: "clock-out"
      ├── message: "Hi {{employeeName}}, ..."
      └── active: true/false
```

### Module Access Control ⭐ NEW

When a business registers, they now get default module access:

```javascript
modulesAccess: {
  // ✅ Enabled by default (Free Trial):
  dashboard: true,
  employees: true,
  monitor: true,
  assessment: true,
  shifts: true,
  timecards: true,
  punches: true,
  whatsapp: true,
  
  // ❌ Disabled by default (Admin enables):
  reports: false,
  payroll: false,
  settings: false,
  devices: false,
  credentials: false,
  locationTracking: false
}
```

---

## 🔐 Authentication System

**File:** `src/modules/auth/auth.service.js`

### Three Authentication Types:

1. **Admin Owner Login**
   - Hardcoded credentials (for system admin only)
   - Email: `info@simplewebhost.co.za`
   - Role: `admin`
   - Access: All businesses, all modules

2. **Business User Login**
   - Email/password authentication
   - Queries Firestore: `businesses` collection
   - Role: `business`
   - Access: Own business data only, limited by `modulesAccess`

3. **Employee Login**
   - businessId + username/badgeNumber + password
   - Queries: `businesses/{businessId}/staff` collection
   - Role: `employee`
   - Access: Personal data only (timecards, payslips)

### Session Management
```javascript
// Stored in sessionStorage:
sessionStorage.setItem("userRole", "business");
sessionStorage.setItem("businessId", "biz_xxx");
sessionStorage.setItem("businessName", "Company Name");
```

### New Business Registration Flow ⭐ UPDATED

**File:** `src/pages/admin-register.html`

**NEW Fields Added:**
- Contact Number (required)
- Business Address (required)

**Auto-Configuration:**
1. Creates business document with 10 employee slots
2. Initializes 8 collections:
   - `staff` (10 empty slots)
   - `status` (10 status records)
   - `attendance_events` (ready marker)
   - `assessment_cache` (current month)
   - `assessments_realtime` (current month)
   - `devices` (placeholder)
   - `settings` (work hours, timezone)
   - `whatsapp_templates` (notification templates)
3. Sets `modulesAccess` with default enabled modules
4. Plan: "Free Trial" (30 days)
5. Monthly fee: R0 during trial

---

## 📡 Device Synchronization

### Current HTTP vs HTTPS Issue Explained

**The Challenge:**
Hikvision devices communicate over HTTP (port 80) but Firebase Hosting requires HTTPS. Browsers block mixed content (HTTP requests from HTTPS pages).

**Current Working Solution:**
```
┌─────────────────────────────────────────────────────────┐
│  Browser (HTTPS)                                        │
│  https://aiclock-82608.web.app                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼ (HTTPS Request)
┌─────────────────────────────────────────────────────────┐
│  Firebase Function (HTTPS)                              │
│  us-central1-aiclock-82608.cloudfunctions.net          │
│  /deviceProxy                                           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼ (HTTP Request)
┌─────────────────────────────────────────────────────────┐
│  VPS Relay Server (HTTP)                                │
│  69.62.109.168:7660                                     │
│  Node.js Express Server                                 │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼ (HTTP Request to Local Network)
┌─────────────────────────────────────────────────────────┐
│  Hikvision Device (HTTP)                                │
│  192.168.1.64:80 (or customer's local IP)              │
│  ISAPI Endpoints                                        │
└─────────────────────────────────────────────────────────┘
```

### Device Sync Service

**File:** `src/modules/device-sync/device-sync-service.js`

**Key Methods:**
```javascript
// Real-time event polling (every 5 seconds)
startDeviceSync(businessId, deviceConfig)

// Manual sync trigger
syncDeviceEvents(businessId, deviceId)

// Process individual event
processDeviceEvent(businessId, event)
```

**Event Processing Flow:**
1. Poll device: `GET /ISAPI/AccessControl/AcsEvent`
2. Parse XML response
3. Extract: `employeeNo` (badgeNumber), `eventType`, `time`
4. Match employee: Query `staff` collection by `badgeNumber`
5. Create `attendance_events` document
6. Update `status` document (in/out status)
7. Update `assessment_cache` (hours worked)
8. Trigger WhatsApp notification (if enabled)

---

## 🚨 Current Issues & Known Bugs

### 1. HTTP/HTTPS Mixed Content (Partially Resolved)
**Status:** ✅ Working via VPS relay  
**Issue:** Direct browser → device communication still blocked  
**Workaround:** All requests go through Firebase Function → VPS → Device  
**Future:** Consider VPN solution or device HTTPS upgrade

### 2. Device Offline Detection
**Status:** ⚠️ Needs Improvement  
**Issue:** System doesn't auto-detect when device goes offline  
**Current:** Manual check required  
**Suggestion:** Implement heartbeat ping every 60 seconds, mark device offline if 3 consecutive failures

### 3. Assessment Cache Calculation Race Conditions
**Status:** ⚠️ Occasional Data Inconsistency  
**Issue:** Multiple simultaneous clock events can cause calculation errors  
**Files Affected:** `src/modules/assessment/assessment-manager.js`  
**Solution Needed:** Implement Firestore transaction-based updates or queue system

### 4. WhatsApp Integration Requires Manual Setup
**Status:** ⚠️ User Experience Issue  
**Issue:** Business must manually configure WhatsApp Cloud API credentials  
**Files:** `src/pages/whatsapp-settings.html`  
**Improvement:** Provide setup wizard with step-by-step guidance

### 5. Time Zone Handling
**Status:** ⚠️ Hardcoded to Africa/Johannesburg  
**Issue:** International businesses can't use different timezones  
**Fix Location:** `src/modules/settings/settings.service.js`  
**Suggestion:** Make timezone selectable in business settings

---

## 💰 Business Logic & Pricing

### Current Pricing Model (Updated Feb 25, 2026)

**Base Software Subscription:**
- 1-10 employees: **R450/month** (reduced from R600)
- 11+ employees: **R450 + (R50 × additional employees)**
- Example: 25 employees = R450 + (15 × R50) = **R1,200/month**

**Device Rental Options:**
```
Basic System        +R400/month
Standard System     +R750/month  (reduced from R800)
Professional System +R950/month  (reduced from R1,100)
Enterprise System   +R2,500/month
```

**Free Trial:**
- 1 month free (30 days)
- Up to 10 employees
- All core modules enabled
- No credit card required
- No device rental included (software only)

### ROI Calculator Logic

**File:** `src/index.html` (embedded JavaScript)

**Inputs:**
- Number of Employees (1-100)
- Average Hourly Wage (R25-R500)
- Employee Late By (0-30 mins)
- Employee Leaves Early (0-30 mins)
- Device Package Selection

**Calculations:**
```javascript
// Time theft per day
timeTheftMinutes = lateMinutes + earlyMinutes
timeTheftHours = timeTheftMinutes / 60

// Monthly loss (22 working days)
dailyLossPerEmployee = hourlyWage × timeTheftHours
monthlyLoss = dailyLossPerEmployee × numEmployees × 22

// Yearly loss
yearlyLoss = monthlyLoss × 12

// System cost
employeeCost = numEmployees <= 10 ? 450 : 450 + ((numEmployees - 10) × 50)
monthlyCost = employeeCost + deviceCost
yearlyCost = monthlyCost × 12

// ROI
savings = yearlyLoss - yearlyCost
roi = (savings / yearlyCost) × 100
roiMultiplier = yearlyLoss / yearlyCost
```

**Additional Benefits Highlighted:**
- 90% reduction in payroll processing time
- 70% reduction in staff queries and admin work

---

## 🚀 Deployment Information

### Firebase Hosting
**Project ID:** `aiclock-82608`  
**Hosting URL:** https://aiclock-82608.web.app  
**Deploy Command:** `firebase deploy --only hosting`

**Deployed Files:** (`src/` directory)
- index.html (landing page)
- pages/*.html (dashboard, login, registration)
- modules/*.js (ES6 modules)
- styles/main.css
- images/*.webp (device images)
- sitemap.xml ⭐ NEW
- robots.txt ⭐ NEW

### Firebase Functions
**Region:** us-central1  
**Function:** `deviceProxy`  
**Purpose:** HTTPS proxy for HTTP device requests  
**Deploy Command:** `firebase deploy --only functions`

### VPS Relay Server
**IP:** 69.62.109.168  
**Port:** 7660  
**Purpose:** HTTP relay to local network devices  
**Update Scripts:**
- `update-vps-relay.sh`
- `deploy-vps-direct.sh`
- `quick-vps-update.sh`

---

## 🔍 SEO Optimization (Newly Added)

### Meta Tags & Structured Data
**File:** `src/index.html`

**Added:**
1. **Keywords meta tag** - Target search terms (employee clocking, time attendance, payroll)
2. **Canonical URL** - Prevents duplicate content
3. **Open Graph tags** - Social media previews (Facebook, LinkedIn)
4. **Twitter Card tags** - Enhanced Twitter previews
5. **Schema.org JSON-LD** - Rich snippets in Google:
   - SoftwareApplication schema (pricing, features, ratings)
   - Organization schema (business info)

### Sitemap & Robots
- **sitemap.xml** - Lists all indexable pages with priority
- **robots.txt** - Guides search crawlers, allows public pages, blocks /modules/ and /config/

### Google Analytics Integration
**Tag ID:** AW-17975053261

**Tracking:**
- Page views on landing page
- Registration conversions
- Click events on CTA buttons

**Conversion Event:** Fires on successful registration
```javascript
gtag('event', 'conversion', {
  'send_to': 'AW-17975053261/YOUR_CONVERSION_LABEL',
  'value': 1.0,
  'currency': 'ZAR',
  'transaction_id': businessId
});
```

⚠️ **TODO:** Replace `YOUR_CONVERSION_LABEL` with actual label from Google Ads

---

## 🔮 Future Improvements

### High Priority
1. **Device HTTPS Support**
   - Upgrade devices to support HTTPS
   - Install valid SSL certificates on devices
   - Eliminate VPS relay dependency

2. **Real-time Offline Detection**
   - Implement device heartbeat monitoring
   - Auto-update device status in UI
   - Send alerts when device goes offline

3. **Assessment Calculation Queue**
   - Move calculations to Firebase Functions
   - Use Cloud Tasks for queue processing
   - Prevent race conditions

4. **Multi-timezone Support**
   - Make timezone configurable per business
   - Store all times in UTC
   - Display in business's local timezone

### Medium Priority
5. **Mobile App (Native)**
   - React Native or Flutter
   - Push notifications for clock events
   - Biometric authentication
   - Offline mode for employees

6. **Advanced Reporting**
   - Custom report builder
   - PDF generation
   - Email scheduled reports
   - Export to Excel/CSV

7. **Payroll Integration**
   - Integrate with Sage, Xero, QuickBooks
   - Automated tax calculations
   - Direct bank file generation

8. **WhatsApp Setup Wizard**
   - Step-by-step WhatsApp Cloud API setup
   - Automatic webhook configuration
   - Template message approval assistant

### Low Priority
9. **Dark Mode**
   - User preference toggle
   - Persistent setting across sessions

10. **Multi-language Support**
    - Afrikaans translation
    - isiZulu translation
    - Dynamic language switcher

---

## 📝 Developer Notes

### Code Style & Conventions
- ES6 module imports (no bundler)
- Async/await for Firestore operations
- sessionStorage for authentication state
- Firestore listeners for real-time updates

### Important Files Reference
```
src/
├── index.html                          # Landing page + ROI calculator
├── pages/
│   ├── admin-register.html            # New business registration ⭐ UPDATED
│   ├── business-dashboard.html        # Main business UI
│   ├── login.html                     # Multi-role login
│   ├── employee-login.html            # Employee portal login
│   └── historical-events-importer.html # Missed clocks recovery
├── modules/
│   ├── auth/
│   │   └── auth.service.js            # Authentication logic ⭐ UPDATED
│   ├── device-sync/
│   │   └── device-sync-service.js     # Device communication
│   ├── assessment/
│   │   └── assessment-manager.js      # Payroll calculations
│   └── direct-device-data/
│       └── historical-events-importer.js # Offline event recovery
├── config/
│   └── firebase.js                    # Firebase initialization
├── sitemap.xml                        # SEO sitemap ⭐ NEW
└── robots.txt                         # Search engine directives ⭐ NEW
```

### Testing Device Connectivity
```bash
# Test device accessibility
curl -u admin:password123 http://192.168.1.64/ISAPI/System/deviceInfo

# Test through VPS relay
curl http://69.62.109.168:7660/proxy?url=http://192.168.1.64/ISAPI/System/deviceInfo

# Test Firebase Function proxy
curl -X POST https://us-central1-aiclock-82608.cloudfunctions.net/deviceProxy \
  -H "Content-Type: application/json" \
  -d '{"deviceUrl": "http://192.168.1.64/ISAPI/System/deviceInfo"}'
```

---

## 🎯 Quick Start for Next Developer

### Setup Development Environment
```bash
# Clone repository
git clone https://github.com/speakerrepairssa/aiclock.git
cd aiclock

# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Test locally
firebase serve --only hosting

# Deploy
firebase deploy --only hosting
```

### Common Development Tasks

**1. Add New Module to Dashboard:**
```javascript
// File: src/pages/business-dashboard.html
// Add to sidebar menu:
<li>
  <button class="menu-btn" data-module="newmodule" onclick="switchModule('newmodule')">
    🆕 New Module
  </button>
</li>

// Check modulesAccess in auth.service.js
if (businessData.modulesAccess && businessData.modulesAccess.newmodule) {
  // Show module
}
```

**2. Add New Device API Endpoint:**
```javascript
// File: src/modules/device-sync/device-sync-service.js
async function callDeviceAPI(endpoint) {
  const response = await fetch('https://us-central1-aiclock-82608.cloudfunctions.net/deviceProxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceUrl: `http://${deviceIp}${endpoint}`,
      method: 'GET'
    })
  });
  return await response.json();
}
```

**3. Debug Authentication Issues:**
```javascript
// Check session storage in browser console:
console.log('Role:', sessionStorage.getItem('userRole'));
console.log('Business ID:', sessionStorage.getItem('businessId'));

// Check Firestore business document
// Firebase Console → Firestore → businesses/{businessId}
```

---

## 🐛 Known Quirks & Gotchas

1. **Badge Number Matching:** Device sends `employeeNo` which must exactly match `badgeNumber` in Firestore staff collection (case-sensitive, whitespace-sensitive)

2. **Assessment Cache Timing:** Cache updates happen at midnight South Africa time. Manual recalculation required if events are imported for past dates.

3. **Device Clock Drift:** Hikvision devices can have time drift. Sync device time with NTP server to prevent clock event timestamp mismatches.

4. **Firestore Listener Limits:** Each dashboard page creates multiple real-time listeners. Limit open tabs to prevent quota exhaustion.

5. **WhatsApp Template Approval:** WhatsApp Cloud API requires template message approval before use. Allow 24-48 hours for Meta review.

6. **VPS Relay Security:** Current relay has no authentication. Anyone with IP:port can proxy requests. TODO: Add API key validation.

---

## 📚 Additional Resources

- **Firebase Documentation:** https://firebase.google.com/docs
- **Hikvision ISAPI Manual:** (Client should have device manual)
- **WhatsApp Cloud API:** https://developers.facebook.com/docs/whatsapp
- **Google Search Console:** https://search.google.com/search-console
- **Schema.org Markup:** https://schema.org/SoftwareApplication

---

## ✅ Completed in This Session

- ✅ ROI Calculator with dual comparison (loss vs cost)
- ✅ Split time theft into late arrival + early departure sliders
- ✅ Updated pricing: R450 base, R750 standard, R950 professional
- ✅ Added contact number and address to registration
- ✅ Set default 10 employee slots for new businesses
- ✅ Implemented module access control system
- ✅ Integrated Google Analytics/Ads tracking
- ✅ Added comprehensive SEO meta tags and structured data
- ✅ Created sitemap.xml and robots.txt
- ✅ Updated color scheme to match site branding
- ✅ Added time savings benefits (90% payroll, 70% admin)
- ✅ Deployed all changes to production

---

## 🔒 Credentials & Access

**Firebase Project:** aiclock-82608  
**Admin Email:** info@simplewebhost.co.za  
**VPS IP:** 69.62.109.168 (Port 7660)  
**GitHub Repo:** https://github.com/speakerrepairssa/aiclock

⚠️ **Security Note:** Credentials in auth.service.js are hardcoded. Move to environment variables or Firebase Remote Config for production security.

---

## 📞 Support & Continuation

For the next developer picking up this project:

1. Read this document thoroughly
2. Test device connectivity using curl commands above
3. Review Firebase Firestore structure
4. Understand the VPS relay architecture
5. Check current issues list for priorities
6. Test historical events import feature
7. Verify WhatsApp integration setup

**Most Critical Understanding:**
The VPS relay at `69.62.109.168:7660` is the key to device communication. If it goes down, all device sync stops. Ensure VPS is monitored and has auto-restart configured.

---

**Document Version:** 2.0  
**Author:** GitHub Copilot + Development Team  
**Date:** February 25, 2026  
**Next Review:** When new major features are added

---

*This document should be updated whenever significant changes are made to the architecture, especially regarding device communication or authentication.*
