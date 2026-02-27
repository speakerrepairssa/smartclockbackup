// Test corrected field mapping for Firebase

const testXmlCheckOut = `<?xml version="1.0" encoding="UTF-8"?>
<EventNotificationAlert>
    <dateTime>2026-02-26T15:30:00+02:00</dateTime>
    <employeeNoString>1</employeeNoString>
    <name>azam</name>
    <attendanceStatus>checkOut</attendanceStatus>
    <major>5</major>
    <minor>75</minor>
</EventNotificationAlert>`;

const testXmlCheckIn = `<?xml version="1.0" encoding="UTF-8"?>
<EventNotificationAlert>
    <dateTime>2026-02-26T15:30:00+02:00</dateTime>
    <employeeNoString>1</employeeNoString>
    <name>azam</name>
    <attendanceStatus>checkIn</attendanceStatus>
    <major>5</major>
    <minor>75</minor>
</EventNotificationAlert>`;

function testParsing(xml, testName) {
  console.log(`\n=== ${testName} ===`);
  
  const employeeMatch = xml.match(/<employeeNoString[^>]*>([^<]*)<\/employeeNoString>/);
  const nameMatch = xml.match(/<name[^>]*>([^<]*)<\/name>/);
  const statusMatch = xml.match(/<attendanceStatus[^>]*>([^<]*)<\/attendanceStatus>/);
  const timeMatch = xml.match(/<dateTime[^>]*>([^<]*)<\/dateTime>/);

  if (employeeMatch && statusMatch) {
    const attendanceStatus = statusMatch[1];
    let action = 'unknown';
    
    // Map Hikvision status to action
    if (attendanceStatus === '1' || attendanceStatus.toLowerCase() === 'checkin') {
      action = 'clock-in';
    } else if (attendanceStatus === '2' || attendanceStatus.toLowerCase() === 'checkout') {
      action = 'clock-out';
    }
    
    // NEW: Correct Firebase field mapping
    const parsedData = {
      deviceId: 'admin',
      employeeId: employeeMatch[1],
      employeeName: nameMatch ? nameMatch[1] : null,
      attendanceStatus: action === 'clock-in' ? 'in' : 'out', // ✅ Firebase expects this
      eventType: action === 'clock-in' ? 'checkin' : 'checkout',
      action: action, // Keep for compatibility
      timestamp: timeMatch ? timeMatch[1] : new Date().toISOString(),
      source: 'webhook'
    };
    
    console.log('✅ Parsed data for Firebase:');
    console.log(JSON.stringify(parsedData, null, 2));
    
    return parsedData;
  }
}

// Test both scenarios
const checkOutData = testParsing(testXmlCheckOut, "CLOCK OUT Test");
const checkInData = testParsing(testXmlCheckIn, "CLOCK IN Test");

console.log('\n=== Summary ===');
console.log('Clock OUT sends: attendanceStatus =', checkOutData.attendanceStatus);
console.log('Clock IN sends:  attendanceStatus =', checkInData.attendanceStatus);
console.log('✅ These should work with Firebase now!');