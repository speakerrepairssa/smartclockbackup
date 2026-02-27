/**
 * Check Device Registration Status
 * Verify if FC4349999 device is properly registered to biz_srcomponents
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (assuming service account is already configured)
if (!admin.apps.length) {
  const serviceAccount = require('./src/config/aiclock-82608-firebase-adminsdk-wjz46-6c12074ea5.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDeviceRegistration() {
  console.log('🔍 Checking Device Registration Status');
  console.log('=====================================\n');

  try {
    // Check business configuration
    console.log('📋 Step 1: Check business configuration...');
    const businessDoc = await db.collection('businesses').doc('biz_srcomponents').get();
    
    if (!businessDoc.exists) {
      console.log('❌ Business "biz_srcomponents" not found!');
      return;
    }

    const businessData = businessDoc.data();
    console.log('✅ Business found:', businessData.businessName);
    console.log('📱 Device ID:', businessData.deviceId);
    console.log('🔗 Linked Devices:', businessData.linkedDevices);

    // Check devices collection
    console.log('\n📋 Step 2: Check devices subcollection...');
    const devicesRef = db.collection('businesses').doc('biz_srcomponents').collection('devices');
    const devicesSnapshot = await devicesRef.get();
    
    console.log('📱 Registered devices count:', devicesSnapshot.size);
    
    if (devicesSnapshot.empty) {
      console.log('⚠️  No devices registered in subcollection!');
    } else {
      console.log('📱 Registered devices:');
      devicesSnapshot.forEach(doc => {
        console.log(`   - ${doc.id}: ${JSON.stringify(doc.data(), null, 2)}`);
      });
    }

    // Check for FC4349999 specifically
    console.log('\n📋 Step 3: Check FC4349999 device specifically...');
    const deviceDoc = await devicesRef.doc('FC4349999').get();
    
    if (deviceDoc.exists) {
      console.log('✅ FC4349999 device found:');
      console.log(JSON.stringify(deviceDoc.data(), null, 2));
    } else {
      console.log('❌ FC4349999 device NOT found in devices collection!');
      
      // Try lowercase version
      console.log('\n🔍 Checking lowercase variant...');
      const lowercaseDeviceDoc = await devicesRef.doc('fc4349999').get();
      if (lowercaseDeviceDoc.exists) {
        console.log('⚠️  Found lowercase "fc4349999":');
        console.log(JSON.stringify(lowercaseDeviceDoc.data(), null, 2));
      } else {
        console.log('❌ "fc4349999" also not found');
      }
    }

    // Check webhook configuration expectations
    console.log('\n📋 Step 4: Webhook Configuration Analysis');
    console.log('- Device webhook URL: /fc4349999-webhook (lowercase)');
    console.log('- Expected device ID: FC4349999 (uppercase)'); 
    console.log('- Business linkedDevices:', businessData.linkedDevices);
    
    const hasUppercase = businessData.linkedDevices && businessData.linkedDevices.includes('FC4349999');
    const hasLowercase = businessData.linkedDevices && businessData.linkedDevices.includes('fc4349999');
    
    console.log('✅ Has uppercase FC4349999:', hasUppercase);
    console.log('❌ Has lowercase fc4349999:', hasLowercase);

    // Recommendations
    console.log('\n🎯 RECOMMENDATIONS:');
    if (!hasUppercase && !hasLowercase) {
      console.log('❌ CRITICAL: Device not in linkedDevices array!');
      console.log('   Action: Update business.linkedDevices to include device ID');
    }
    
    if (!deviceDoc.exists) {
      console.log('❌ CRITICAL: Device not registered in devices collection!'); 
      console.log('   Action: Register FC4349999 in devices subcollection');
    }

    console.log('🔧 Case Sensitivity Issue:');
    console.log('   - Webhook uses: fc4349999 (lowercase)');
    console.log('   - Business expects: FC4349999 (uppercase)');
    console.log('   - Fix: Either update webhook URL or normalize case in Firebase function');

  } catch (error) {
    console.error('❌ Error checking device registration:', error);
  }
}

checkDeviceRegistration().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});