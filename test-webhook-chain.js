#!/usr/bin/env node
/**
 * Webhook Chain Diagnostic Tool
 * Tests: Device → VPS Relay → Firebase → Firestore
 */

const https = require('https');
const http = require('http');

const TESTS = {
  VPS_RELAY: 'http://69.62.109.168:7660',
  FIREBASE_FUNCTION: 'https://attendancewebhook-4q7htrps4q-uc.a.run.app',
  BUSINESS_ID: 'biz_speaker_repairs'
};

function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = lib.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseData
        });
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testStep(name, url, data) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`URL: ${url}`);
  console.log(`Payload:`, JSON.stringify(data, null, 2));
  
  try {
    const start = Date.now();
    const response = await makeRequest(url, data);
    const duration = Date.now() - start;
    
    console.log(`\n✅ SUCCESS (${duration}ms)`);
    console.log(`Status: ${response.statusCode}`);
    console.log(`Response:`, response.body);
    
    try {
      const json = JSON.parse(response.body);
      console.log(`\nParsed Response:`, JSON.stringify(json, null, 2));
    } catch (e) {
      // Not JSON, that's okay
    }
    
    return { success: true, response };
  } catch (error) {
    console.log(`\n❌ FAILED`);
    console.log(`Error:`, error.message);
    console.log(`Full Error:`, error);
    return { success: false, error };
  }
}

async function runDiagnostics() {
  console.log('\n🔍 WEBHOOK CHAIN DIAGNOSTIC TOOL');
  console.log('Testing: Device → VPS Relay → Firebase → Firestore\n');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  const testPayload = {
    deviceId: 'FC4349999',
    verifyNo: '1',
    employeeName: 'Test Employee',
    attendanceStatus: 'in',
    timestamp: new Date().toISOString(),
    businessId: TESTS.BUSINESS_ID,
    testMode: true
  };
  
  // Test 1: VPS Relay
  console.log('\n\n📍 STEP 1: Testing VPS Relay');
  console.log('This simulates what the Hikvision device sends...');
  const vpsResult = await testStep(
    'VPS Relay (69.62.109.168:7660)',
    TESTS.VPS_RELAY,
    testPayload
  );
  
  // Test 2: Firebase Function Direct
  console.log('\n\n📍 STEP 2: Testing Firebase Function Directly');
  console.log('Bypassing VPS to test if Firebase is working...');
  const firebaseResult = await testStep(
    'Firebase attendanceWebhook',
    TESTS.FIREBASE_FUNCTION,
    testPayload
  );
  
  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  console.log(`VPS Relay: ${vpsResult.success ? '✅ WORKING' : '❌ BROKEN'}`);
  console.log(`Firebase Function: ${firebaseResult.success ? '✅ WORKING' : '❌ BROKEN'}`);
  
  if (!vpsResult.success) {
    console.log('\n⚠️  VPS RELAY IS NOT RESPONDING');
    console.log('Possible causes:');
    console.log('  - PM2 process stopped or crashed');
    console.log('  - VPS server is down');
    console.log('  - Port 7660 is blocked');
    console.log('\nTo fix:');
    console.log('  1. SSH to VPS: ssh root@69.62.109.168');
    console.log('  2. Check PM2: pm2 list');
    console.log('  3. Restart: pm2 restart vps-relay');
    console.log('  4. Check logs: pm2 logs vps-relay');
  }
  
  if (vpsResult.success && !firebaseResult.success) {
    console.log('\n⚠️  FIREBASE FUNCTION IS NOT RESPONDING');
    console.log('Possible causes:');
    console.log('  - Function not deployed or crashed');
    console.log('  - Firebase service issue');
    console.log('\nTo fix:');
    console.log('  1. Redeploy: firebase deploy --only functions:attendanceWebhook');
    console.log('  2. Check logs: firebase functions:log');
  }
  
  if (vpsResult.success && firebaseResult.success) {
    console.log('\n✅ WEBHOOK CHAIN IS WORKING!');
    console.log('\nIf device punches still don\'t appear:');
    console.log('  1. Check device webhook configuration');
    console.log('  2. Device should point to: http://69.62.109.168:7660');
    console.log('  3. Check device logs for webhook errors');
    console.log('  4. Verify device network can reach VPS');
  }
  
  console.log('\n');
}

// Run diagnostics
runDiagnostics().catch(err => {
  console.error('\n❌ Diagnostic tool crashed:', err);
  process.exit(1);
});
