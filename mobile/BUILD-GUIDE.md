# Quick Start Guide - Building the AIClock Staff App

## Prerequisites
- Node.js 18+ installed
- Expo account (free - create at https://expo.dev/signup)
- Terminal / Command  Line access

## Option 1: Automated Build (Recommended)

### Step 1: Run Build Script
```bash
cd mobile
chmod +x build-and-deploy.sh
./build-and-deploy.sh
```

The script will:
- Install dependencies
- Install EAS CLI
- Prompt you to login to Expo
- Build the APK on Expo's servers (10-15 min)
- Provide download link

### Step 2: Download & Deploy APK
After build completes:
1. Click the download link provided
2. Run these commands:
```bash
# Create downloads directory
mkdir -p ../src/downloads

# Move the APK
mv ~/Downloads/build-*.apk ../src/downloads/aiclock-staff-v1.0.0.apk

# Deploy to Firebase
cd ..
firebase deploy --only hosting
```

### Step 3: Test
1. Visit https://aiclock-82608.web.app
2. Go to Business Dashboard → App Downloads
3. Scan QR code or click download button
4. Install on Android device

---

## Option 2: Manual Build

### Step 1: Install Dependencies
```bash
cd mobile
npm install
```

### Step 2: Install EAS CLI
```bash
npm install -g eas-cli
```

### Step 3: Login to Expo
```bash
eas login
```
If you don't have an account, create one at https://expo.dev/signup (it's free!)

### Step 4: Build APK
```bash
eas build --platform android --profile preview
```

Wait 10-15 minutes for cloud build to complete.

### Step 5: Download & Deploy
```bash
# Download APK from link provided
# Then:
mkdir -p ../src/downloads
mv ~/Downloads/build-*.apk ../src/downloads/aiclock-staff-v1.0.0.apk
cd ..
firebase deploy --only hosting
```

---

## Option 3: Test with Expo Go (No Build Required)

For quick testing without building APK:

### Step 1: Install Expo Go
- Android: https://play.google.com/store/apps/details?id=host.exp.exponent
- iOS: https://apps.apple.com/app/expo-go/id982107779

### Step 2: Start Development Server
```bash
cd mobile
npm install
npx expo start
```

### Step 3: Scan QR Code
- Android: Use Expo Go app to scan the QR code
- iOS: Use Camera app to scan, opens in Expo Go

### Test Features:
- Login screen
- Home dashboard
- Payslips (mock data)
- Timesheet (mock data)
- Document upload
- Profile

---

## Troubleshooting

### "npm install" fails
```bash
# Clear cache and try again
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### "eas command not found"
```bash
# Install globally
npm install -g eas-cli

# Or use npx
npx eas-cli build --platform android --profile preview
```

### Build fails on Expo servers
- Check your Expo account is verified
- Ensure app.json is valid JSON
- Check build logs on https://expo.dev

### APK won't install on device
- Enable "Unknown Sources" in Android Settings → Security
- If file is corrupted, download again from Expo dashboard

### QR code doesn't work
- Update QR code URL in business-dashboard.html line ~11063:
```javascript
apkUrl: 'https://aiclock-82608.web.app/downloads/aiclock-staff-v1.0.0.apk'
```
- Ensure APK is uploaded to src/downloads/
- Redeploy: `firebase deploy --only hosting`

---

## Next Steps After Deployment

1. **Update Mock Data**: Replace mock data in screens with real Firestore queries
2. **Enable Authentication**: Set up Email/Password auth in Firebase Console
3. **Test Login**: Create test employee account
4. **Connect Payslips**: Link to existing PayslipsModule
5. **Connect Timesheet**: Query attendance collection
6. **Test Uploads**: Implement Firebase Storage uploads

---

## Support
- EAS Build Docs: https://docs.expo.dev/build/setup/
- Expo Forums: https://forums.expo.dev/
- Firebase Console: https://console.firebase.google.com/project/aiclock-82608

---

**Current Status**: ✅ App code complete, Firebase config updated, ready to build!
