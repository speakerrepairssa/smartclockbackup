/**
 * Extract ALL events from Hikvision to JSON file
 * No Firebase required
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const execAsync = promisify(exec);

// Device config
const DEVICE_CONFIG = {
  ip: '192.168.7.2',
  username: 'admin',
  password: 'Azam198419880001'
};

async function extractAllEvents() {
  console.log('\n🚀 Extracting All Hikvision Events to JSON');
  console.log('==========================================\n');

  const url =`http://${DEVICE_CONFIG.ip}/ISAPI/AccessControl/AcsEvent?format=json`;const allEvents = [];
  let searchResultPosition = 0;
  const maxResults = 100;
  let hasMore = true;

  try {
    while (hasMore) {
      console.log(`📥 Fetching events ${searchResultPosition} to ${searchResultPosition + maxResults}...`);

      const requestBody = {
        AcsEventCond: {
          searchID: "1",
          searchResultPosition: searchResultPosition,
          maxResults: maxResults,
          major: 5,
          minor: 0
        }
      };

      const curlCmd = `curl -s --digest -u ${DEVICE_CONFIG.username}:${DEVICE_CONFIG.password} \\
        -X POST \\
        -H "Content-Type: application/json" \\
        -d '${JSON.stringify(requestBody)}' \\
        "${url}"`;

      const { stdout } = await execAsync(curlCmd);
      const data = JSON.parse(stdout);

      if (data.AcsEvent) {
        const events = data.AcsEvent.InfoList || [];
        console.log(`  ✅ Received ${events.length} events (Total: ${data.AcsEvent.totalMatches})`);

        allEvents.push(...events);
        searchResultPosition += events.length;
        hasMore = data.AcsEvent.responseStatusStrg === 'MORE' && events.length > 0;

        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
hasMore = false;
      }
    }

    // Save to JSON file
    const outputFile = 'hikvision-events-export.json';
    await fs.writeFile(outputFile, JSON.stringify(allEvents, null, 2));

    console.log(`\n✅ Extraction Complete!`);
    console.log(`📊 Total events extracted: ${allEvents.length}`);
    console.log(`💾 Saved to: ${outputFile}\n`);

    // Generate statistics
    const stats = generateStats(allEvents);
    console.log('\n📊 Statistics:');
    console.log('==============');
    console.log(`Total events: ${stats.total}`);
    console.log(`\nBy Employee:`);
    Object.entries(stats.byEmployee).forEach(([name, count]) => {
      console.log(`  ${name}: ${count} events`);
    });
    console.log(`\nBy Event Type:`);
    Object.entries(stats.byEventType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    console.log(`\nDate Range:`);
    console.log(`  Earliest: ${stats.earliestDate}`);
    console.log(`  Latest: ${stats.latestDate}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function generateStats(events) {
  const stats = {
    total: events.length,
    byEmployee: {},
    byEventType: {},
    dates: []
  };

  const eventTypeNames = {
    8: 'Face+Password Success',
    21: 'Door Opened',
    22: 'Door Closed',
    75: 'Access Granted',
    76: 'Access Denied',
    151: 'Unknown Event'
  };

  events.forEach(event => {
    // Count by employee
    if (event.name) {
      const key = `${event.name} (ID: ${event.employeeNoString})`;
      stats.byEmployee[key] = (stats.byEmployee[key] || 0) + 1;
    }

    // Count by event type
    const typeName = eventTypeNames[event.minor] || `Unknown (${event.minor})`;
    stats.byEventType[typeName] = (stats.byEventType[typeName] || 0) + 1;

    // Collect dates
    if (event.time && !event.time.startsWith('1970')) {
      stats.dates.push(new Date(event.time));
    }
  });

  // Get date range
  if (stats.dates.length > 0) {
    stats.dates.sort((a, b) => a - b);
    stats.earliestDate = stats.dates[0].toISOString();
    stats.latestDate = stats.dates[stats.dates.length - 1].toISOString();
  } else {
    stats.earliestDate = 'N/A';
    stats.latestDate = 'N/A';
  }

  return stats;
}

extractAllEvents();
