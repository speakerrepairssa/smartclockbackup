// 🏭 Hikvision Device Configuration Script for AiClock
// This script helps you configure your Hikvision devices to work with the production Data Connect system

// 📋 DEVICE CONFIGURATION CHECKLIST
console.log(`
🔧 HIKVISION DEVICE SETUP CHECKLIST

Before starting live sync, make sure your Hikvision devices are configured:

1. 🌐 NETWORK CONFIGURATION:
   ☐ Device has static IP address
   ☐ Device is accessible from this computer
   ☐ HTTP service is enabled on device
   ☐ Port 80 is open and accessible

2. 👤 ACCESS CONTROL SETTINGS:
   ☐ Admin username and password set
   ☐ Access control events enabled
   ☐ Event notifications configured
   ☐ Card/face recognition activated

3. 📊 DATA CAPTURE:
   ☐ Event logging enabled
   ☐ Time synchronization configured
   ☐ Employee IDs/cards registered
   ☐ Event types mapped correctly

4. 🔗 AICLOCK INTEGRATION:
   ☐ Device IPs updated in production-dashboard-config.js
   ☐ Credentials updated in configuration
   ☐ Employee mapping configured
   ☐ Live sync tested

📝 QUICK SETUP COMMANDS:
`);

// Test device connectivity
async function testHikvisionDevice(deviceIP, username, password) {
  try {
    console.log(`🔌 Testing connection to ${deviceIP}...`);
    
    // Test basic device info endpoint
    const response = await fetch(`http://${deviceIP}/ISAPI/System/deviceInfo`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${username}:${password}`),
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const deviceInfo = await response.json();
      console.log('✅ Device connected successfully!');
      console.log('Device Info:', deviceInfo);
      return { success: true, deviceInfo };
    } else {
      console.log('❌ Connection failed:', response.status, response.statusText);
      return { success: false, error: response.statusText };
    }
    
  } catch (error) {
    console.log('❌ Connection error:', error.message);
    return { success: false, error: error.message };
  }
}

// Get recent events from device
async function getRecentEvents(deviceIP, username, password, hours = 1) {
  try {
    console.log(`📡 Fetching recent events from ${deviceIP}...`);
    
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const response = await fetch(`http://${deviceIP}/ISAPI/AccessControl/AcsEvent?format=json&startTime=${startTime}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${username}:${password}`),
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const eventsData = await response.json();
      console.log(`✅ Retrieved ${eventsData.AcsEvent?.length || 0} events`);
      return { success: true, events: eventsData.AcsEvent || [] };
    } else {
      console.log('❌ Failed to get events:', response.status);
      return { success: false, error: response.statusText };
    }
    
  } catch (error) {
    console.log('❌ Events fetch error:', error.message);
    return { success: false, error: error.message };
  }
}

// Setup wizard function
async function runDeviceSetupWizard() {
  console.log('\n🧙‍♂️ HIKVISION DEVICE SETUP WIZARD');
  console.log('=====================================');
  
  // You'll need to customize these values
  const deviceIP = '192.168.1.100';     // 👈 CHANGE TO YOUR DEVICE IP
  const username = 'admin';              // 👈 CHANGE TO YOUR USERNAME  
  const password = 'password';           // 👈 CHANGE TO YOUR PASSWORD
  
  console.log(`\n1. Testing device connection...`);
  const connectionTest = await testHikvisionDevice(deviceIP, username, password);
  
  if (connectionTest.success) {
    console.log(`\n2. Testing event data retrieval...`);
    const eventsTest = await getRecentEvents(deviceIP, username, password, 24);
    
    if (eventsTest.success) {
      console.log(`\n✅ DEVICE SETUP COMPLETE!`);
      console.log(`\nYour device ${deviceIP} is ready for live sync.`);
      console.log(`\nNext steps:`);
      console.log(`1. Update device IP in production-dashboard-config.js`);
      console.log(`2. Update credentials in the configuration`);
      console.log(`3. Click "Start Live Sync" in your dashboard`);
      
      return { success: true, deviceIP, events: eventsTest.events };
    }
  }
  
  console.log(`\n❌ SETUP FAILED`);
  console.log(`\nTroubleshooting:`);
  console.log(`• Check device IP address: ${deviceIP}`);
  console.log(`• Verify username/password: ${username}/${password}`);
  console.log(`• Ensure device HTTP service is enabled`);
  console.log(`• Check network connectivity`);
  console.log(`• Verify access control events are enabled`);
  
  return { success: false };
}

// Export functions for use in dashboard
window.deviceSetup = {
  testDevice: testHikvisionDevice,
  getEvents: getRecentEvents,
  runWizard: runDeviceSetupWizard
};

// Configuration templates
console.log(`

📄 CONFIGURATION TEMPLATES:

1. Update production-dashboard-config.js with your device info:

const HIKVISION_DEVICES = {
  main_entrance: {
    ip: "192.168.1.100",        // 👈 YOUR DEVICE IP
    port: 80,
    username: "admin",          // 👈 YOUR USERNAME
    password: "password123",    // 👈 YOUR PASSWORD
    name: "Main Entrance",
    location: "Front Door"
  }
};

2. Employee Card/Badge Mapping:
   - Register employee cards in Hikvision device
   - Map card numbers to employee slot IDs
   - Ensure badge numbers match your imported employees

3. Ready to start? Run in browser console:
   deviceSetup.runWizard()

🚀 Your AiClock system is ready for live attendance capture!
`);

export { testHikvisionDevice, getRecentEvents, runDeviceSetupWizard };