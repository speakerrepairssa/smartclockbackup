// Direct Device Import - Simple script to get ALL possible data from your Hikvision device
// This will tell you exactly what your device supports

const axios = require('axios');
const fs = require('fs');

async function deviceDirectImport() {
  const deviceIP = '192.168.0.114';
  const username = 'admin'; 
  const password = 'Azam198419880001';
  
  console.log('🔍 COMPREHENSIVE DEVICE DATA EXTRACTION');
  console.log(`📱 Device: ${deviceIP}`);
  console.log(`👤 Credentials: ${username} / ${password}`);
  console.log('=' .repeat(60));
  
  // Call our extraction endpoint
  try {
    console.log('📊 Attempting direct extraction...\n');
    
    const response = await axios.get(`http://localhost:3002/device/extract?ip=${deviceIP}&username=${username}&password=${password}`);
    const result = response.data;
    
    console.log(`📋 EXTRACTION RESULTS:`);
    console.log(`🎯 Total events found: ${result.total_events_found}`);
    console.log(`🔍 Endpoints tested: ${result.extraction_attempts.length}`);
    console.log('');
    
    // Show what worked and what didn't
    const successful = result.extraction_attempts.filter(a => a.success);
    const failed = result.extraction_attempts.filter(a => !a.success);
    
    if (successful.length > 0) {
      console.log('✅ SUCCESSFUL ENDPOINTS:');
      successful.forEach(endpoint => {
        console.log(`  📡 ${endpoint.endpoint}: ${endpoint.events_found || 0} events`);
      });
      console.log('');
    }
    
    console.log('❌ FAILED ENDPOINTS:');
    const errorSummary = {};
    failed.forEach(endpoint => {
      const error = endpoint.error || endpoint.status;
      if (!errorSummary[error]) errorSummary[error] = [];
      errorSummary[error].push(endpoint.endpoint);
    });
    
    Object.keys(errorSummary).forEach(error => {
      console.log(`  ${error}: ${errorSummary[error].length} endpoints`);
      errorSummary[error].slice(0, 3).forEach(ep => console.log(`    • ${ep}`));
      if (errorSummary[error].length > 3) {
        console.log(`    ... and ${errorSummary[error].length - 3} more`);
      }
    });
    
    console.log('');
    console.log('🎯 CONCLUSION:');
    if (result.total_events_found === 0) {
      console.log('❌ Your device CANNOT provide historical events via API');
      console.log('📝 Reasons:');
      result.recommendation.reasons.forEach(reason => {
        console.log(`   • ${reason}`);
      });
      
      console.log('');
      console.log('💡 SOLUTIONS:');
      console.log('   1. ✅ Use sample data for dashboard (2905 events)');
      console.log('   2. ✅ Set up real-time webhook for NEW events');
      console.log('   3. 🔍 Check device web interface for export options');
      console.log('   4. 📞 Contact Hikvision for API documentation');
      
      // Generate sample data for dashboard
      console.log('');
      console.log('📊 Generating sample data for your dashboard...');
      
      const sampleEvents = await generateSampleData(deviceIP);
      
      // Save to file for easy import
      const filename = `sample-events-${deviceIP.replace(/\./g, '-')}-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(sampleEvents, null, 2));
      
      console.log(`💾 Sample data saved to: ${filename}`);
      console.log(`📈 Generated: ${sampleEvents.length} sample events`);
      console.log('');
      console.log('🚀 TO USE THIS DATA:');
      console.log('   1. Import this file into your dashboard');
      console.log('   2. Configure HTTP notifications for real events'); 
      console.log('   3. Your dashboard will show historical + new events');
      
    } else {
      console.log('🎉 SUCCESS! Real events extracted from device');
      console.log(`📊 Found ${result.total_events_found} events`);
      
      // Save real events
      const filename = `real-events-${deviceIP.replace(/\./g, '-')}-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(result.events, null, 2));
      console.log(`💾 Real events saved to: ${filename}`);
    }
    
  } catch (error) {
    console.error('❌ Error during extraction:', error.message);
  }
}

async function generateSampleData(deviceIP) {
  console.log('🔧 Creating representative sample data...');
  
  const events = [];
  const now = new Date();
  
  // Employee data that matches your device capacity
  const employees = [
    { id: '001', name: 'John Smith', card: '12345678' },
    { id: '002', name: 'Jane Doe', card: '87654321' },
    { id: '003', name: 'Mike Johnson', card: '11223344' },
    { id: '004', name: 'Sarah Wilson', card: '44332211' },
    { id: '005', name: 'David Brown', card: '55667788' },
    { id: '006', name: 'Lisa Chen', card: '88776655' }
  ];
  
  const eventTypes = ['CARD_ACCESS', 'FACE_RECOGNITION', 'FINGERPRINT_ACCESS', 'ACCESS_CONTROL'];
  const results = ['Valid', 'Valid', 'Valid', 'Invalid', 'Timeout']; // Mostly successful
  
  // Generate 2905 events (matching your device count)
  for (let i = 0; i < 2905; i++) {
    const daysAgo = Math.floor(Math.random() * 365); // Events from last year
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);
    
    const eventTime = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000) - (hoursAgo * 60 * 60 * 1000) - (minutesAgo * 60 * 1000));
    
    const employee = employees[Math.floor(Math.random() * employees.length)];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const result = results[Math.floor(Math.random() * results.length)];
    
    events.push({
      id: `sample_${deviceIP}_${i}`,
      timestamp: eventTime.toISOString(),
      type: eventType,
      source: 'HISTORICAL_SAMPLE',
      device: {
        ip: deviceIP,
        name: 'DS-K1T34ICMFW Access Control'
      },
      data: {
        eventType: eventType,
        cardNo: employee.card,
        employeeId: employee.id,
        personName: employee.name,
        result: result,
        door: 'Main Entrance',
        confidence: result === 'Valid' ? Math.round((Math.random() * 20 + 80) * 10) / 10 : 0,
        note: 'Representative sample data - matches device capacity'
      }
    });
  }
  
  // Sort by timestamp (newest first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return events;
}

// Run the extraction
deviceDirectImport();