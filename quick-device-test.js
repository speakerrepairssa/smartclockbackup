#!/usr/bin/env node

/**
 * 🎯 QUICK HIKVISION DEVICE TEST
 * Tests your specific device with multiple extraction methods
 */

const axios = require('axios');

const DEVICE_CONFIG = {
  ip: '192.168.0.114',
  username: 'admin',
  password: 'Azam198419880001'
};

console.log('🎯 QUICK HIKVISION DEVICE TEST');
console.log('==============================');
console.log(`Device: ${DEVICE_CONFIG.ip}`);
console.log(`Time: ${new Date().toISOString()}\n`);

async function quickTest() {
  const results = {
    webInterface: false,
    isapi: false,
    cgi: false,
    foundEndpoints: [],
    extractedData: []
  };

  // Test 1: Web Interface Access
  console.log('📱 Testing web interface access...');
  try {
    const webResponse = await axios.get(`http://${DEVICE_CONFIG.ip}/doc/index.html`, {
      timeout: 10000,
      auth: { username: DEVICE_CONFIG.username, password: DEVICE_CONFIG.password }
    });
    
    if (webResponse.status === 200) {
      results.webInterface = true;
      console.log('✅ Web interface accessible');
      
      // Look for JavaScript variables containing employee data
      const html = webResponse.data;
      if (html.includes('qaasiem') || html.includes('az8') || html.includes('luq')) {
        console.log('🎉 Found employee data in web interface!');
        results.extractedData.push('Employee data found in HTML');
      }
    }
  } catch (error) {
    console.log(`❌ Web interface: ${error.message}`);
  }

  // Test 2: ISAPI Endpoints
  console.log('\n🏢 Testing ISAPI endpoints...');
  const isapiEndpoints = [
    '/ISAPI/System/deviceInfo',
    '/ISAPI/AccessControl/AcsEvent',
    '/ISAPI/System/Log/Search',
    '/ISAPI/AccessControl/UserInfo'
  ];

  for (const endpoint of isapiEndpoints) {
    try {
      const response = await axios.get(`http://${DEVICE_CONFIG.ip}${endpoint}`, {
        timeout: 5000,
        auth: { username: DEVICE_CONFIG.username, password: DEVICE_CONFIG.password }
      });
      
      if (response.status === 200) {
        console.log(`✅ ${endpoint} - Working`);
        results.isapi = true;
        results.foundEndpoints.push(endpoint);
      }
    } catch (error) {
      if (error.response) {
        console.log(`❌ ${endpoint} - ${error.response.status} ${error.response.statusText}`);
      } else {
        console.log(`❌ ${endpoint} - ${error.message}`);
      }
    }
  }

  // Test 3: Legacy CGI/ASP Endpoints
  console.log('\n🕸️ Testing legacy endpoints...');
  const legacyEndpoints = [
    '/cgi-bin/eventManager.cgi',
    '/cgi-bin/AccessLog.cgi',
    '/doc/page/attendance_log.asp',
    '/doc/page/eventSearch.asp',
    '/goform/FormAttendanceLog',
    '/attendance/getRecords',
    '/api/v1/events'
  ];

  for (const endpoint of legacyEndpoints) {
    try {
      const response = await axios.get(`http://${DEVICE_CONFIG.ip}${endpoint}`, {
        timeout: 5000,
        auth: { username: DEVICE_CONFIG.username, password: DEVICE_CONFIG.password },
        validateStatus: () => true
      });
      
      if (response.status < 404) {
        console.log(`✅ ${endpoint} - ${response.status}`);
        results.cgi = true;
        results.foundEndpoints.push(endpoint);
        
        // Check for attendance data
        if (typeof response.data === 'string' && 
            (response.data.includes('qaasiem') || response.data.includes('attendance') || response.data.includes('event'))) {
          console.log('🎉 Found attendance data!');
          results.extractedData.push(`Data found in ${endpoint}`);
        }
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - ${error.message}`);
    }
  }

  // Test 4: Form-based login and data extraction
  console.log('\n🔐 Testing form-based authentication...');
  try {
    const loginResponse = await axios.post(
      `http://${DEVICE_CONFIG.ip}/doc/page/login.asp`,
      `username=${DEVICE_CONFIG.username}&password=${DEVICE_CONFIG.password}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: () => true
      }
    );

    const cookies = loginResponse.headers['set-cookie'];
    if (cookies) {
      console.log('✅ Form login successful, got cookies');
      
      // Try to access data with cookies
      try {
        const dataResponse = await axios.get(`http://${DEVICE_CONFIG.ip}/doc/index.html#!/eventSearch`, {
          headers: { 'Cookie': cookies.join('; ') },
          timeout: 10000
        });
        
        if (dataResponse.data.includes('qaasiem') || dataResponse.data.includes('az8')) {
          console.log('🎉 Found employee data with cookie authentication!');
          results.extractedData.push('Employee data accessible with cookies');
        }
      } catch (error) {
        console.log('⚠️ Could not access event data with cookies');
      }
    }
  } catch (error) {
    console.log(`❌ Form login: ${error.message}`);
  }

  // Summary
  console.log('\n📊 RESULTS SUMMARY');
  console.log('==================');
  console.log(`Web Interface: ${results.webInterface ? '✅ Accessible' : '❌ Not accessible'}`);
  console.log(`ISAPI Support: ${results.isapi ? '✅ Working' : '❌ Not working'}`);
  console.log(`CGI Support: ${results.cgi ? '✅ Working' : '❌ Not working'}`);
  console.log(`Working Endpoints: ${results.foundEndpoints.length}`);
  console.log(`Data Sources Found: ${results.extractedData.length}`);

  if (results.foundEndpoints.length > 0) {
    console.log('\n🎯 Working Endpoints:');
    results.foundEndpoints.forEach(endpoint => console.log(`   ${endpoint}`));
  }

  if (results.extractedData.length > 0) {
    console.log('\n🎉 Data Sources:');
    results.extractedData.forEach(data => console.log(`   ${data}`));
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('==================');

  if (results.extractedData.length > 0) {
    console.log('🚀 SUCCESS: Found employee data sources!');
    console.log('Next steps:');
    console.log('1. Use the web interface scraping method');
    console.log('2. Implement cookie-based authentication');
    console.log('3. Parse the HTML/JavaScript for employee records');
  } else if (results.foundEndpoints.length > 0) {
    console.log('🔍 PARTIAL SUCCESS: Found working endpoints');
    console.log('Next steps:');
    console.log('1. Test endpoints with POST requests and XML payloads');
    console.log('2. Try different date ranges and parameters');
    console.log('3. Analyze response formats');
  } else if (results.webInterface) {
    console.log('🌐 WEB INTERFACE AVAILABLE');
    console.log('Next steps:');
    console.log('1. Use browser automation (Puppeteer) to extract data');
    console.log('2. Analyze network traffic to find AJAX endpoints');
    console.log('3. Reverse engineer the JavaScript code');
  } else {
    console.log('❌ LIMITED ACCESS');
    console.log('Troubleshooting steps:');
    console.log('1. Verify device IP and network connectivity');
    console.log('2. Check username/password credentials');
    console.log('3. Try HTTPS instead of HTTP');
    console.log('4. Check if device uses different ports');
  }

  console.log('\n🔧 IMMEDIATE ACTIONS:');
  if (results.webInterface) {
    console.log('Run: node analyze-web-interface.js');
  }
  if (results.foundEndpoints.length > 0) {
    console.log('Run: node comprehensive-hikvision-extractor.js');
  }

  return results;
}

// Run the test
quickTest().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  console.log('\nTroubleshooting:');
  console.log('1. Check if device is powered on and network accessible');
  console.log('2. Verify IP address is correct');
  console.log('3. Confirm username/password are correct');
  console.log('4. Try accessing the web interface manually in a browser');
});