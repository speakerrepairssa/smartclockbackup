/**
 * 🎯 HIKVISION EVENT SYNC SCRIPT
 * Pulls all attendance events directly from Hikvision devices via HTTP API
 * Can be run on server as backup/verification or manual sync
 */

const axios = require('axios');
const fs = require('fs');
const https = require('https');

// Configuration
const CONFIG = {
  devices: [
    {
      id: 'FC4349999',
      name: 'Terminal 1',
      ip: '192.168.7.4',
      port: 80,
      username: 'admin',
      password: 'your_password_here' // Replace with actual password
    },
    {
      id: 'FC4349998', 
      name: 'Terminal 2',
      ip: '192.168.7.5',
      port: 80,
      username: 'admin',
      password: 'your_password_here' // Replace with actual password
    }
  ],
  
  // Date range for pulling events (YYYY-MM-DD format)
  dateRange: {
    startDate: '2026-01-01',
    endDate: '2026-01-31'
  },
  
  // Output options
  output: {
    console: true,          // Print to console
    csvFile: true,          // Save to CSV
    jsonFile: true,         // Save to JSON
    firebaseSync: true      // Sync to Firebase (requires Firebase config)
  },
  
  // Firebase config (if syncing to Firebase)
  firebase: {
    projectId: 'aiclock-82608',
    businessId: 'your_business_id_here' // Replace with actual business ID
  }
};

// HTTP client with digest auth support
const httpsAgent = new https.Agent({
  rejectUnauthorized: false // For self-signed certificates
});

/**
 * 🔐 AUTHENTICATE WITH HIKVISION DEVICE
 */
async function authenticateDevice(device) {
  try {
    console.log(`🔐 Authenticating with ${device.name} (${device.ip})...`);
    
    const auth = Buffer.from(`${device.username}:${device.password}`).toString('base64');
    
    // Test connection with device info endpoint
    const response = await axios.get(`http://${device.ip}:${device.port}/ISAPI/System/deviceInfo`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/xml'
      },
      timeout: 10000,
      httpsAgent
    });
    
    console.log(`✅ Connected to ${device.name} - ${response.status}`);
    return auth;
    
  } catch (error) {
    console.error(`❌ Failed to authenticate with ${device.name}:`, error.message);
    throw error;
  }
}

/**
 * 📥 GET ATTENDANCE EVENTS FROM DEVICE
 */
async function getAttendanceEvents(device, auth, startDate, endDate) {
  try {
    console.log(`📥 Fetching events from ${device.name} (${startDate} to ${endDate})...`);
    
    // Hikvision attendance log endpoint
    const url = `http://${device.ip}:${device.port}/ISAPI/AccessControl/AcsEvent`;
    
    // XML payload for date range query
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
    <AcsEventCond>
        <searchID>1</searchID>
        <maxResults>1000</maxResults>
        <searchResultPosition>0</searchResultPosition>
        <major>5</major>
        <minor>75</minor>
        <startTime>${startDate}T00:00:00</startTime>
        <endTime>${endDate}T23:59:59</endTime>
    </AcsEventCond>`;
    
    const response = await axios.post(url, xmlPayload, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/xml',
        'Accept': 'application/xml'
      },
      timeout: 30000,
      httpsAgent
    });
    
    console.log(`📦 Received response from ${device.name}`);
    
    // Parse XML response
    const events = parseHikvisionXML(response.data, device);
    
    console.log(`✅ Parsed ${events.length} events from ${device.name}`);
    return events;
    
  } catch (error) {
    console.error(`❌ Failed to get events from ${device.name}:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data?.substring(0, 500));
    }
    return [];
  }
}

/**
 * 🔍 PARSE HIKVISION XML RESPONSE
 */
