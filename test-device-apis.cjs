#!/usr/bin/env node

/**
 * 🧪 TEST HIKVISION DEVICE APIs - Find What Works
 * Tests multiple API endpoints to find which ones return event data
 */

const http = require('http');

// DEVICE CONFIGURATION - UPDATE THESE
const DEVICE_IP = '192.168.7.2';
const USERNAME = 'admin';
const PASSWORD = 'Azam198419880001'; // Update if different

const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

// API ENDPOINTS TO TEST
const testEndpoints = [
  {
    name: 'Simple AcsEvent',
    method: 'GET',
    path: '/ISAPI/AccessControl/AcsEvent?format=json'
  },
  {
    name: 'AcsEvent with maxResults',
    method: 'GET',
    path: '/ISAPI/AccessControl/AcsEvent?format=json&maxResults=50'
  },
  {
    name: 'AcsEvent with searchID',
    method: 'GET',
    path: '/ISAPI/AccessControl/AcsEvent?format=json&searchID=1&maxResults=50'
  },
  {
    name: 'AcsEvent XML format',
    method: 'GET',
    path: '/ISAPI/AccessControl/AcsEvent'
  },
  {
    name: 'AcsEvent POST with basic XML',
    method: 'POST',
    path: '/ISAPI/AccessControl/AcsEvent',
    body: '<?xml version="1.0" encoding="UTF-8"?><AcsEventCond><searchID>1</searchID><maxResults>50</maxResults></AcsEventCond>',
    contentType: 'application/xml'
  },
  {
    name: 'AcsEvent POST with date range',
    method: 'POST',
    path: '/ISAPI/AccessControl/AcsEvent',
    body: '<?xml version="1.0" encoding="UTF-8"?><AcsEventCond><searchID>1</searchID><searchResultPosition>0</searchResultPosition><maxResults>50</maxResults><startTime>2020-01-01T00:00:00</startTime><endTime>2026-12-31T23:59:59</endTime></AcsEventCond>',
    contentType: 'application/xml'
  },
  {
    name: 'System Log',
    method: 'GET',
    path: '/ISAPI/System/Log?format=json'
  },
  {
    name: 'ContentMgmt Search',
    method: 'GET',
    path: '/ISAPI/ContentMgmt/search'
  },
  {
    name: 'Device Info (baseline test)',
    method: 'GET',
    path: '/ISAPI/System/deviceInfo?format=json'
  },
  {
    name: 'UserInfo Count',
    method: 'GET',
    path: '/ISAPI/AccessControl/UserInfo/Count?format=json'
  }
];

console.log('🧪 TESTING HIKVISION DEVICE APIs');
console.log('═'.repeat(70));
console.log(`Device: ${DEVICE_IP}`);
console.log(`Username: ${USERNAME}`);
console.log(`Testing ${testEndpoints.length} endpoints...\n`);

let successCount = 0;
let workingEndpoints = [];

function testEndpoint(endpoint, index) {
  return new Promise((resolve) => {
    console.log(`\n[${index}/${testEndpoints.length}] Testing: ${endpoint.name}`);
    console.log(`    Method: ${endpoint.method} ${endpoint.path}`);
    
    const options = {
      hostname: DEVICE_IP,
      path: endpoint.path,
      method: endpoint.method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json, application/xml, text/xml'
      },
      timeout: 10000
    };

    if (endpoint.body) {
      options.headers['Content-Type'] = endpoint.contentType || 'application/xml';
      options.headers['Content-Length'] = Buffer.byteLength(endpoint.body);
      console.log(`    Body: ${endpoint.body.substring(0, 100)}...`);
    }

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const isSuccess = res.statusCode === 200;
        const statusIcon = isSuccess ? '✅' : '❌';
        
        console.log(`    ${statusIcon} Status: ${res.statusCode} ${res.statusMessage}`);
        console.log(`    Content-Type: ${res.headers['content-type']}`);
        console.log(`    Data Size: ${data.length} bytes`);
        
        if (isSuccess && data.length > 0) {
          successCount++;
          workingEndpoints.push({
            name: endpoint.name,
            method: endpoint.method,
            path: endpoint.path,
            dataSize: data.length
          });
          
          // Show preview of data
          console.log(`    \n    📄 RESPONSE PREVIEW:`);
          if (data.startsWith('{') || data.startsWith('[')) {
            try {
              const json = JSON.parse(data);
              console.log(`    ${JSON.stringify(json, null, 2).split('\n').slice(0, 20).join('\n    ')}`);
              
              // Check for events
              if (json.AcsEvent?.InfoList) {
                const events = Array.isArray(json.AcsEvent.InfoList) ? 
                  json.AcsEvent.InfoList : [json.AcsEvent.InfoList];
                console.log(`    \n    🎉 FOUND ${events.length} EVENTS!`);
              }
            } catch (e) {
              console.log(`    ${data.substring(0, 500)}`);
            }
          } else if (data.startsWith('<')) {
            console.log(`    ${data.substring(0, 500)}`);
            
            // Check for InfoList in XML
            if (data.includes('<InfoList>')) {
              const matches = data.match(/<InfoList>/g);
              console.log(`    \n    🎉 FOUND ${matches?.length || 0} EVENTS IN XML!`);
            }
          } else {
            console.log(`    ${data.substring(0, 300)}`);
          }
        } else if (!isSuccess) {
          console.log(`    Error: ${data.substring(0, 200)}`);
        }
        
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.log(`    ❌ Request Error: ${error.message}`);
      resolve();
    });
    
    req.on('timeout', () => {
      console.log(`    ⏱️  Request Timeout`);
      req.destroy();
      resolve();
    });
    
    if (endpoint.body) {
      req.write(endpoint.body);
    }
    
    req.end();
  });
}

async function runTests() {
  for (let i = 0; i < testEndpoints.length; i++) {
    await testEndpoint(testEndpoints[i], i + 1);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n\n');
  console.log('═'.repeat(70));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Total Tests: ${testEndpoints.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${testEndpoints.length - successCount}`);
  
  if (workingEndpoints.length > 0) {
    console.log('\n✅ WORKING ENDPOINTS:\n');
    workingEndpoints.forEach((ep, i) => {
      console.log(`${i + 1}. ${ep.name}`);
      console.log(`   ${ep.method} ${ep.path}`);
      console.log(`   Data Size: ${ep.dataSize} bytes\n`);
    });
    
    console.log('\n💡 USE THESE ENDPOINTS IN YOUR CODE!\n');
  } else {
    console.log('\n❌ No working endpoints found.');
    console.log('\n🔍 Troubleshooting:');
    console.log('   1. Check device IP is correct');
    console.log('   2. Verify username/password');
    console.log('   3. Ensure device is on network');
    console.log('   4. Check if ISAPI is enabled on device');
    console.log('   5. Try accessing device web interface first\n');
  }
}

runTests();
