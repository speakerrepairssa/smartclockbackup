# WhatsApp Module Documentation

## Overview

The WhatsApp module provides automated messaging to employees when they clock out, sending them their daily payroll assessment data via WhatsApp using the Meta Business WhatsApp Cloud API.

## Architecture

### Core Components

1. **HTTP Webhook Trigger** (`attendanceWebhook`)
   - Entry point for attendance events from Hikvision devices
   - Processes clock-in and clock-out events
   - Triggers WhatsApp messages for clock-out events

2. **Assessment Cache** (`businesses/{businessId}/assessment_cache/{YYYY-MM}`)
   - Monthly cached employee payroll data
   - Includes: hours worked, income due, pay rates, contact info
   - Updated after each attendance event

3. **WhatsApp Sender** (`sendWhatsAppMessage`)
   - Maps employee data to template parameters
   - Sends messages via WhatsApp Cloud API
   - Handles multiple recipients and validation

4. **Frontend Trigger** (`business-dashboard.html`)
   - Monitors employee status changes in real-time
   - Loads assessment cache on clock-out
   - Calls WhatsApp function via HTTPS

### Data Flow

```
Employee Clock-Out Event
    ↓
attendanceWebhook (HTTP Trigger)
    ↓
processAttendanceEvent()
    ├─ Update attendance record
    ├─ Fetch assessment cache
    └─ Extract employee data (phone, email, payroll)
    ↓
sendWhatsAppMessage() [via HTTPS]
    ├─ Map employee data to template parameters
    ├─ Validate phone numbers
    ├─ Format message text
    └─ Call WhatsApp Cloud API
    ↓
WhatsApp Message Delivered to Employee
```

### Alternative Frontend Flow

```
Frontend Status Listener (business-dashboard.html)
    ↓
Detects status change to "clocked out"
    ↓
Load assessment cache for current month
    ↓
Find employee in cache.employees array
    ↓
Construct employeeDataToSend object
    ├─ phone (from cache)
    ├─ email (from cache)
    ├─ currentIncomeDue
    ├─ currentHours
    ├─ payRate
    └─ other payroll fields
    ↓
Call sendWhatsAppMessage via fetch()
    ↓
WhatsApp Message Delivered
```

## Code Structure

### 1. Cache Calculation (`/functions/cacheCalculation.js`)

**Purpose**: Calculate and structure employee assessment data for caching

**Key Function**: `calculateSingleEmployeeAssessment()`

**Returns** (lines ~465-485):
```javascript
{
  employeeId,
  employeeName,
  phone: employee.phone || null,        // Added for WhatsApp
  email: employee.email || null,        // Added for WhatsApp
  shiftId,
  shiftName,
  currentHours,
  requiredHours,
  hoursShort,
  payRate,
  dailyMultipliers: { ... },
  currentIncomeDue,
  pastDueIncome,
  totalOwed,
  status
}
```

**Called By**:
- `processAttendanceEvent()` after attendance updates
- Manual cache refresh operations

### 2. Main Functions (`/functions/index.js`)

#### `attendanceWebhook` (HTTP Trigger)
- **Line**: ~400-500
- **Purpose**: Receives attendance events from devices
- **Calls**: `processAttendanceEvent()`

#### `processAttendanceEvent()` (lines ~770-890)
- **Purpose**: Process clock-in/out and trigger actions
- **For Clock-Out**:
  1. Fetch assessment cache for current month
  2. Extract employee data from cache
  3. Add fields: requiredHours, currentIncomeDue, dailyMultipliers, payRate, phone
  4. Call `sendWhatsAppMessage()` via HTTPS

#### `onEmployeeStatusChange` (line ~5028)
- **Status**: ⚠️ DISABLED
- **Reason**: Prevented duplicate messages (now handled by attendanceWebhook with richer data)
- **Code**: Early return added

#### `sendWhatsAppMessage()` (lines ~2188-2400)
- **Purpose**: Send WhatsApp messages using Cloud API
- **Key Logic**:
  1. Extract recipients from `toNumbers` or `employeeData.phone`
  2. Fetch WhatsApp automation card from Firestore
  3. Map template parameters from employeeData
  4. Validate and format message
  5. Call Meta Business API
  6. Return success/failure status

### 3. Frontend Dashboard (`/src/pages/business-dashboard.html`)

**Status Change Listener** (lines ~3590-3680):

