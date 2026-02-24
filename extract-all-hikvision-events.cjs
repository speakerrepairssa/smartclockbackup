/**
 * Extract ALL events from Hikvision DS-K1T341AM device
 * Uses working JSON POST method discovered
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const admin = require('firebase-admin');

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://aiclock-5c365.firebaseio.com"
  });
}

const db = admin.firestore();

// Device config
const DEVICE_CONFIG = {
  ip: '192.168.7.2',
  username: 'admin',
  password: 'Azam198419880001'
};

// Event type codes
const EVENT_TYPES = {
  5: 'Access Control',
  minor: {
    8: 'Face+Password Success',
    21: 'Door Opened',
    22: 'Door Closed',
    75: 'Access Granted',
    76: 'Access Denied',
    151: 'Unknown Event'
  }
};

/**
 * Extract all events from device
 */
async function extractAllEvents() {
   console.log('\n🚀 Starting Hikvision Event Extraction');
  console.log('=====================================\n');

  const url = `http://${DEVICE_CONFIG.ip}/ISAPI/AccessControl/AcsEvent?format=json`;

  let searchResultPosition = 0;
  const maxResults = 100; // Max per page
  let totalExtracted = 0;
  let totalMatches = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      console.log(`📥 Fetching events ${searchResultPosition} to ${searchResultPosition + maxResults}...`);

      const requestBody = {
        AcsEventCond: {
          searchID: "1",
          searchResultPosition: searchResultPosition,
          maxResults: maxResults,
          major: 5, // Access Control events
          minor: 0  // All minors (0 = all)
        }
      };

      // Use curl with digest auth
      const curlCmd = `curl -s --digest -u ${DEVICE_CONFIG.username}:${DEVICE_CONFIG.password} \
        -X POST \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify(requestBody)}' \
        "${url}"`;

      const { stdout, stderr } = await execAsync(curlCmd);
      
      if (stderr) {
        console.error('  ⚠️  curl stderr:', stderr);
      }

      const data = JSON.parse(stdout);

      if (data.AcsEvent) {
        totalMatches = data.AcsEvent.totalMatches;
        const events = data.AcsEvent.InfoList || [];
        
        console.log(`  ✅ Received ${events.length} events (Total: ${totalMatches})`);

        // Process each event
        for (const event of events) {
          await processEvent(event);
          totalExtracted++;
        }

        // Check if there are more events
        searchResultPosition += events.length;
        hasMore = data.AcsEvent.responseStatusStrg === 'MORE' && events.length > 0;

        // Small delay between requests
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        console.error('❌ Unexpected response:', data);
        hasMore = false;
      }
    }

    console.log('\n✅ Extraction Complete!');
    console.log(`📊 Total events extracted: ${totalExtracted} / ${totalMatches}`);
    
  } catch (error) {
    console.error('❌ Error extracting events:', error.message);
    throw error;
  }
}

/**
 * Process and store a single event
 */
async function processEvent(event) {
  try {
    // Parse event data
    const eventData = {
      deviceId: 'hikvision-192.168.7.2',
      major: event.major,
      minor: event.minor,
      eventType: EVENT_TYPES.minor[event.minor] || `Unknown (${event.minor})`,
      rawTime: event.time,
      timestamp: parseTimestamp(event.time),
      
      // Employee info
      employeeNo: event.employeeNoString || null,
      employeeName: event.name || null,
      userType: event.userType || null,
      
      // Access details
      cardType: event.cardType || null,
      cardReaderNo: event.cardReaderNo || null,
      doorNo: event.doorNo || null,
      verifyMode: event.currentVerifyMode || null,
      mask: event.mask || null,
      
      // Picture
      pictureURL: event.pictureURL || null,
      picturesNumber: event.picturesNumber || 0,
      
      // Metadata
      serialNo: event.serialNo,
      type: event.type,
      
      // Processing
      processed: false,
      importedAt: admin.firestore.FieldValue.serverTimestamp(),
      
      // Raw data for debugging
      rawEvent: event
    };

    // Store in Firebase
    const eventRef = db.collection('hikvision_events').doc(`${DEVICE_CONFIG.ip}-${event.serialNo}`);
    await eventRef.set(eventData, { merge: true });

    // Log important events (access granted/denied)
    if ([75, 76, 8].includes(event.minor) && event.employeeNoString) {
      console.log(`  📝 ${eventData.eventType}: ${event.name || 'Unknown'} (ID: ${event.employeeNoString}) at ${event.time}`);
    }

  } catch (error) {
    console.error(`❌ Error processing event ${event.serialNo}:`, error.message);
  }
}

/**
 * Parse timestamp from device
 */
function parseTimestamp(timeString) {
  try {
    const date = new Date(timeString);
    
    // Check if date is valid and not from 1970 (device clock error)
    if (isNaN(date.getTime()) || date.getFullYear() < 2020) {
      return null;
    }
    
    return admin.firestore.Timestamp.fromDate(date);
  } catch (error) {
    return null;
  }
}

/**
 * Get extraction statistics
 */
async function getStats() {
  const snapshot = await db.collection('hikvision_events').get();
  const events = snapshot.docs.map(doc => doc.data());
  
  const stats = {
    total: events.length,
    byEmployee: {},
    byEventType: {},
    validTimestamps: 0,
    withPictures: 0
  };
  
  events.forEach(event => {
    // Count by employee
    if (event.employeeNo) {
      stats.byEmployee[event.employeeNo] = (stats.byEmployee[event.employeeNo] || 0) + 1;
    }
    
    // Count by event type
    stats.byEventType[event.eventType] = (stats.byEventType[event.eventType] || 0) + 1;
    
    // Count valid timestamps
    if (event.timestamp) {
      stats.validTimestamps++;
    }
    
    // Count events with pictures
    if (event.pictureURL) {
      stats.withPictures++;
    }
  });
  
  return stats;
}

/**
 * Main execution
 */
async function main() {
  try {
    await extractAllEvents();
    
    console.log('\n📊 Generating statistics...\n');
    const stats = await getStats();
    
    console.log('Event Statistics:');
    console.log('=================');
    console.log(`Total events: ${stats.total}`);
    console.log(`Valid timestamps: ${stats.validTimestamps}`);
    console.log(`Events with pictures: ${stats.withPictures}`);
    console.log('\nBy Employee:');
    Object.entries(stats.byEmployee).forEach(([empNo, count]) => {
      console.log(`  Employee ${empNo}: ${count} events`);
    });
    console.log('\nBy Event Type:');
    Object.entries(stats.byEventType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    console.log('\n✅ All done!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Extraction failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { extractAllEvents, getStats };
