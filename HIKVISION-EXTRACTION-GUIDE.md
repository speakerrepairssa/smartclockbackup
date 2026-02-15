# 🎯 **HIKVISION ATTENDANCE EVENT EXTRACTION - COMPREHENSIVE GUIDE**

## **📋 EXECUTIVE SUMMARY**

Based on your device showing a web interface at `/doc/index.html#!/eventSearch` with employee data but returning "Invalid Operation" for ISAPI calls, your device is likely an **older/custom firmware** that uses **proprietary web-based protocols** rather than standard ISAPI.

## **🔧 IMMEDIATE ACTION PLAN**

### **1. QUICK DIAGNOSTIC TEST**

Run this command to test your current device:

```bash
cd /Users/azammacair/Dropbox/projects\ development/aiclock
node comprehensive-hikvision-extractor.js
```

### **2. WEB INTERFACE ANALYSIS** (Most Likely Solution)

Your device uses the pattern `/doc/index.html#!/eventSearch` which suggests a **legacy web interface**. Here's how to extract from it:

```javascript
// Method 1: Direct Web Interface Scraping
const puppeteer = require('puppeteer');

async function extractFromWebInterface() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Login
  await page.goto('http://192.168.0.114/doc/page/login.asp');
  await page.type('input[name="username"]', 'admin');
  await page.type('input[name="password"]', 'Azam198419880001');
  await page.click('input[type="submit"]');
  
  // Navigate to event search
  await page.goto('http://192.168.0.114/doc/index.html#!/eventSearch');
  
  // Wait for data to load
  await page.waitForTimeout(3000);
  
  // Extract event data
  const events = await page.evaluate(() => {
    // Look for employee data like "qaasiem", "az8", "luq"
    const elements = document.querySelectorAll('[data-employee], .employee-row, .event-row');
    return Array.from(elements).map(el => ({
      employee: el.textContent.trim(),
      timestamp: el.getAttribute('data-time') || 'unknown',
      type: el.getAttribute('data-type') || 'attendance'
    }));
  });
  
  await browser.close();
  return events;
}
```

### **3. NETWORK TRAFFIC ANALYSIS**

**Step 1: Monitor Web Interface Traffic**

```bash
# Install network monitoring
npm install puppeteer-har

# Create traffic analyzer
node analyze-web-traffic.js
```

**Step 2: Find the Real API Endpoints**

The web interface likely makes AJAX calls to hidden endpoints. Common patterns:

```javascript
// Hidden endpoints often found in older Hikvision devices
const hiddenEndpoints = [
  '/doc/page/attendance_log.asp',
  '/goform/FormAttendanceLog',
  '/attendance/getRecords.json',
  '/cgi-bin/attendance.cgi',
  '/api/attendance/events'
];
```

### **4. FIRMWARE-SPECIFIC APPROACHES**

**For Older Firmware (Pre-V5.5):**
```javascript
// Use CGI interface
GET /cgi-bin/guestAccess.cgi?action=getAttendanceLog
POST /cgi-bin/guestAccess.cgi
  action=getAttendanceLog&startTime=2026-01-01&endTime=2026-02-10
```

**For Custom/OEM Firmware:**
```javascript
// Check for alternative interfaces
GET /api/v1/attendance/records
GET /webapi/attendance/events  
GET /data/attendance.json
```

## **💡 SPECIFIC SOLUTIONS BY DEVICE TYPE**

### **Solution A: Legacy ASP Interface (Most Likely)**

```javascript
const axios = require('axios');

async function extractFromASP() {
  // Step 1: Login and get session
  const loginResponse = await axios.post(
    'http://192.168.0.114/doc/page/login.asp',
    'username=admin&password=Azam198419880001',
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      withCredentials: true
    }
  );
  
  const cookies = loginResponse.headers['set-cookie'];
  
  // Step 2: Access attendance data endpoint
  const dataResponse = await axios.get(
    'http://192.168.0.114/doc/page/attendance_log.asp',
    {
      headers: { 'Cookie': cookies.join('; ') }
    }
  );
  
  return parseASPResponse(dataResponse.data);
}

function parseASPResponse(html) {
  // Extract employee data from HTML/JavaScript
  const eventRegex = /employee.*?(\w+).*?(\d{4}-\d{2}-\d{2})/g;
  const events = [];
  let match;
  
  while ((match = eventRegex.exec(html)) !== null) {
    events.push({
      employee: match[1],
      timestamp: match[2],
      source: 'asp-interface'
    });
  }
  
  return events;
}
```

### **Solution B: JavaScript Variable Extraction**

```javascript
async function extractFromJavaScript() {
  const response = await axios.get('http://192.168.0.114/doc/index.html');
  const html = response.data;
  
  // Look for JavaScript variables containing event data
  const jsDataRegex = /var\s+(\w*[Ee]vent\w*|.*[Aa]ttendance.*)\s*=\s*(\[.*?\]|\{.*?\})/gs;
  const matches = [...html.matchAll(jsDataRegex)];
  
  for (const match of matches) {
    try {
      const data = JSON.parse(match[2]);
      return processEventData(data);
    } catch (e) {
      continue;
    }
  }
  
  return [];
}
```

