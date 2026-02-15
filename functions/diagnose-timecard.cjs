const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

async function diagnoseEmployee() {
  const businessId = 'biz_speaker_repairs';
  const month = '2026-02';
  const [year, monthNum] = month.split('-');
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  
  console.log('\n🔍 DIAGNOSTIC: Checking attendance data for', businessId, month);
  console.log('=' .repeat(80));
  
  // Get all staff
  const staffSnap = await db.collection('businesses').doc(businessId)
    .collection('staff').get();
  
  console.log('\n👥 Found', staffSnap.size, 'staff members');
  
  for (const staffDoc of staffSnap.docs) {
    const employee = staffDoc.data();
    const employeeId = staffDoc.id;
    const employeeName = employee.employeeName || `Employee ${employee.slot}`;
    
    if (!employeeName || employeeName.match(/^Employee \d+$/)) {
      continue; // Skip empty slots
    }
    
    console.log('\n📊 Employee:', employeeName, `(ID: ${employeeId}, Slot: ${employee.slot})`);
    console.log('-'.repeat(80));
    
    let totalMinutesFound = 0;
    let daysWithData = 0;
    const dailyBreakdown = [];
    
    // Check each day
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Query nested structure
      const dayEventsRef = db.collection('businesses').doc(businessId)
        .collection('attendance_events').doc(dateStr).collection(employeeId);
      const dayEventsSnap = await dayEventsRef.get();
      
      if (!dayEventsSnap.empty) {
        const events = [];
        dayEventsSnap.forEach(doc => {
          const event = doc.data();
          if (!event.testMode && !(event.status === 'pending' && !event.resolvedManually)) {
            events.push({
              type: event.type || (event.attendanceStatus === 'in' ? 'clock-in' : 'clock-out'),
              timestamp: event.timestamp.toDate ? event.timestamp.toDate() : new Date(event.timestamp)
            });
          }
        });
        
        if (events.length > 0) {
          // Sort by timestamp
          events.sort((a, b) => a.timestamp - b.timestamp);
          
          // Calculate minutes worked (chronological pairing)
          let dayMinutes = 0;
          let currentClockIn = null;
          
          for (const event of events) {
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
            daysWithData++;
            totalMinutesFound += dayMinutes;
            dailyBreakdown.push({
              date: dateStr,
              minutes: dayMinutes,
              hours: dayMinutes / 60,
              events: events.length
            });
            console.log(`  ${dateStr}: ${(dayMinutes/60).toFixed(2)}h (${dayMinutes.toFixed(0)}min) - ${events.length} events`);
          }
        }
      }
    }
    
    if (daysWithData === 0) {
      console.log('  ❌ No attendance data found for this month');
    } else {
      const totalHours = totalMinutesFound / 60;
      const breakMinutes = 60; // Default break per day
      const totalBreakHours = (daysWithData * breakMinutes) / 60;
      const payableHours = Math.max(0, totalHours - totalBreakHours);
      
      console.log('\n  📈 SUMMARY:');
      console.log(`     Days with data: ${daysWithData}`);
      console.log(`     Raw hours worked: ${totalHours.toFixed(2)}h`);
      console.log(`     Break deduction (${breakMinutes}min × ${daysWithData} days): ${totalBreakHours.toFixed(2)}h`);
      console.log(`     Payable hours: ${payableHours.toFixed(2)}h`);
      
      if (payableHours === 0 && totalHours > 0) {
        console.log('\n  ⚠️  WARNING: Break time exceeds work time!');
        console.log(`     Solution 1: Set break to 0 for short shifts`);
        console.log(`     Solution 2: Only deduct break if worked > ${breakMinutes} minutes`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Diagnostic complete\n');
  process.exit(0);
}

diagnoseEmployee().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
