# 🔍 Direct Device Data Extractor

Standalone module for extracting employee data and events directly from Hikvision devices without affecting the main SmartClock application.

## 🎯 Purpose

This module allows you to:
- **Test device connectivity** to Hikvision devices
- **Extract employee lists** directly from device memory
- **Get attendance events** from device logs
- **Test multiple API endpoints** to find working methods
- **Discover device capabilities** and supported features

## 🚀 Quick Start

1. **Open the tester**: Open `device-data-tester.html` in your browser
2. **Configure device**: Enter your device IP, credentials, and business ID
3. **Register device**: Click "Register Device" to establish connection
4. **Run tests**:
   - **Quick Employee Test**: Fast check for employee data
   - **Full Data Extraction**: Comprehensive endpoint testing

## 📁 Files

- `direct-device-extractor.js` - Main extraction logic
- `device-data-tester.html` - Web interface for testing
- `README.md` - This documentation

## 🔧 Features

### 🎯 Quick Employee Test
Tests the most common employee data endpoints:
- Card holder search
- User info search  
- Personnel information

### 🔍 Full Data Extraction
Tests all available endpoints:
- **Card Holders**: `/ISAPI/AccessControl/CardHolder/*`
- **User Info**: `/ISAPI/AccessControl/UserInfo/*`
- **Events**: `/ISAPI/AccessControl/AcsEvent`
- **Device Info**: `/ISAPI/System/deviceInfo`
- **Personnel**: `/ISAPI/Intelligent/PersonnelInformation`
- **Legacy endpoints**: `/SDK/events`, `/api/v1/events`

## 🔌 Supported Endpoints

The module tests 15+ different endpoints including:

| Category | Endpoints | Purpose |
|----------|-----------|---------|
| **Employee Data** | CardHolder, UserInfo, Personnel | Get employee names, IDs, cards |
| **Events** | AcsEvent, EventsLog, DeviceLog | Get attendance history |
| **Device Info** | DeviceInfo, Status, Capabilities | Device details and features |
| **Legacy** | SDK, API, Export | Alternative data sources |

## 📊 Output Format

### Employee Data
```javascript
{
  employeeNo: "001",
  name: "John Smith", 
  cardNo: "12345678",
  source: "CardHolderSearch"
}
```

### Event Data
```javascript
{
  employeeNo: "001",
  name: "John Smith",
  time: "2026-02-10T08:30:00",
  eventType: "1", // 1=clock in, 2=clock out
  source: "AcsEvent"
}
```

### Endpoint Results
```javascript
{
  endpoint: "CardHolderSearch",
  url: "https://192.168.0.114/ISAPI/AccessControl/CardHolder/Search", 
  success: true,
  status: 200,
  responseTime: 1250,
  data: "...XML response..."
}
```

## 🎮 Usage Example

```javascript
// Create extractor instance
const extractor = new DirectDeviceExtractor();

// Register your device
const device = extractor.registerDevice('FC4349999', {
  ip: '192.168.0.114',
  username: 'admin',
  password: 'yourpassword',
  businessId: 'biz_machine_2'
});

// Quick employee test
const quickResults = await extractor.quickEmployeeTest('FC4349999');
console.log(`Found ${quickResults.totalEmployees} employees`);

// Full extraction
const fullResults = await extractor.extractAllData('FC4349999');
console.log('Employees:', fullResults.extraction.employees);
console.log('Events:', fullResults.extraction.events);
```

## 🔍 Troubleshooting

### Common Issues

**No employees found:**
- Device may not support ISAPI employee extraction
- Employee data might be stored in proprietary format
- Check device firmware version and capabilities

**Connection timeouts:**
- Verify device IP and network connectivity
- Check if HTTPS port (443) is accessible
- Try HTTP (port 80) if HTTPS fails

**Authentication errors:**
- Verify username and password
- Check if admin account has API access permissions
- Some devices require special API user accounts

**Invalid Operation errors:**
- Device doesn't support specific ISAPI endpoints
- Try alternative endpoints or methods
- Check device manual for supported APIs

## 🎯 Finding Your Employees

This module will help you discover:

1. **How many employees** are actually registered on the device
2. **Their real names** as stored in device memory
3. **Badge/card numbers** associated with each employee
4. **Which API endpoints work** for your specific device model
5. **Recent attendance events** with employee details

## 🔐 Security Note

This module is for **testing and discovery only**. It doesn't modify any data on the device or in your main SmartClock application. All tests are read-only operations.

## 📞 Support

If you discover working endpoints or employee data, you can use this information to enhance the main SmartClock attendance webhook system.