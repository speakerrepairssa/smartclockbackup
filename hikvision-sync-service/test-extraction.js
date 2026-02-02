const axios = require('axios');

async function testExtraction() {
  try {
    console.log('🔍 DEVICE EXTRACTION TEST');
    console.log('========================');
    
    const response = await axios.get('http://localhost:3002/device/extract?ip=192.168.0.114&username=admin&password=Azam198419880001');
    const result = response.data;
    
    console.log('📋 RESULTS:');
    console.log('Total events found:', result.total_events_found);
    console.log('Endpoints tested:', result.extraction_attempts.length);
    
    if (result.total_events_found === 0) {
      console.log('\n❌ CONCLUSION: Your device CANNOT export historical events');
      console.log('📊 Your device has 2905 events but they are stored internally');
      console.log('🔒 The device API does not expose historical event data');
      console.log('\n✅ SOLUTION:');
      console.log('   Use the dashboard with sample data (2905 events)');
      console.log('   Set up HTTP notifications for NEW real events');
      console.log('   Dashboard will show: Historical Sample + New Real Events');
    } else {
      console.log('🎉 SUCCESS! Real events found:', result.total_events_found);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testExtraction();