```javascript
// Listen for employee status changes
employeeStatusRef.on('value', (snapshot) => {
  const status = snapshot.val();
  
  if (status === 'clocked out') {
    // Load assessment cache
    const cacheRef = firebase.database()
      .ref(`businesses/${businessId}/assessment_cache/${currentMonth}`);
    
    cacheRef.once('value', (cacheSnapshot) => {
      const cache = cacheSnapshot.val();
      const employeeAssessmentData = cache.employees.find(
        emp => emp.employeeId === employeeId
      );
      
      // Construct data with cached contact info
      const employeeDataToSend = {
        employeeId,
        employeeName,
        phone: employeeAssessmentData.phone || null,  // From cache
        email: employeeAssessmentData.email || null,  // From cache
        currentIncomeDue: employeeAssessmentData.currentIncomeDue,
        currentHours: employeeAssessmentData.currentHours,
        payRate: employeeAssessmentData.payRate,
        // ... other fields
      };
      
      // Call WhatsApp function
      fetch(whatsappFunctionUrl, {
        method: 'POST',
        body: JSON.stringify(employeeDataToSend)
      });
    });
  }
});
```

### 4. WhatsApp Settings UI (`/src/pages/whatsapp-settings.html`)

**Purpose**: Configure WhatsApp automations and test messages

**Key Features**:
- Create/edit automation cards
- Map template parameters to employee data fields
- Test mode with sample data generation
- Live preview of mapped parameters

**Test Sample Data** (`getSampleValue()`):
```javascript
function getSampleValue(fieldPath) {
  const samples = {
    employeeName: 'John Doe',
    currentIncomeDue: '1250.00',
    currentHours: '42.5',
    // ... more realistic test values
  };
  return samples[fieldPath] || 'Sample Value';
}
```

## Template Parameter Mapping

### Template Structure

**Template**: `payrollfinal` (7 parameters)

### Mapping Configuration

Stored in: `businesses/{businessId}/whatsapp_automations/{automationId}`

```javascript
{
  templateName: 'payrollfinal',
  parameters: {
    '1': 'employeeName',
    '2': 'currentIncomeDue',
    '3': 'currentHours',
    '4': 'requiredHours',
    '5': 'hoursShort',
    '6': 'dailyMultipliers.sunday',
    '7': 'payRate'
  }
}
```

### Mapping Process (in `sendWhatsAppMessage`)

```javascript
// For each parameter position (1-7)
for (let i = 1; i <= 7; i++) {
  const fieldPath = templateParameters[i.toString()];
  
  if (!fieldPath) {
    templateComponents[0].parameters.push({ type: 'text', text: 'N/A' });
    continue;
  }
  
  // Navigate nested paths (e.g., 'dailyMultipliers.sunday')
  const value = getNestedValue(employeeData, fieldPath);
  
  // Format the value
  const formattedValue = formatValue(value, fieldPath);
  
  templateComponents[0].parameters.push({
    type: 'text',
    text: formattedValue || 'N/A'
  });
}
```

## Known Issues

### ⚠️ Issue 1: Cache Structure Mismatch (RESOLVED)

**Status**: ✅ **FIXED** (2024-02-14)

**Symptom**: Phone/email fields not appearing in employeeData sent to WhatsApp, causing messagesSent: 0

**Root Cause**: 
`processAttendanceEvent` was using **OLD cache structure** (direct key lookup):
```javascript
const employeeAssessment = cacheData[slotNumber.toString()]; // OLD
```

But `cacheCalculation.js` was updated to use **NEW structure** (employees array):
```javascript
{
  employees: [
    { employeeId, employeeName, phone, email, payRate, ... }
  ]
}
```

**Solution Implemented**:
Updated `processAttendanceEvent` (lines ~820-870) to:
1. Try NEW structure first (find in employees array)
2. Fallback to OLD structure for backward compatibility
3. Update phone/email from cache (cache is source of truth)
4. Log which structure was used

**Code Fix**:
```javascript
// Try new structure first (employees array)
if (cacheData.employees && Array.isArray(cacheData.employees)) {
  employeeAssessment = cacheData.employees.find(
    emp => emp.employeeId === slotNumber.toString()
  );
} else {
  // Fallback to old structure (direct key lookup)
  employeeAssessment = cacheData[slotNumber.toString()];
}

// Update phone/email from cache if available
if (employeeAssessment.phone) {
  employeeData.phone = employeeAssessment.phone;
}
if (employeeAssessment.email) {
  employeeData.email = employeeAssessment.email;
}
```

**Verification**:
```bash
# Check logs show phone being found from cache
gcloud functions logs read attendanceWebhook --limit=30 | grep "Phone updated from cache"
```

### ⚠️ Issue 2: Parameter Mapping Logs Show Field Names

**Status**: ✅ **NOT A BUG** - Working as Designed

**Initial Concern**: Logs showed "value: employeeName" instead of "value: azam"

**Explanation**: 
The log entry "Processing mapping" shows the **field name** (which is correct at that stage). The next log "Mapped parameter from field" shows the **actual value** extracted:

```json
// Step 1: Log shows field name (expected)
{ "message": "Processing mapping", "value": "employeeName" }

// Step 2: Log shows actual value extracted (confirms it works)
{ "message": "Mapped parameter from field", "actualValue": "azam" }
```

The mapping logic IS working correctly - field name → actual value lookup → send to WhatsApp.

**No Action Required**: This is normal behavior

### ⚠️ Issue 2: Assessment Cache Data Freshness

**Status**: Requires Manual Refresh

**Symptom**: New fields (phone, email) not present in cache until refresh

**Solution**: 
1. Navigate to business dashboard
2. Manually trigger assessment cache refresh
3. Or wait for next attendance event to auto-refresh cache

**Code Fix Deployed**: Cache calculation now includes phone and email (already deployed)

## Troubleshooting Guide

### No Messages Sent (messagesSent: 0)

**Check Order**:

1. ✅ **Verify phone exists in cache**:
```bash
# Check assessment cache in Firebase Console
businesses/{businessId}/assessment_cache/{YYYY-MM}/employees[]/phone
```

2. ✅ **Check automation card exists**:
```bash
# Firebase Console path
businesses/{businessId}/whatsapp_automations/{automationId}
```

3. ✅ **Review function logs**:
```bash
gcloud functions logs read attendanceWebhook --limit=50
# Look for "toNumbers" - should have array with phone numbers
# Look for "employeeData keys" - should include "phone"
```

4. ✅ **Verify WhatsApp credentials**:
```bash
# Check environment variables
firebase functions:config:get
# Should show whatsapp.phone_id and whatsapp.token
```

### Messages Send But Show Wrong Data

**Debugging Steps**:

1. **Check template parameter mapping**:
   - Open whatsapp-settings.html
   - Review parameter mappings for your automation
   - Verify field names match cache structure

2. **Test with sample data**:
   - Use test mode in whatsapp-settings
   - Verify getSampleValue() returns proper format
   - Check if test messages show correctly

3. **Inspect employeeData in logs**:
```bash
gcloud functions logs read attendanceWebhook \
  --filter="jsonPayload.employeeData:*" \
  --limit=10
```

4. **Verify cache structure**:
   - Check Firebase Console for assessment_cache
   - Ensure all expected fields exist
   - Compare field names in cache vs. template mapping

### Duplicate Messages

**Status**: ✅ FIXED

**Previous Cause**: Two triggers calling sendWhatsAppMessage:
- `onEmployeeStatusChange` (Firestore trigger) ← DISABLED
- `attendanceWebhook` (HTTP trigger) ← ACTIVE

**Current State**: Only HTTP webhook triggers messages

## Testing Procedures

### Test Mode (Recommended for Development)

1. Navigate to WhatsApp Settings page
2. Select automation card
3. Click "Test Send"
4. Review sample data generated
5. Check WhatsApp message received
6. Verify all 7 parameters show sample values (not field names)

### Production Test (Clock-Out Simulation)

1. **Refresh assessment cache** (if needed):
   - Navigate to business dashboard
   - Trigger manual cache refresh
   - Verify phone/email fields populated

2. **Clock out a test employee**:
   - Use manual punch form
   - Select employee (e.g., azam - ID: 1)
   - Set status to "Clock Out"
   - Click Submit

3. **Monitor logs in real-time**:
```bash
gcloud functions logs read attendanceWebhook \
  --limit=50 \
  --filter="severity>=INFO" \
  --format="table(timestamp,jsonPayload.message)"
```

4. **Verify message received**:
   - Check WhatsApp on employee's phone
   - Confirm all 7 parameters show actual values
   - Verify no field names appear as literals

5. **Check function response**:
```bash
# Should show messagesSent: 1
curl -X POST https://attendancewebhook-4q7htrps4q-uc.a.run.app \
  -H "Content-Type: application/json" \
  -d '{ ... attendance event ... }'
```

## Configuration Reference

### Environment Variables

Set via Firebase Functions config:

```bash
firebase functions:config:set \
  whatsapp.phone_id="YOUR_PHONE_ID" \
  whatsapp.token="YOUR_ACCESS_TOKEN"
```

### Business Configuration

Each business requires:

1. **Assessment Cache** (auto-generated):
   - Path: `businesses/{businessId}/assessment_cache/{YYYY-MM}`
   - Contains: All employee payroll data with contact info

2. **WhatsApp Automation Card**:
   - Path: `businesses/{businessId}/whatsapp_automations/{automationId}`
   - Fields:
     ```javascript
     {
       templateName: 'payrollfinal',
       eventType: 'clock_out',
       enabled: true,
       parameters: { ... },
       lastModified: timestamp
     }
     ```