function parseHikvisionXML(xmlData, device) {
  const events = [];
  
  try {
    // Simple XML parsing (you might want to use a proper XML parser like xml2js)
    const matches = xmlData.match(/<InfoList>(.*?)<\/InfoList>/gs);
    
    if (!matches) {
      console.log('No InfoList found in response');
      return events;
    }
    
    for (const match of matches) {
      // Extract event data using regex (basic parsing)
      const employeeNoMatch = match.match(/<employeeNoString>(.*?)<\/employeeNoString>/);
      const timeMatch = match.match(/<time>(.*?)<\/time>/);
      const typeMatch = match.match(/<type>(.*?)<\/type>/);
      const nameMatch = match.match(/<name>(.*?)<\/name>/);
      
      if (employeeNoMatch && timeMatch) {
        const employeeNo = employeeNoMatch[1];
        const timestamp = timeMatch[1];
        const eventType = typeMatch ? typeMatch[1] : 'unknown';
        const name = nameMatch ? nameMatch[1] : `Employee ${employeeNo}`;
        
        // Convert Hikvision event type to our format
        let attendanceStatus = 'unknown';
        if (eventType === '1' || eventType.includes('checkIn')) {
          attendanceStatus = 'in';
        } else if (eventType === '2' || eventType.includes('checkOut')) {
          attendanceStatus = 'out';
        }
        
        events.push({
          deviceId: device.id,
          deviceName: device.name,
          deviceIP: device.ip,
          employeeId: employeeNo,
          employeeName: name,
          verifyNo: employeeNo,
          timestamp: timestamp,
          attendanceStatus: attendanceStatus,
          type: attendanceStatus === 'in' ? 'clock-in' : 'clock-out',
          eventType: eventType,
          source: 'hikvision-api',
          rawData: match
        });
      }
    }
    
  } catch (parseError) {
    console.error('Error parsing XML:', parseError.message);
  }
  
  return events;
}

/**
 * 💾 SAVE EVENTS TO CSV FILE
 */
function saveToCSV(events, filename = 'hikvision-events.csv') {
  try {
    const headers = [
      'Date', 'Time', 'Device ID', 'Device Name', 'Employee ID', 
      'Employee Name', 'Action', 'Event Type', 'Timestamp'
    ];
    
    const rows = events.map(event => {
      const date = new Date(event.timestamp);
      return [
        date.toISOString().split('T')[0], // Date
        date.toLocaleTimeString('en-US', { hour12: false }), // Time  
        event.deviceId,
        event.deviceName,
        event.employeeId,
        event.employeeName,
        event.attendanceStatus.toUpperCase(),
        event.eventType,
        event.timestamp
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    fs.writeFileSync(filename, csvContent);
    console.log(`💾 Saved ${events.length} events to ${filename}`);
    
  } catch (error) {
    console.error('Error saving CSV:', error.message);
  }
}

/**
 * 💾 SAVE EVENTS TO JSON FILE  
 */
function saveToJSON(events, filename = 'hikvision-events.json') {
  try {
    const jsonData = {
      exportDate: new Date().toISOString(),
      totalEvents: events.length,
      dateRange: CONFIG.dateRange,
      devices: CONFIG.devices.map(d => ({ id: d.id, name: d.name, ip: d.ip })),
      events: events
    };
    
    fs.writeFileSync(filename, JSON.stringify(jsonData, null, 2));
    console.log(`💾 Saved ${events.length} events to ${filename}`);
    
  } catch (error) {
    console.error('Error saving JSON:', error.message);
  }
}

/**
 * 🔄 SYNC EVENTS TO FIREBASE (Optional)
 */
async function syncToFirebase(events) {
  try {
    console.log('🔄 Syncing events to Firebase...');
    
    // This would require Firebase Admin SDK
    // For now, just show the format for manual import
    
    const firebaseEvents = events.map(event => ({
      businessId: CONFIG.firebase.businessId,
      employeeId: event.employeeId,
      employeeName: event.employeeName,
      slotNumber: parseInt(event.employeeId),
      timestamp: event.timestamp,
      type: event.type,
      attendanceStatus: event.attendanceStatus,
      deviceId: event.deviceId,
      source: 'hikvision-sync',
      syncedAt: new Date().toISOString()
    }));
    
    console.log('📋 Firebase format events ready:', firebaseEvents.length);
    
    // Save Firebase format to separate file for manual import
    fs.writeFileSync('firebase-import.json', JSON.stringify(firebaseEvents, null, 2));
    console.log('💾 Saved Firebase format to firebase-import.json');
    
  } catch (error) {
    console.error('Error syncing to Firebase:', error.message);
  }
}

/**
 * 📊 GENERATE SUMMARY REPORT
 */
function generateSummary(allEvents) {
  console.log('\n📊 SYNC SUMMARY');
  console.log('================');
  console.log(`Total Events: ${allEvents.length}`);
  console.log(`Date Range: ${CONFIG.dateRange.startDate} to ${CONFIG.dateRange.endDate}`);
  
  // Group by device
  const byDevice = {};
  const byEmployee = {};
  const byDate = {};
  
  allEvents.forEach(event => {
    // By device
    if (!byDevice[event.deviceName]) byDevice[event.deviceName] = 0;
    byDevice[event.deviceName]++;
    
    // By employee  
    if (!byEmployee[event.employeeName]) byEmployee[event.employeeName] = 0;
    byEmployee[event.employeeName]++;
    
    // By date
    const date = event.timestamp.split('T')[0];
    if (!byDate[date]) byDate[date] = 0;
    byDate[date]++;
  });
  
  console.log('\n📱 Events by Device:');
  Object.entries(byDevice).forEach(([device, count]) => {
    console.log(`  ${device}: ${count} events`);
  });
  
  console.log('\n👥 Events by Employee:');
  Object.entries(byEmployee).forEach(([employee, count]) => {
    console.log(`  ${employee}: ${count} events`);
  });
  
  console.log('\n📅 Events by Date:');
  Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, count]) => {
      console.log(`  ${date}: ${count} events`);
    });
}

