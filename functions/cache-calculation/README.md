# 🔒 ISOLATED CACHE CALCULATION FUNCTION

## Overview

This is a **completely isolated Cloud Function** dedicated solely to payroll assessment cache calculation. It's separated from the main functions codebase to prevent accidental modifications or disruptions when updating other features.

## Why Isolated?

Every time we update functions in `functions/index.js`, there's a risk of:
- Breaking the cache calculation logic
- Introducing bugs that affect payroll calculations
- Deployment issues affecting critical functionality

By isolating this function:
✅ **Safe Updates**: Update other functions without affecting cache calculation  
✅ **Independent Deployment**: Deploy this function separately when needed  
✅ **Version Control**: Easy to track changes to calculation logic  
✅ **Stability**: Critical payroll calculations remain stable

## Structure

```
functions/
├── cache-calculation/          ← 🔒 ISOLATED FUNCTION
│   ├── index.js                  Main HTTP endpoint
│   ├── cacheCalculation.js       Calculation logic (copied from main)
│   ├── package.json              Dependencies
│   └── .gitignore
└── index.js                    ← Main functions file (other functions)
```

## Deployment

### Deploy ONLY the cache calculation function:
```bash
cd /path/to/aiclock
firebase deploy --only functions
# This will automatically deploy both codebases defined in firebase.json
```

### Deploy everything except cache calculation:
```bash
firebase deploy --only functions:default
```

## Function Details

**Name**: `cacheCalculation`  
**URL**: `https://us-central1-aiclock-82608.cloudfunctions.net/cacheCalculation`  
**Method**: GET or POST  
**Access**: Public (invoker: allUsers)

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `businessId` | ✅ Yes | - | Business ID (e.g., `biz_speaker_repairs`) |
| `month` | No | Current month | Month in YYYY-MM format (e.g., `2026-02`) |
| `requiredHours` | No | 176 | Required monthly hours |

### Example Request

```bash
curl "https://us-central1-aiclock-82608.cloudfunctions.net/cacheCalculation?businessId=biz_speaker_repairs&month=2026-02"
```

### Example Response

```json
{
  "success": true,
  "message": "Assessment cache updated successfully",
  "businessId": "biz_speaker_repairs",
  "month": "2026-02",
  "requiredHours": 176,
  "employeesCalculated": 15,
  "lastUpdated": "2026-02-15T12:00:00.000Z",
  "summary": {
    "totalHours": 120.5,
    "totalEmployees": 15,
    "totalIncomeDue": 15500
  }
}
```

## How It Works

1. **Receives Request**: HTTP endpoint receives businessId and month
2. **Loads Staff**: Fetches all employees from Firestore
3. **Processes Events**: Gets attendance events for the month
4. **Calculates Hours**: 
   - Pairs clock-in/clock-out events chronologically
   - Applies break deductions
   - Calculates payable hours with multipliers
5. **Writes Cache**: Stores results in `businesses/{businessId}/assessment_cache/{month}`
6. **Returns Result**: Sends summary back to caller

## Cache Structure

The function writes to Firestore:

```
businesses/
  └── {businessId}/
      └── assessment_cache/
          └── {YYYY-MM}/
              ├── lastUpdated: timestamp
              ├── summary: { totalHours, totalEmployees, etc. }
              └── employees: [
                    {
                      employeeId,
                      employeeName,
                      currentHours,
                      requiredHours,
                      hoursShort,
                      incomeDue,
                      phone,
                      email
                    }
                  ]
```

## Frontend Integration

The business dashboard calls this function when:
- User clicks "🔄 Recalculate Now" button
- Month is changed in assessment view
- Manual refresh is triggered

See: `src/pages/business-dashboard.html` line ~6826

## Maintenance

### When to Update

Update this function ONLY when:
- Calculation logic needs to change (payroll formulas, break rules, etc.)
- Bug fixes in assessment calculations
- Performance optimizations for calculation speed

### DO NOT Update For:
- Changes to other features (authentication, webhooks, WhatsApp, etc.)
- UI changes
- Other cloud function updates

### Testing Before Deploy

```bash
# Local test
cd functions/cache-calculation
npm test  # If tests exist

# Test in production
curl "https://us-central1-aiclock-82608.cloudfunctions.net/cacheCalculation?businessId=biz_test&month=$(date +%Y-%m)"
```

## Logs

View logs for this function only:

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=cachecalculation" \
  --limit=50 \
  --project=aiclock-82608 \
  --format="value(timestamp, textPayload)"
```

## Break Time Issue (Current Known Issue)

⚠️ **Current Issue**: The function deducts 60 minutes break time from ALL work periods, even if employee only worked < 60 minutes. This results in 0 payable hours for short shifts.

**Example**:
- Employee works 29 minutes
- Minus 60 min break = **0 hours payable**

**Solutions**:
1. Set break duration to 0 in business settings for testing
2. Update logic to only deduct break if worked time > break time
3. Make break conditional (only for full shifts)

See: `functions/cache-calculation/cacheCalculation.js` line ~295

## Firebase Configuration

In `firebase.json`:

```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["cache-calculation/**"]  // Exclude from main deployment
    },
    {
      "source": "functions/cache-calculation",
      "codebase": "cache-calculation",
      "ignore": ["node_modules", ".git"]
    }
  ]
}
```

## Permissions

Function is public (no authentication required):

```bash
gcloud functions add-invoker-policy-binding cacheCalculation \
  --region=us-central1 \
  --member=allUsers \
  --project=aiclock-82608
```

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-15 | 1.0.0 | Initial isolated function created |

## Support

For issues with cache calculation:
1. Check Cloud Function logs (see Logs section above)
2. Verify Firestore data exists for the business/month
3. Check attendance_events collection has data
4. Review break duration settings

---

**Created**: February 15, 2026  
**Last Updated**: February 15, 2026  
**Status**: ✅ Active and Deployed
