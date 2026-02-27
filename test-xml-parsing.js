// Test XML parsing logic locally

const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<EventNotificationAlert>
    <dateTime>2026-02-26T15:30:00+02:00</dateTime>
    <employeeNoString>1</employeeNoString>
    <name>azam</name>
    <attendanceStatus>checkOut</attendanceStatus>
    <major>5</major>
    <minor>75</minor>
</EventNotificationAlert>`;

console.log('Testing XML parsing...');
console.log('Raw XML:', testXml);

// Simple XML parsing for Hikvision webhook
const employeeMatch = testXml.match(/<employeeNoString[^>]*>([^<]*)<\/employeeNoString>/);
const nameMatch = testXml.match(/<name[^>]*>([^<]*)<\/name>/);
const statusMatch = testXml.match(/<attendanceStatus[^>]*>([^<]*)<\/attendanceStatus>/);
const timeMatch = testXml.match(/<dateTime[^>]*>([^<]*)<\/dateTime>/);

console.log('Parsed matches:');
console.log('- Employee:', employeeMatch ? employeeMatch[1] : 'NOT FOUND');
console.log('- Name:', nameMatch ? nameMatch[1] : 'NOT FOUND');  
console.log('- Status:', statusMatch ? statusMatch[1] : 'NOT FOUND');
console.log('- Time:', timeMatch ? timeMatch[1] : 'NOT FOUND');

if (employeeMatch && statusMatch) {
  const attendanceStatus = statusMatch[1];
  let action = 'unknown';
  
  console.log('Raw attendanceStatus:', `"${attendanceStatus}"`);
  console.log('Lowercase attendanceStatus:', `"${attendanceStatus.toLowerCase()}"`);
  
  // Map Hikvision status to action
  if (attendanceStatus === '1' || attendanceStatus.toLowerCase() === 'checkin') {
    action = 'clock-in';
    console.log('✅ Mapped to: clock-in');
  } else if (attendanceStatus === '2' || attendanceStatus.toLowerCase() === 'checkout') {
    action = 'clock-out';
    console.log('✅ Mapped to: clock-out');
  } else {
    console.log('❌ Unknown attendance status:', attendanceStatus);
  }
  
  const parsedData = {
    deviceId: 'admin',
    employeeId: employeeMatch[1],
    employeeName: nameMatch ? nameMatch[1] : null,
    action: action,
    timestamp: timeMatch ? timeMatch[1] : new Date().toISOString(),
    source: 'webhook'
  };
  
  console.log('✅ Final parsed data:', JSON.stringify(parsedData, null, 2));
} else {
  console.log('❌ Parsing failed');
}