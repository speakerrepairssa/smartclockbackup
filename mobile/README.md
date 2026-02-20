# AIClock Staff Mobile App

Employee mobile application for viewing payslips, timesheets, and uploading documents.

## Features

- 👤 **Employee Login**: Secure authentication with Firebase
- 💰 **Payslips**: View and download monthly payslips
- 📊 **Timesheet**: Track attendance and working hours
- 📄 **Document Upload**: Submit sick notes and documents
- 🔔 **Notifications**: Get updates about payslips and notices

## Tech Stack

- React Native (Expo)
- Firebase (Auth, Firestore, Storage)
- React Navigation
- AsyncStorage

## Installation

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your phone (for testing)

### Setup

1. Install dependencies:
```bash
cd mobile
npm install
```

2. Update Firebase configuration:
   - Open `firebase.config.js`
   - Replace with your Firebase project credentials

3. Start the development server:
```bash
npm start
```

4. Scan the QR code with:
   - **iOS**: Camera app
   - **Android**: Expo Go app

## Building for Production

### Android APK

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Configure EAS Build:
```bash
eas build:configure
```

3. Build APK:
```bash
eas build --platform android --profile preview
```

4. Download the APK and upload to Firebase Hosting:
```bash
# Copy APK to hosting folder
cp path/to/build.apk ../src/downloads/aiclock-staff-v1.0.0.apk

# Deploy
cd ..
firebase deploy --only hosting
```

### iOS (Future)

iOS build requires Apple Developer account and will be added in future updates.

## Project Structure

```
mobile/
├── screens/           # App screens
│   ├── LoginScreen.js
│   ├── HomeScreen.js
│   ├── PayslipsScreen.js
│   ├── TimesheetScreen.js
│   ├── UploadScreen.js
│   └── ProfileScreen.js
├── firebase.config.js # Firebase configuration
├── App.js            # Main app component
├── app.json          # Expo configuration
└── package.json      # Dependencies
```

## Environment Variables

Create a `.env` file (not tracked in git):

```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
```

## Development Notes

### Mock Data

Currently using mock data for:
- Payslips (PayslipsScreen.js)
- Attendance (TimesheetScreen.js)
- Documents (UploadScreen.js)

Replace with actual Firebase queries before production release.

### Firebase Integration

TODO:
1. Create employee authentication system in Firebase
2. Implement payslip retrieval from Firestore
3. Implement attendance/timesheet queries
4. Implement document upload to Firebase Storage
5. Add push notifications

## Support

For issues or questions, contact your HR department or system administrator.

## License

Proprietary - AIClock Staff Application
