/**
 * Test Firebase with Admin Device - Verify Fix
 */

const https = require('https');

const FIREBASE_ENDPOINT = 'https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook';

function testFirebaseWithAdmin(testData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testData);

    const options = {
      hostname: 'us-central1-aiclock-82608.cloudfunctions.net',
      port: 443,
      path: '/attendanceWebhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('🚀 Testing Firebase with admin device:', testData);
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      console.log('📡 Firebase response status:', res.statusCode);
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('✅ Firebase response:', responseData);
        resolve({ statusCode: res.statusCode, data: responseData });
      });
    });

    req.on('error', (error) => {
      console.error('❌ Firebase request error:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function runAdminDeviceTest() {
  console.log('🧪 Testing Firebase with Admin Device ID');
  console.log('========================================\n');

  // Test with registered admin device
  console.log('Test: Attendance event with admin device');
  console.log('---------------------------------------');
  try {
    const attendanceData = {
      deviceId: 'admin',  // ✅ This device is registered
      timestamp: new Date().toISOString(),
      employeeId: 'test123',
      attendanceStatus: 'Punch in',
      source: 'admin-device-test',
      rawData: '<?xml version="1.0" encoding="UTF-8"?><EventNotificationAlert><eventType>AccessControllerEvent</eventType><eventState>active</eventState><employeeNoString>test123</employeeNoString><attendanceStatus>Punch in</attendanceStatus></EventNotificationAlert>'
    };
    
    const result = await testFirebaseWithAdmin(attendanceData);
    
    if (result.statusCode === 200) {
      console.log('\n🎉 SUCCESS! Admin device is working correctly!');
      console.log('✅ Clock-in data should now reach Firebase and the app.');
    } else if (result.statusCode === 400) {
      console.log('\n⚠️  Admin device rejected - check Firebase Cloud Function logs');
    }
    
  } catch (error) {
    console.error('❌ Admin device test failed:', error.message);
  }

  console.log('\n🎯 SUMMARY:');
  console.log('- Device webhook now configured for: /admin-webhook');
  console.log('- Using registered device ID: "admin"');
  console.log('- If Firebase test passed, clock-in data should reach your app!');
  console.log('\n🔧 Next Steps if still not working:');
  console.log('1. Check app frontend is loading correctly');
  console.log('2. Verify Firebase security rules allow writes');
  console.log('3. Test with actual fingerprint scan on device');
}

runAdminDeviceTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});