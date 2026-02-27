/**
 * Register Device FC4349999 to Speaker Repairs Business
 * 
 * This script registers the Hikvision device FC4349999 to biz_speaker_repairs
 * so that attendance events from this device are properly processed.
 * 
 * Run: node register-fc4349999.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (uses default credentials)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function registerDevice() {
  try {
    const businessId = 'biz_speaker_repairs';
    const deviceId = 'fc4349999'; // Lowercase to match webhook logs
    
    console.log(`\n🔧 Registering device ${deviceId} to ${businessId}...\n`);
    
    // 1. Register in global devices collection
    console.log('1️⃣ Creating global device registration...');
    const globalDeviceRef = db.collection('devices').doc(deviceId);
    await globalDeviceRef.set({
      deviceId: deviceId,
      deviceName: 'Speaker Repairs - Face Recognition Terminal',
      deviceType: 'hikvision',
      serialNumber: 'FC4349999',
      macAddress: '04:03:12:10:71:b5',
      ipAddress: '192.168.0.114',
      status: 'active',
      model: 'Hikvision Face Recognition',
      httpPort: 80,
      httpsPort: 443,
      vpsIP: '69.62.109.168',
      vpsPort: 7660,
      webhookPath: '/admin-webhook',
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      connectionTested: true
    }, { merge: true });
    console.log('   ✅ Global device registered\n');
    
    // 2. Link device to business (devices subcollection)
    console.log('2️⃣ Linking device to business...');
    const businessDeviceRef = db.collection('businesses').doc(businessId).collection('devices').doc(deviceId);
    await businessDeviceRef.set({
      deviceId: deviceId,
      deviceName: 'Speaker Repairs - Face Recognition Terminal',
      deviceType: 'hikvision',
      serialNumber: 'FC4349999',
      ipAddress: '192.168.0.114',
      status: 'active',
      isPlaceholder: false,
      linkedAt: new Date().toISOString(),
      lastSync: null
    }, { merge: true });
    console.log('   ✅ Device linked to business\n');
    
    // 3. Update business document with device reference
    console.log('3️⃣ Updating business document...');
    const businessRef = db.collection('businesses').doc(businessId);
    const businessSnap = await businessRef.get();
    
    if (businessSnap.exists()) {
      await businessRef.update({
        deviceId: deviceId,
        deviceIp: '192.168.0.114',
        lastDeviceUpdate: new Date().toISOString()
      });
      console.log('   ✅ Business document updated\n');
    } else {
      console.log('   ⚠️ Business document does not exist, skipping update\n');
    }
    
    // 4. Verify registration
    console.log('4️⃣ Verifying registration...');
    const verifySnap = await businessDeviceRef.get();
    if (verifySnap.exists()) {
      console.log('   ✅ Device successfully registered and verified!');
      console.log('   📍 Path:', businessDeviceRef.path);
      console.log('\n✨ Device FC4349999 is now ready to receive attendance events!\n');
    } else {
      console.log('   ❌ Verification failed - device not found');
    }
    
  } catch (error) {
    console.error('\n❌ Registration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run registration
registerDevice();