/**
 * 🚀 MAIN EXECUTION FUNCTION
 */
async function main() {
  console.log('🎯 HIKVISION EVENT SYNC STARTING...');
  console.log(`📅 Date range: ${CONFIG.dateRange.startDate} to ${CONFIG.dateRange.endDate}`);
  console.log(`📱 Devices: ${CONFIG.devices.length}`);
  console.log('');
  
  const allEvents = [];
  
  try {
    // Process each device
    for (const device of CONFIG.devices) {
      try {
        // Authenticate
        const auth = await authenticateDevice(device);
        
        // Get events
        const events = await getAttendanceEvents(
          device, 
          auth, 
          CONFIG.dateRange.startDate, 
          CONFIG.dateRange.endDate
        );
        
        allEvents.push(...events);
        
      } catch (deviceError) {
        console.error(`❌ Failed to process device ${device.name}:`, deviceError.message);
        continue;
      }
    }
    
    // Sort all events by timestamp
    allEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Output results
    if (CONFIG.output.console) {
      console.log('\n📋 ALL EVENTS:');
      allEvents.forEach((event, index) => {
        console.log(`${index + 1}. ${event.timestamp} | ${event.deviceName} | ${event.employeeName} | ${event.attendanceStatus.toUpperCase()}`);
      });
    }
    
    if (CONFIG.output.csvFile) {
      saveToCSV(allEvents);
    }
    
    if (CONFIG.output.jsonFile) {
      saveToJSON(allEvents);
    }
    
    if (CONFIG.output.firebaseSync) {
      await syncToFirebase(allEvents);
    }
    
    // Generate summary
    generateSummary(allEvents);
    
    console.log('\n✅ SYNC COMPLETED SUCCESSFULLY!');
    
  } catch (error) {
    console.error('❌ SYNC FAILED:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  main,
  getAttendanceEvents,
  authenticateDevice,
  CONFIG
};