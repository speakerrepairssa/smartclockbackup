#!/usr/bin/env node

// Simple test to call our Uniclox method testing endpoint

const http = require('http');

function makeRequest() {
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/test-uniclox-methods',
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        
        console.log('=== UNICLOX METHOD TESTING RESULTS ===');
        console.log('');
        
        if (result.success && result.results) {
          result.results.forEach(test => {
            console.log(`Test: ${test.name}`);
            console.log(`  URL: ${test.url}`);
            console.log(`  Status: ${test.status}`);
            console.log(`  Success: ${test.success}`);
            
            if (test.success) {
              console.log(`  Data Length: ${test.dataLength}`);
              console.log(`  Contains Events: ${test.containsEvents}`);
              console.log(`  Preview: ${test.preview}...`);
              
              if (test.containsEvents) {
                console.log('  🎯 THIS METHOD WORKED! Likely how Uniclox accessed events!');
                if (test.fullData) {
                  console.log('  Full response (first 500 chars):');
                  console.log(`  ${test.fullData.substring(0, 500)}...`);
                }
              }
            } else {
              console.log(`  Error: ${test.error}`);
              console.log(`  Error Preview: ${test.preview}`);
            }
            console.log('');
          });
        } else {
          console.log('Test failed:', result.error || 'Unknown error');
        }
        
        console.log('=== END RESULTS ===');
        
      } catch (error) {
        console.log('Failed to parse response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request failed:', error.message);
  });

  req.end();
}

console.log('Testing different methods that Uniclox might have used...');
makeRequest();