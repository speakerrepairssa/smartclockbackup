# AIClock Staff Mobile App

A React Native (Expo) mobile application for AIClock employee self-service portal.

## 🚀 Quick Start

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# Start development server
npm start

# Run on specific platform
npm run android  # Android
npm run ios      # iOS (macOS only)
npm run web      # Web browser
```

## 📱 Features

### ✅ **Completed Features**
- 🔐 **Firebase Authentication** - Secure employee login
- 🏠 **Dashboard** - Welcome screen with quick stats and actions
- 💰 **Payslips** - View monthly payslips and download PDFs
- 📊 **Timesheet** - View attendance history and hours worked
- 📄 **Document Upload** - Submit sick notes and documents
- 👤 **Profile Management** - User profile and settings
- 📷 **QR Code Scanner** - Scan employee login and attendance QRs
- 🎯 **QR Code Generator** - Generate test QR codes for development

### 🔄 **QR Code System**
The app supports multiple QR code types for testing:

#### **Employee Login QR**
```json
{
  "type": "employee_login",
  "employeeId": "EMP001", 
  "businessId": "BUS001",
  "timestamp": 1645123456789
}
```

#### **Clock In/Out QR**
```json
{
  "type": "clock_action",
  "action": "in", // or "out"
  "deviceId": "DEV001",
  "timestamp": 1645123456789
}
```

#### **Device Test QR**
```json
{
  "type": "device_test",
  "deviceId": "DEV001", 
  "testType": "connectivity",
  "timestamp": 1645123456789
}
```

## 📋 Navigation Structure

```
App
├── LoginScreen (when not authenticated)
└── MainTabs (when authenticated)
    ├── Home Tab → HomeScreen
    ├── Payslips Tab → PayslipsScreen
    ├── QR Scanner Tab → QRScannerScreen
    ├── Timesheet Tab → TimesheetScreen
    └── Profile Tab → ProfileScreen

Modal Screens (accessible from Home):
├── QRGeneratorScreen
└── UploadScreen
```

## 🛠️ Testing QR Codes

### Generate Test QR Codes
1. Open app → Home → "QR Generator"
2. Select QR type (Employee Login, Clock In/Out, Device Test)
3. QR code generates with test data

### Scan QR Codes
1. Open app → QR Scanner tab (📷)
2. Point camera at QR code 
3. App processes and shows result

### QR Code Types Supported
- **Employee Login**: Auto-authenticate employees
- **Clock In/Out**: Quick attendance actions
- **Device Test**: Test device connectivity
- **Generic Text/JSON**: Any text or data

## 🏗️ Build & Deploy

```bash
# Install dependencies
npm install

# Development build
npm run android
npm run start

# Production build (requires EAS CLI)
eas build --platform android
```

## Tech Stack

- **React Native (Expo)** - Mobile framework
- **Firebase** - Authentication & database
- **React Navigation** - Navigation system
- **QR Code Scanner/Generator** - Testing functionality
- **AsyncStorage** - Local data storage

## Project Structure

```
mobile/
├── screens/              # App screens
│   ├── LoginScreen.js    # Firebase authentication
│   ├── HomeScreen.js     # Dashboard with quick actions
│   ├── PayslipsScreen.js # View payslips
│   ├── TimesheetScreen.js # Attendance tracking
│   ├── UploadScreen.js   # Document upload
│   ├── ProfileScreen.js  # User profile
│   ├── QRScannerScreen.js # QR code scanner
│   └── QRGeneratorScreen.js # QR code generator
├── firebase.config.js    # Firebase configuration
├── App.js               # Navigation setup
└── package.json         # Dependencies
```

---

**Built with ❤️ using React Native, Expo & Firebase**
