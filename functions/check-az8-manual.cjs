const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

async function checkAz8Events() {
  const businessId = 'biz_speaker_repairs';
  const month = '2026-02';
  const [year, monthNum] = month.split('-');
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  
  console.log('\n🔍 MANUAL CALCULATION FOR az8');
  console.log('=' .repeat(80));
  
  // Find az8 employee
  const staffSnap = await db.collection('businesses').doc(businessId)
    .collection('staff').get();
  
  let az8Id = null;
  let az8Name = null;
  
  staffSnap.forEach(doc => {
    const emp = doc.data();
    if (emp.employeeName === 'az8') {
      az8Id = doc.id;
      az8Name = emp.employeeName;
      console.log(`✅ Found az8: ID=${az8Id}, Slot=${emp.slot}`);
    }
  });
  
  if (!az8Id) {
    console.log('❌ Could not find az8 employee');
    process.exit(1);
  }
  
  console.log('\n📅 Checking all attendance events in February 2026...\n');
  
  const allEvents = [];
  
  // Check nested structure
  console.log('Strategy 1: Nested structure (attendance_events/{date}/{employeeId}/*)');
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const dayEventsRef = db.collection('businesses').doc(businessId)
      .collection('attendance_events').doc(dateStr).collection(az8Id);
    const dayEventsSnap = await dayEventsRef.get();
    
    if (!dayEventsSnap.empty) {
      dayEventsSnap.forEach(doc => {
        const event = doc.data();
        allEvents.push({
          source: 'nested',
          date: dateStr,
          docId: doc.id,
          type: event.type || (event.attendanceStatus === 'in' ? 'clock-in' : 'clock-out'),
          timestamp: event.timestamp.toDate ? event.timestamp.toDate() : new Date(event.timestamp),
          testMode: event.testMode || false,
          status: event.status,
          resolvedManually: event.resolvedManually || false
        });
      });
    }
  }
  
  // Check flat structure
  console.log('Strategy 2: Flat structure (attendance_events/*)');
  const flatRef = db.collection('businesses').doc(businessId).collection('attendance_events');
  const flatSnap = await flatRef.get();
  
  const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${daysInMonth}`;
  
  flatSnap.forEach(doc => {
    const event = doc.data();
    if (event.employeeId === az8Id && event.timestamp) {
      const timestamp = event.timestamp.toDate ? event.timestamp.toDate() : new Date(event.timestamp);
      const dateStr = timestamp.toISOString().split('T')[0];
      
      if (dateStr >= startDate && dateStr <= endDate) {
        allEvents.push({
          source: 'flat',
          date: dateStr,
          docId: doc.id,
          type: event.type || (event.attendanceStatus === 'in' ? 'clock-in' : 'clock-out'),
          timestamp: timestamp,
          testMode: event.testMode || false,
          status: event.status,
          resolvedManually: event.resolvedManually || false
        });
      }
    }
  });
  
  // Sort all events by timestamp
  allEvents.sort((a, b) => a.timestamp - b.timestamp);
  
  console.log(`\n📊 Total events found: ${allEvents.length}\n`);
  
  // Display all events
  allEvents.forEach((event, index) => {
    const time = event.timestamp.toLocaleTimeString('en-US', { hour12: false });
    const skip = event.testMode ? '[TEST]' : 
                 (event.status === 'pending' && !event.resolvedManually) ? '[PENDING]' : '';
    console.log(`${index + 1}. ${event.date} ${time} - ${event.type.padEnd(10)} ${skip} (${event.source})`);
  });
  
  // Filter valid events (no test, no pending)
  const validEvents = allEvents.filter(e => 
    !e.testMode && !(e.status === 'pending' && !e.resolvedManually)
  );
  
  console.log(`\n✅ Valid events (excluding test & pending): ${validEvents.length}\n`);
  
  // Group by date
  const eventsByDate = {};
  validEvents.forEach(event => {
    if (!eventsByDate[event.date]) {
      eventsByDate[event.date] = [];
    }
    eventsByDate[event.date].push(event);
  });
  
  // Calculate hours per day
  let totalMinutes = 0;
  let totalDays = 0;
  
  Object.keys(eventsByDate).sort().forEach(dateStr => {
    const dayEvents = eventsByDate[dateStr].sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`\n📅 ${dateStr}:`);
    dayEvents.forEach(e => {
      const time = e.timestamp.toLocaleTimeString('en-US', { hour12: false });
      console.log(`   ${time} - ${e.type}`);
    });
    
    // Chronological pairing
    let dayMinutes = 0;
    let currentClockIn = null;
    
    for (const event of dayEvents) {
      if (event.type.toLowerCase().includes('in')) {
        currentClockIn = event.timestamp;
      } else if (event.type.toLowerCase().includes('out') && currentClockIn) {
        const diffMs = event.timestamp.getTime() - currentClockIn.getTime();
        const diffMinutes = Math.max(0, diffMs / (1000 * 60));
        dayMinutes += diffMinutes;
        currentClockIn = null;
      }
    }
    
    if (dayMinutes > 0) {
      const dayHours = dayMinutes / 60;
      console.log(`   ⏱️  Worked: ${dayHours.toFixed(2)}h (${dayMinutes.toFixed(0)} minutes)`);
      
      // Apply break logic (60 min break only if worked > 2 hours)
      const breakMinutes = 60;
      const minimumForBreak = (breakMinutes / 60) + 1; // 2 hours
      
      let payableHours;
      if (dayHours < minimumForBreak) {
        payableHours = dayHours;
        console.log(`   💰 Payable: ${payableHours.toFixed(2)}h (short shift, no break)`);
      } else {
        payableHours = dayHours - (breakMinutes / 60);
        console.log(`   💰 Payable: ${payableHours.toFixed(2)}h (after ${breakMinutes}min break)`);
      }
      
      totalMinutes += (payableHours * 60);
      totalDays++;
    } else {
      console.log(`   ⚠️  No complete clock-in/out pairs`);
    }
  });
  
  const totalHours = totalMinutes / 60;
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n🎯 FINAL CALCULATION FOR az8:`);
  console.log(`   Days worked: ${totalDays}`);
  console.log(`   Total payable hours: ${totalHours.toFixed(2)}h`);
  console.log(`\n` + '='.repeat(80));
  
  process.exit(0);
}

checkAz8Events().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
