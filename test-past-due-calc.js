// Test past due hours calculation  
// Today is Monday, February 9th, 2026

const today = new Date(2026, 1, 9); // February 9, 2026 (month is 0-indexed)
const monthStart = new Date(2026, 1, 1); // February 1, 2026
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1); // Feb 8th

console.log('=== PAST DUE HOURS CALCULATION TEST ===');
console.log('Today:', today.toDateString());
console.log('Month start:', monthStart.toDateString()); 
console.log('Yesterday:', yesterday.toDateString());

// Verify what day Feb 1st actually is
console.log(`Feb 1, 2026 is actually a ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][monthStart.getDay()]}`);

let pastDueHours = 0;
let dayCount = 0;

const currentDate = new Date(monthStart);
console.log('\n=== Days calculation for Employee 4 "test1hr" ===');
console.log('Shift schedule from screenshot:');
console.log('- Mon-Fri: 08:30-17:30 (8 hours after 60min break)');
console.log('- Sat: 08:30-14:30 (5 hours after 60min break)');  
console.log('- Sun: Off (0 hours)');

while (currentDate <= yesterday) {
  const dayOfWeek = currentDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  let hoursForDay = 0;
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    hoursForDay = 8; // Monday to Friday: 08:30-17:30 minus 60min = 8 hours
  } else if (dayOfWeek === 6) {
    hoursForDay = 5; // Saturday: 08:30-14:30 minus 60min = 5 hours  
  }
  // Sunday: 0 hours (off day)
  
  pastDueHours += hoursForDay;
  dayCount++;
  
  console.log(`${currentDate.toDateString()} (${dayNames[dayOfWeek]}): ${hoursForDay} hours`);
  
  currentDate.setDate(currentDate.getDate() + 1);
}

console.log(`\n=== MANUAL VERIFICATION ===`);
console.log('Expected breakdown:');
console.log('Feb 1 (Sat): 5 hours');
console.log('Feb 2 (Sun): 0 hours'); 
console.log('Feb 3 (Mon): 8 hours');
console.log('Feb 4 (Tue): 8 hours');
console.log('Feb 5 (Wed): 8 hours');
console.log('Feb 6 (Thu): 8 hours');
console.log('Feb 7 (Fri): 8 hours');
console.log('Feb 8 (Sat): 5 hours');
console.log('Expected total: 5+0+8+8+8+8+8+5 = 50 hours');

console.log(`\n=== ACTUAL RESULT ===`);
console.log(`Total days calculated: ${dayCount}`);
console.log(`Total past due hours: ${pastDueHours}`);
console.log(`Expected for Employee 4: 50 hours`);
console.log(`Match: ${pastDueHours === 50 ? '✅ YES' : '❌ NO - Difference: ' + (50 - pastDueHours)}`);