#!/usr/bin/env node

// Test all patterns with your specific device
import http from 'http';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          resolve({ error: 'Failed to parse JSON', raw: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testAllMethods() {
  console.log('🧪 Testing all methods with your device (192.168.0.114)...');
  console.log('');

  // Test YouTube pattern first
  console.log('🎬 Testing YouTube API pattern...');
  try {
    const youtubeResult = await makeRequest('/test-youtube-pattern');
    
    if (youtubeResult.success && youtubeResult.results) {
      youtubeResult.results.forEach(test => {
        console.log(`  ${test.success ? '✅' : '❌'} ${test.name}`);
        if (test.success) {
          console.log(`    Status: ${test.status}, Length: ${test.dataLength}`);
          console.log(`    Contains Events: ${test.containsEvents}`);
          if (test.containsEvents) {
            console.log(`    🎯 FOUND EVENT DATA! URL: ${test.url}`);
          }
        } else {
          console.log(`    Error: ${test.error}`);
        }
      });
    } else {
      console.log(`  Error: ${youtubeResult.error}`);
    }
  } catch (error) {
    console.log(`  Connection error: ${error.message}`);
  }

  console.log('');
  console.log('🔍 Testing Uniclox methods...');
  
  // Test Uniclox methods
  try {
    const unicloxResult = await makeRequest('/test-uniclox-methods');
    
    if (unicloxResult.success && unicloxResult.results) {
      unicloxResult.results.forEach(test => {
        console.log(`  ${test.success ? '✅' : '❌'} ${test.name}`);
        if (test.success) {
          console.log(`    Status: ${test.status}, Length: ${test.dataLength}`);
          console.log(`    Contains Events: ${test.containsEvents}`);
          if (test.containsEvents) {
            console.log(`    🎯 FOUND EVENT DATA! URL: ${test.url}`);
          }
        } else {
          console.log(`    Error: ${test.error}`);
        }
      });
    } else {
      console.log(`  Error: ${unicloxResult.error}`);
    }
  } catch (error) {
    console.log(`  Connection error: ${error.message}`);
  }

  console.log('');
  console.log('=== ANALYSIS ===');
  console.log('If any method shows "FOUND EVENT DATA!", that is likely how');
  console.log('Uniclox successfully extracted your 2905 events.');
  console.log('');
  console.log('If no methods work, we may need to:');
  console.log('1. Install Hikvision SDK');
  console.log('2. Use a different protocol (TCP, WebSocket, etc.)');
  console.log('3. Access the device web interface directly');
}

testAllMethods().catch(console.error);