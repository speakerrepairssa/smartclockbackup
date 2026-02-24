# ✅ CORRECT HIKVISION API FORMAT

## 📋 Proper Event Extraction API

Based on Hikvision official documentation, the **correct** API format for getting access control events is:

```
/ISAPI/AccessControl/AcsEvent?format=json&AcsEventCond.searchID=<ID>&AcsEventCond.searchResultPosition=<POS>&AcsEventCond.maxResults=<MAX>&AcsEventCond.major=<MAJOR>&AcsEventCond.minor=<MINOR>&AcsEventCond.startTime=<START>&AcsEventCond.endTime=<END>
```

## 🎯 Key Parameters Explained

| Parameter | Required | Description | Example Value |
|-----------|----------|-------------|---------------|
| `format` | Yes | Response format | `json` or `xml` |
| `AcsEventCond.searchID` | Yes | Unique search identifier | `1` |
| `AcsEventCond.searchResultPosition` | Yes | Starting position (pagination) | `0` |
| `AcsEventCond.maxResults` | Yes | Maximum events to return | `100` |
| `AcsEventCond.major` | Yes | Event major type (5 = Access Control) | `5` |
| `AcsEventCond.minor` | Yes | Event minor type (75 = Access granted/denied) | `75` |
| `AcsEventCond.startTime` | Yes | Start timestamp | `2020-01-01T00:00:00` |
| `AcsEventCond.endTime` | Yes | End timestamp | `2026-12-31T23:59:59` |

## 📝 Complete Example

### Full URL
```
https://192.168.0.114/ISAPI/AccessControl/AcsEvent?format=json&AcsEventCond.searchID=1&AcsEventCond.searchResultPosition=0&AcsEventCond.maxResults=100&AcsEventCond.major=5&AcsEventCond.minor=75&AcsEventCond.startTime=2020-01-01T00:00:00&AcsEventCond.endTime=2026-12-31T23:59:59
```

### cURL Command
```bash
curl -k -u admin:Azam198419880001 \
"https://192.168.0.114/ISAPI/AccessControl/AcsEvent?format=json&AcsEventCond.searchID=1&AcsEventCond.searchResultPosition=0&AcsEventCond.maxResults=100&AcsEventCond.major=5&AcsEventCond.minor=75&AcsEventCond.startTime=2020-01-01T00:00:00&AcsEventCond.endTime=2026-12-31T23:59:59"
```

### Node.js (axios)
```javascript
const axios = require('axios');
const https = require('https');

const deviceIP = '192.168.0.114';
const username = 'admin';
const password = 'Azam198419880001';

const url = `https://${deviceIP}/ISAPI/AccessControl/AcsEvent`;
const params = {
  format: 'json',
  'AcsEventCond.searchID': 1,
  'AcsEventCond.searchResultPosition': 0,
  'AcsEventCond.maxResults': 100,
  'AcsEventCond.major': 5,
  'AcsEventCond.minor': 75,
  'AcsEventCond.startTime': '2020-01-01T00:00:00',
  'AcsEventCond.endTime': '2026-12-31T23:59:59'
};

const response = await axios.get(url, {
  params,
  auth: { username, password },
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

console.log('Events:', response.data);
```

## ❌ What Was Wrong Before

### Incorrect Format (Missing AcsEventCond prefix)
```
❌ /ISAPI/AccessControl/AcsEvent?format=json&startTime=2020-01-01&endTime=2026-12-31
```

This fails because:
- Missing `AcsEventCond.` prefix on parameters
- Missing required `searchID`, `searchResultPosition`, `maxResults`
- Missing event type filters (`major`, `minor`)

### Correct Format
```
✅ /ISAPI/AccessControl/AcsEvent?format=json&AcsEventCond.searchID=1&AcsEventCond.searchResultPosition=0&AcsEventCond.maxResults=100&AcsEventCond.major=5&AcsEventCond.minor=75&AcsEventCond.startTime=2020-01-01T00:00:00&AcsEventCond.endTime=2026-12-31T23:59:59
```

## 📊 Expected Response Format

```json
{
  "AcsEvent": {
    "searchID": "1",
    "responseStatus": true,
    "numOfMatches": 45,
    "totalMatches": 45,
    "InfoList": [
      {
        "major": 5,
        "minor": 75,
        "time": "2026-02-10T09:30:00+02:00",
        "type": "1",
        "employeeNoString": "qaasiem",
        "name": "Qaasiem",
        "doorNo": 1,
        "deviceName": "Main Entrance",
        "serialNo": "DS-K1T804EF20220101",
        "cardNo": "1234567890",
        "cardReaderNo": 1,
        "picUri": "/pic/card/1234567890.jpg"
      },
      {
        "major": 5,
        "minor": 75,
        "time": "2026-02-10T12:45:00+02:00",
        "type": "1",
        "employeeNoString": "az8",
        "name": "Azam",
        "doorNo": 1,
        "deviceName": "Main Entrance",
        "cardNo": "9876543210"
      }
    ]
  }
}
```

## 🔢 Event Type Codes

### Major Types
- `5` = Access Control Events (most common for attendance)
- `1` = Motion Detection
- `2` = Video Loss
- `3` = Tampering

### Minor Types (for major=5)
- `75` = Access granted/denied (attendance events)
- `0` = All access events
- `1` = Card swipe
- `2` = Fingerprint
- `3` = Face recognition

## 🔄 Pagination

For large datasets, use pagination:

```javascript
// Get first 100 events
AcsEventCond.searchResultPosition = 0
AcsEventCond.maxResults = 100

// Get next 100 events
AcsEventCond.searchResultPosition = 100
AcsEventCond.maxResults = 100
```

## 🧪 Testing

Run the test script:
```bash
cd /Users/azammacair/Dropbox/projects\ development/aiclock
node test-correct-api.js
```

Or test in Postman:
1. Method: `GET`
2. URL: `https://192.168.0.114/ISAPI/AccessControl/AcsEvent`
3. Params:
   - `format` = `json`
   - `AcsEventCond.searchID` = `1`
   - `AcsEventCond.searchResultPosition` = `0`
   - `AcsEventCond.maxResults` = `100`
   - `AcsEventCond.major` = `5`
   - `AcsEventCond.minor` = `75`
   - `AcsEventCond.startTime` = `2020-01-01T00:00:00`
   - `AcsEventCond.endTime` = `2026-12-31T23:59:59`
4. Auth: Basic Auth (username: `admin`, password: `Azam198419880001`)
5. SSL: Disable SSL verification

## 📚 References

- Hikvision ISAPI Documentation: Access Control Events
- Device Model: DS-K1T804EF / Similar
- Firmware: V3.x.x or higher
- API Version: 2.0+

## ✅ Implementation Status

- ✅ Updated hikvision-sync-service/server.js with correct API
- ✅ Created test-correct-api.js for quick testing
- ✅ Documented correct format in this file
- 🔄 Ready to deploy and test

## 🚀 Next Steps

1. Test with the new API format: `node test-correct-api.js`
2. Verify events are returned correctly
3. Update all other files using the old API format
4. Deploy to production VPS
