const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'aiclock-82608'
  });
}

const db = admin.firestore();

async function checkDeviceRegistration() {
  try {
    console.log('🔍 Checking device registrations...\n');
    
    // Get all businesses
    const businessesRef = db.collection('businesses');
    const snapshot = await businessesRef.get();
    
    for (const doc of snapshot.docs) {
      const businessId = doc.id;
      const businessData = doc.data();
      
      console.log(`📋 Business: ${businessId}`);
      console.log(`   Name: ${businessData.businessName || 'Unknown'}`);
      console.log(`   Email: ${businessData.email || 'No email'}`);
      console.log(`   Linked Devices: ${businessData.linkedDevices || 'None'}`);
      
      if (businessData.linkedDevices) {
        console.log(`   Devices: ${JSON.stringify(businessData.linkedDevices)}`);
      }
      
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function fixDeviceRegistration() {
  try {
    // Find Speaker Repairs business (most likely candidate)
    const businessesRef = db.collection('businesses');
    const snapshot = await businessesRef.get();
    
    let speakerRepairsBusiness = null;
    
    for (const doc of snapshot.docs) {
      const businessData = doc.data();
      if (businessData.businessName && businessData.businessName.toLowerCase().includes('speaker')) {
        speakerRepairsBusiness = doc.id;
        break;
      }
    }
    
    if (!speakerRepairsBusiness) {
      // Try common business IDs
      const commonIds = ['biz_srcomponents', 'biz_machine_2', 'speaker_repairs'];
      for (const id of commonIds) {
        const doc = await businessesRef.doc(id).get();
        if (doc.exists) {
          speakerRepairsBusiness = id;
          break;
        }
      }
    }
    
    if (speakerRepairsBusiness) {
      console.log(`✅ Found business: ${speakerRepairsBusiness}`);
      
      // Update with both device IDs (fc4349999 and admin)  
      await businessesRef.doc(speakerRepairsBusiness).update({
        linkedDevices: ['fc4349999', 'admin', 'FC4349999'],
        deviceId: 'fc4349999' // Main device ID
      });
      
      console.log('✅ Device registration updated!');
      console.log('   Linked devices: fc4349999, admin, FC4349999');
    } else {
      console.log('❌ Could not find Speaker Repairs business');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run both functions
async function main() {
  await checkDeviceRegistration();
  console.log('🔧 Attempting to fix device registration...\n');
  await fixDeviceRegistration();
  console.log('\n🔄 Checking again after fix...\n');
  await checkDeviceRegistration();
}

main().then(() => {
  console.log('✅ Done!');
  process.exit(0);
}).catch(console.error);