3. **Staff Records with Phone Numbers**:
   - Path: `businesses/{businessId}/staff/{employeeId}`
   - Required field: `phone` (format: "0500330091")

## API Reference

### WhatsApp Cloud API

**Endpoint**: `https://graph.facebook.com/v17.0/{phone_id}/messages`

**Request Body**:
```javascript
{
  messaging_product: 'whatsapp',
  to: '0500330091',
  type: 'template',
  template: {
    name: 'payrollfinal',
    language: { code: 'en' },
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: 'John Doe' },
        { type: 'text', text: '1250.00' },
        { type: 'text', text: '42.5' },
        { type: 'text', text: '45' },
        { type: 'text', text: '2.5' },
        { type: 'text', text: '1.5x' },
        { type: 'text', text: '30' }
      ]
    }]
  }
}
```

### Internal Function Call

**URL**: `https://sendwhatsappmessage-4q7htrps4q-uc.a.run.app`

**Request Body**:
```javascript
{
  businessId: 'biz_srcomponents',
  employeeData: {
    employeeId: '1',
    employeeName: 'azam',
    phone: '0500330091',
    email: 'azam@example.com',
    currentIncomeDue: 1250.00,
    currentHours: 42.5,
    requiredHours: 45,
    hoursShort: 2.5,
    payRate: 30,
    dailyMultipliers: {
      sunday: 1.5,
      monday: 1.0,
      // ... rest of week
    }
  }
}
```

## Deployment

### Deploy Functions Only

```bash
firebase deploy --only functions:attendanceWebhook,functions:sendWhatsAppMessage
```

### Deploy Frontend Only

```bash
firebase deploy --only hosting
```

### Deploy Everything

```bash
firebase deploy
```

## Recent Changes

### 2024-02-14 - Cache Structure Mismatch Fix
- ✅ **CRITICAL FIX**: Updated `processAttendanceEvent` to support NEW cache structure
- ✅ Added employees array lookup: `cacheData.employees.find(emp => emp.employeeId === slotNumber)`
- ✅ Added fallback to OLD structure for backward compatibility
- ✅ Phone/email now read from assessment cache (cache is source of truth)
- ✅ Added detailed logging to show which cache structure is used
- ✅ Resolved issue where phone field wasn't included in employeeData

**Impact**: WhatsApp messages will now include contact info from cache, messagesSent should be 1 instead of 0

### 2024-02 - Contact Info in Cache (Initial Implementation)
- ✅ Added `phone` field to assessment cache structure
- ✅ Added `email` field to assessment cache structure
- ✅ Updated `cacheCalculation.js` to include contact info when calculating
- ✅ Updated frontend to read contact info from cache (no separate fetch)
- ✅ Disabled duplicate Firestore trigger (`onEmployeeStatusChange`)
- ✅ Fixed test mode in whatsapp-settings.html (sends sample values)

### Benefits
- Fewer database queries (contact info cached with payroll data)
- Single source of truth for employee data  
- Consistent data across all WhatsApp calls
- Eliminated duplicate message issue
- Backward compatible with old cache structure

## Next Steps

1. **✅ COMPLETED: Cache structure mismatch** - Fixed in processAttendanceEvent
   
2. **Refresh Assessment Cache** (Required):
   - Navigate to business dashboard
   - Trigger manual cache refresh
   - This will populate phone/email fields in NEW structure
   - Old cache structure will remain for backward compatibility

3. **Test Complete Flow**:
   - Clock out a test employee (e.g., azam)
   - Verify logs show "Using NEW cache structure"
   - Confirm logs show "Phone updated from cache: 0500330091"
   - Check WhatsApp message received with all 7 parameters
   - Verify messagesSent: 1 (not 0)

4. **Monitor Production**:
   - Watch logs for any issues with cache structure detection
   - Verify both OLD and NEW structures work correctly
   - Check all businesses get messages successfully

5. **Future Enhancements**:
   - Add mapping validation UI (check field paths against cache)
   - Live preview using real employee data (not samples)
   - Fallback logic for missing fields with better defaults
   - Retry logic for transient API failures
   - Migrate all businesses to NEW cache structure

## Support

For issues or questions:
1. Check logs: `gcloud functions logs read attendanceWebhook --limit=50`
2. Review Firebase Console: Assessment cache and automation cards
3. Test with sample data first before production
4. Verify phone numbers exist in staff records and cache

---

**Last Updated**: January 2024  
**Module Status**: ✅ Core functionality deployed, investigating mapping issue  
**Active Functions**: attendanceWebhook, sendWhatsAppMessage  
**Disabled Functions**: onEmployeeStatusChange (prevents duplicates)
