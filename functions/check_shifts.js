const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkShifts() {
  const businessId = 'biz_srcomponents';

  // Get business settings
  const businessDoc = await db.collection('businesses').doc(businessId).get();
  const businessData = businessDoc.data();

  console.log('\n=== BUSINESS DEFAULT SETTINGS ===');
  console.log('Default Schedule Start:', businessData.defaultScheduledStartTime);
  console.log('Default Schedule End:', businessData.defaultScheduledEndTime);
  console.log('Default Scheduled Hours:', businessData.defaultScheduledWorkHours);
  console.log('Break Minutes:', businessData.breakMinutes);
  console.log('Saturday Start:', businessData.saturdayStartTime);
  console.log('Saturday End:', businessData.saturdayEndTime);
  console.log('Saturday Hours:', businessData.saturdayScheduledHours);

  // Get all shifts
  const shiftsSnap = await db.collection('businesses').doc(businessId).collection('shifts').get();

  console.log('\n=== CONFIGURED SHIFTS ===');
  console.log(`Found ${shiftsSnap.size} shifts\n`);

  shiftsSnap.forEach(doc => {
    const shift = doc.data();
    console.log(`Shift ID: ${doc.id}`);
    console.log(`Name: ${shift.shiftName}`);
    console.log(`Active: ${shift.active}`);
    console.log(`Is Default: ${shift.isDefault}`);
    console.log(`Default Break: ${shift.defaultBreakDuration} minutes`);
    console.log('Schedule:');

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
      const daySchedule = shift.schedule[day];
      if (daySchedule && daySchedule.enabled) {
        const start = daySchedule.startTime;
        const end = daySchedule.endTime;
        const breakMins = daySchedule.breakDuration;

        // Calculate hours
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        const totalHours = (endH + endM/60) - (startH + startM/60);
        const payableHours = totalHours - (breakMins/60);

        console.log(`  ${day}: ${start} - ${end}, Break: ${breakMins}min = ${payableHours.toFixed(2)}h payable`);
      }
    });
    console.log('---\n');
  });

  // Calculate what Past Due should be for Feb 9, 2026
  console.log('=== EXPECTED PAST DUE HOURS (as of Feb 9, 2026) ===');
  console.log('Days that have passed: Feb 1-8');
  console.log('Feb 1 = Saturday, Feb 2 = Sunday');
  console.log('Feb 3-7 = Mon-Fri (5 weekdays)');
  console.log('Feb 8 = Saturday\n');

  shiftsSnap.forEach(doc => {
    const shift = doc.data();
    if (!shift.active) return;

    let totalHours = 0;
    const daysToCount = [
      { date: 'Feb 1', dayOfWeek: 6, dayName: 'saturday' },
      { date: 'Feb 2', dayOfWeek: 0, dayName: 'sunday' },
      { date: 'Feb 3', dayOfWeek: 1, dayName: 'monday' },
      { date: 'Feb 4', dayOfWeek: 2, dayName: 'tuesday' },
      { date: 'Feb 5', dayOfWeek: 3, dayName: 'wednesday' },
      { date: 'Feb 6', dayOfWeek: 4, dayName: 'thursday' },
      { date: 'Feb 7', dayOfWeek: 5, dayName: 'friday' },
      { date: 'Feb 8', dayOfWeek: 6, dayName: 'saturday' }
    ];

    daysToCount.forEach(day => {
      const daySchedule = shift.schedule[day.dayName];
      if (daySchedule && daySchedule.enabled) {
        const [startH, startM] = daySchedule.startTime.split(':').map(Number);
        const [endH, endM] = daySchedule.endTime.split(':').map(Number);
        const totalHrs = (endH + endM/60) - (startH + startM/60);
        const payableHrs = totalHrs - (daySchedule.breakDuration/60);
        totalHours += payableHrs;
      }
    });

    console.log(`${shift.shiftName}: ${totalHours.toFixed(2)} hours should be Past Due`);
  });

  // Get sample employees
  const staffSnap = await db.collection('businesses').doc(businessId).collection('staff').get();

  console.log('\n=== ALL EMPLOYEES ===');
  staffSnap.forEach(doc => {
    const emp = doc.data();
    console.log(`${emp.employeeName}: shiftId=${emp.shiftId || 'none'}, shiftName=${emp.shiftName || 'default'}`);
  });

  process.exit(0);
}

checkShifts().catch(err => {
  console.error(err);
  process.exit(1);
});
