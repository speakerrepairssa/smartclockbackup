#!/usr/bin/env node

/**
 * 🎯 TEST CORRECT HIKVISION API FORMAT
 * 
 * This script uses the CORRECT API format with AcsEventCond parameters
 * as specified in Hikvision documentation
 */

const https = require('https');

// Device configuration
const DEVICE_IP = '192.168.0.114';
const USERNAME = 'admin';
const PASSWORD = 'Azam198419880001';

// ✅ CORRECT API FORMAT (from Hikvision docs)
const correctApiUrl = `/ISAPI/AccessControl/AcsEvent?format=json&AcsEventCond.searchID=1&AcsEventCond.searchResultPosition=0&AcsEventCond.maxResults=100&AcsEventCond.major=5&AcsEventCond.minor=75&AcsEventCond.startTime=2020-01-01T00:00:00&AcsEventCond.endTime=2026-12-31T23:59:59`;

console.log('🎯 Testing CORRECT Hikvision API Format\n');
console.log('📋 API Details:');
console.log(`   Device: ${DEVICE_IP}`);
console.log(`   Endpoint: /ISAPI/AccessControl/AcsEvent`);
console.log(`   Parameters:`)
console.log(`     - format=json`);
console.log(`     - AcsEventCond.searchID=1`);
console.log(`     - AcsEventCond.searchResultPosition=0`);
console.log(`     - AcsEventCond.maxResults=100`);
console.log(`     - AcsEventCond.major=5 (Access Control events)`);
console.log(`     - AcsEventCond.minor=75 (Access granted/denied)`);
console.log(`     - AcsEventCond.startTime=2020-01-01T00:00:00`);
console.log(`     - AcsEventCond.endTime=2026-12-31T23:59:59`);
console.log('\n🔄 Making request...\n');

const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

const options = {
  hostname: DEVICE_IP,
  path: correctApiUrl,
  method: 'GET',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json, application/xml'
  },
  rejectUnauthorized: false,
  timeout: 15000
};

function makeRequest(protocol) {
  return new Promise((resolve) => {
    console.log(`📡 Trying ${protocol.toUpperCase()}...`);
    
    const client = protocol === 'https' ? https : require('http');
    const req = client.request(options, (res) => {
      let data = '';
      
      console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`   Content-Type: ${res.headers['content-type']}`);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            console.log('   ✅ SUCCESS! Got JSON response\n');
            console.log('📊 Response Data:');
            console.log(JSON.stringify(parsed, null, 2));
            
            // Parse events
            if (parsed.AcsEvent && parsed.AcsEvent.InfoList) {
              const events = Array.isArray(parsed.AcsEvent.InfoList) ? 
                parsed.AcsEvent.InfoList : [parsed.AcsEvent.InfoList];
              
              console.log(`\n🎉 Found ${events.length} events!`);
              console.log('\n📋 Event Summary:');
              events.forEach((event, index) => {
                console.log(`   ${index + 1}. ${event.time} - ${event.employeeNoString || event.cardNo || 'Unknown'} (Type: ${event.type})`);
              });
            } else {
              console.log('\n⚠️  Response format unexpected or no events found');
            }
            resolve(true);
          } catch (e) {
            console.log('   ⚠️  Non-JSON response:');
            console.log(data.substring(0, 500));
            resolve(false);
          }
        } else {
          console.log(`   ❌ Error: HTTP ${res.statusCode}`);
          console.log(`   Response: ${data.substring(0, 200)}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log(`   ❌ Request failed: ${error.message}\n`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('   ❌ Request timed out\n');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

async function test() {
  // Try HTTPS first (most common)
  let success = await makeRequest('https');
  
  // If HTTPS fails, try HTTP
  if (!success) {
    console.log('\n🔄 HTTPS failed, trying HTTP...\n');
    success = await makeRequest('http');
  }
  
  if (!success) {
    console.log('\n❌ Both HTTPS and HTTP failed');
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Verify device IP is correct: ' + DEVICE_IP);
    console.log('   2. Check username/password: ' + USERNAME + '/' + PASSWORD);
    console.log('   3. Ensure ISAPI is enabled on device');
    console.log('   4. Try this URL in Postman:');
    console.log(`      https://${DEVICE_IP}${correctApiUrl}`);
    console.log('   5. Check device firewall settings');
  }
}

test();
