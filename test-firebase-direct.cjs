/**
 * Test Firebase Webhook Direct - Verify Firebase Cloud Function
 * This script tests if the Firebase Cloud Function is working correctly
 */

const https = require('https');

const FIREBASE_ENDPOINT = 'https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook';

function testFirebaseWebhook(testData) {
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

    console.log('🚀 Testing Firebase webhook with data:', testData);
    
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

async function runTests() {
  console.log('🧪 Firebase Cloud Function Direct Test');
  console.log('=====================================\n');

  // Test 1: Real attendance event simulation
  console.log('Test 1: Real Attendance Event');
  console.log('-----------------------------');
  try {
    const attendanceData = {
      deviceId: 'fc4349999',
      timestamp: new Date().toISOString(),
      employeeId: 'test123',
      attendanceStatus: 'Punch in',
      source: 'direct-test',
      rawData: '<?xml version="1.0" encoding="UTF-8"?><EventNotificationAlert><eventType>AccessControllerEvent</eventType><eventState>active</eventState><employeeNoString>test123</employeeNoString><attendanceStatus>Punch in</attendanceStatus></EventNotificationAlert>'
    };
    
    await testFirebaseWebhook(attendanceData);
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }

  console.log('\n');

  // Test 2: Heartbeat/health check
  console.log('Test 2: Heartbeat Check');
  console.log('----------------------');
  try {
    const heartbeatData = {
      test: true,
      timestamp: new Date().toISOString(),
      source: 'heartbeat-test'
    };
    
    await testFirebaseWebhook(heartbeatData);
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }

  console.log('\n');

  // Test 3: VPS Relay format simulation
  console.log('Test 3: VPS Relay Format');
  console.log('------------------------');
  try {
    const relayData = {
      deviceId: 'fc4349999',
      timestamp: new Date().toISOString(),
      rawData: '<?xml version="1.0" encoding="UTF-8"?><EventNotificationAlert><eventType>AccessControllerEvent</eventType><eventState>active</eventState><employeeNoString>qaasiem</employeeNoString><attendanceStatus>Punch in</attendanceStatus></EventNotificationAlert>',
      source: 'vps-relay'
    };
    
    await testFirebaseWebhook(relayData);
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }

  console.log('\n🎯 Direct Firebase test completed!');
  console.log('If all tests passed, the Firebase Cloud Function is working.');
  console.log('The issue is likely in the VPS relay device ID parsing.');
}

runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});