### **Solution C: Form Data Submission**

```javascript
async function extractViaFormSubmission() {
  // Many older devices use form-based data retrieval
  const formData = new FormData();
  formData.append('action', 'getEvents');
  formData.append('startDate', '2026-01-01');
  formData.append('endDate', '2026-02-10');
  formData.append('type', 'attendance');
  
  const response = await axios.post(
    'http://192.168.0.114/goform/FormAttendanceLog',
    formData,
    {
      headers: {
        'Cookie': sessionCookies,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  
  return parseFormResponse(response.data);
}
```

## **🚨 TROUBLESHOOTING GUIDE**

### **Common Issues & Solutions**

**1. "Invalid Operation" Error**
```
❌ Problem: ISAPI endpoints return "Invalid Operation"
✅ Solution: Device uses proprietary web interface, not standard ISAPI
   → Use web scraping or hidden endpoints
```

**2. "401 Unauthorized"**
```
❌ Problem: Authentication failing
✅ Solutions:
   → Try web form login instead of HTTP auth
   → Check for special characters in password
   → Use session cookies from web login
```

**3. "No Events Found"**
```
❌ Problem: Endpoints respond but return no events
✅ Solutions:
   → Check date format requirements
   → Try different event type parameters
   → Look for pagination parameters
```

**4. "Connection Timeout"**
```
❌ Problem: Requests timing out
✅ Solutions:
   → Increase timeout to 30+ seconds
   → Check firewall/network issues
   → Try different port (443 for HTTPS)
```

### **Device Model Variations**

**DS-K1T80X Series (Access Control):**
- Uses: `/ISAPI/AccessControl/AcsEvent`
- Auth: Digest Authentication
- Format: XML with `<InfoList>` nodes

**DS-7600/7700 NVR Series:**
- Uses: `/ISAPI/ContentMgmt/search`
- Auth: Basic + Session
- Format: Search-based pagination

**Custom/OEM Devices:**
- Uses: Proprietary web interface
- Auth: Form-based login
- Format: HTML/JavaScript data

## **🔍 ADVANCED DEBUGGING**

### **Network Traffic Capture**

```bash
# Install Wireshark or use browser dev tools
# 1. Open browser dev tools (F12)
# 2. Go to Network tab
# 3. Login to device web interface
# 4. Navigate to event/attendance section
# 5. Look for AJAX/API calls in network log
```

### **JavaScript Console Analysis**

```javascript
// In browser console on device web page
console.log('Available functions:', Object.getOwnPropertyNames(window).filter(name => name.includes('event') || name.includes('attendance')));

// Look for global variables
Object.keys(window).filter(key => typeof window[key] === 'object' && window[key] !== null);
```

## **📊 EXPECTED DATA FORMATS**

### **Standard ISAPI Response**
```xml
<AcsEventList>
  <InfoList>
    <employeeNoString>qaasiem</employeeNoString>
    <time>2026-02-10T09:30:00</time>
    <type>1</type>
    <name>Employee Name</name>
  </InfoList>
</AcsEventList>
```

### **Legacy Web Response**
```html
<tr>
  <td>qaasiem</td>
  <td>2026-02-10 09:30:00</td>
  <td>Check In</td>
</tr>
```

### **JSON API Response**
```json
{
  "events": [
    {
      "employee": "qaasiem",
      "timestamp": "2026-02-10T09:30:00Z",
      "type": "checkin"
    }
  ]
}
```

## **🎯 IMPLEMENTATION PRIORITY**

**Priority 1: Web Interface Scraping** ⭐⭐⭐⭐⭐
- Most likely to work with your device
- Can extract the "qaasiem", "az8", "luq" data you see

**Priority 2: Hidden Endpoint Discovery** ⭐⭐⭐⭐
- Find the real API calls made by web interface
- More reliable than scraping

**Priority 3: Form-Based Extraction** ⭐⭐⭐
- Works with older ASP/CGI based systems
- May require reverse engineering

**Priority 4: ISAPI Alternatives** ⭐⭐
- Try different ISAPI variations
- Some devices have non-standard implementations

## **🚀 READY-TO-USE COMMANDS**

```bash
# Test the comprehensive extractor
cd /Users/azammacair/Dropbox/projects\ development/aiclock
node comprehensive-hikvision-extractor.js

# If that fails, try web interface analysis
npm install puppeteer
node analyze-web-interface.js

# For debugging, check network traffic
curl -v -u admin:Azam198419880001 "http://192.168.0.114/doc/index.html" > debug.html
```

## **📞 NEXT STEPS**

1. **Run the comprehensive extractor** to test all methods
2. **Analyze web traffic** to find hidden endpoints  
3. **Implement web scraping** as fallback
4. **Set up HTTP notifications** for real-time events
5. **Document working method** for production use

The key insight is that your device likely uses a **proprietary web interface** rather than standard ISAPI, which is common in older or custom firmware devices. The solution is to reverse engineer the web interface to find the actual data endpoints.