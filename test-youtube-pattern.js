#!/usr/bin/env node

// Test the YouTube pattern specifically

const http = require('http');

function testYouTubePattern() {
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/test-youtube-pattern',
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
        
        console.log('=== YOUTUBE PATTERN TESTING RESULTS ===');
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
              console.log(`  Is JSON: ${test.isJSON}`);
              console.log(`  Preview: ${test.preview}...`);
              
              if (test.containsEvents) {
                console.log('  🎯 THIS IS THE YOUTUBE METHOD! Event data found!');
                if (test.fullData) {
                  console.log('  Full response:');
                  console.log(JSON.stringify(test.fullData, null, 2));
                }
              }
            } else {
              console.log(`  Error: ${test.error}`);
              console.log(`  Error Preview: ${test.preview}`);
            }
            console.log('');
          });
          
          // Summary
          const successful = result.results.filter(r => r.success);
          const withEvents = result.results.filter(r => r.containsEvents);
          
          console.log('=== SUMMARY ===');
          console.log(`Total tests: ${result.results.length}`);
          console.log(`Successful: ${successful.length}`);
          console.log(`With event data: ${withEvents.length}`);
          
          if (withEvents.length > 0) {
            console.log('🎉 FOUND WORKING METHODS!');
            withEvents.forEach(method => {
              console.log(`  ✅ ${method.name}: ${method.url}`);
            });
          } else {
            console.log('❌ No working methods found with this pattern');
            console.log('The YouTube video likely shows a different device or local SDK setup');
          }
          
        } else {
          console.log('Test failed:', result.error || 'Unknown error');
        }
        
        console.log('=== END RESULTS ===');
        
      } catch (error) {
        console.log('Failed to parse response:', error.message);
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request failed:', error.message);
  });

  req.end();
}

console.log('🎬 Testing YouTube video API pattern...');
testYouTubePattern();