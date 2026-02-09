const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function diagnoseShift() {
  const businessId = 'biz_srcomponents';
  const employeeId = 'emp_4'; // test 1hr

  // Get employee data
  const empDoc = await db.collection('businesses').doc(businessId)
    .collection('staff').where('slot', '==', 4).limit(1).get();

  if (empDoc.empty) {
    console.log('Employee not found');
    return;
  }

  const empData = empDoc.docs[0].data();
  const empId = empDoc.docs[0].id;

  console.log('\n=== EMPLOYEE DATA ===');
  console.log('ID:', empId);
  console.log('Name:', empData.employeeName);
  console.log('ShiftID:', empData.shiftId);
  console.log('ShiftName:', empData.shiftName);

  if (!empData.shiftId) {
    console.log('\n❌ NO SHIFT ASSIGNED!');
    return;
  }

  // Get shift data
  const shiftDoc = await db.collection('businesses').doc(businessId)
    .collection('shifts').doc(empData.shiftId).get();

  if (!shiftDoc.exists) {
    console.log('\n❌ SHIFT NOT FOUND!');
    return;
  }

  const shift = shiftDoc.data();

  console.log('\n=== SHIFT DATA ===');
  console.log('Shift Name:', shift.shiftName);
  console.log('Active:', shift.active);
  console.log('Default Break:', shift.defaultBreakDuration, 'minutes');

  console.log('\n=== SCHEDULE ===');
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  days.forEach(day => {
    const daySchedule = shift.schedule[day];
    if (daySchedule && daySchedule.enabled) {
      const [startH, startM] = daySchedule.startTime.split(':').map(Number);
      const [endH, endM] = daySchedule.endTime.split(':').map(Number);
      const totalHours = (endH + endM / 60) - (startH + startM / 60);
      const breakHours = daySchedule.breakDuration / 60;
      const payable = totalHours - breakHours;

      console.log(`${day.padEnd(10)}: ${daySchedule.startTime}-${daySchedule.endTime}, Break: ${daySchedule.breakDuration}min = ${payable.toFixed(2)}h payable`);
    } else {
      console.log(`${day.padEnd(10)}: OFF`);
    }
  });

  console.log('\n=== PAST DUE CALCULATION (Feb 1-8) ===');
  const testDays = [
    { date: 'Feb 1', dayOfWeek: 6, dayName: 'saturday' },
    { date: 'Feb 2', dayOfWeek: 0, dayName: 'sunday' },
    { date: 'Feb 3', dayOfWeek: 1, dayName: 'monday' },
    { date: 'Feb 4', dayOfWeek: 2, dayName: 'tuesday' },
    { date: 'Feb 5', dayOfWeek: 3, dayName: 'wednesday' },
    { date: 'Feb 6', dayOfWeek: 4, dayName: 'thursday' },
    { date: 'Feb 7', dayOfWeek: 5, dayName: 'friday' },
    { date: 'Feb 8', dayOfWeek: 6, dayName: 'saturday' }
  ];

  let totalRequired = 0;
  testDays.forEach(day => {
    const daySchedule = shift.schedule[day.dayName];
    if (daySchedule && daySchedule.enabled) {
      const [startH, startM] = daySchedule.startTime.split(':').map(Number);
      const [endH, endM] = daySchedule.endTime.split(':').map(Number);
      const totalHours = (endH + endM / 60) - (startH + startM / 60);
      const breakDuration = daySchedule.breakDuration || shift.defaultBreakDuration || 0;
      const dayHours = totalHours - (breakDuration / 60);
      totalRequired += dayHours;
      console.log(`${day.date}: ${dayHours.toFixed(2)}h`);
    } else {
      console.log(`${day.date}: 0h (off)`);
    }
  });

  console.log(`\nTotal Required by Feb 8: ${totalRequired.toFixed(2)} hours`);
  console.log(`Expected Past Due for 0 hours worked: ${totalRequired.toFixed(2)} hours`);
  console.log(`Expected Past Due for 13 hours worked: ${(totalRequired - 13).toFixed(2)} hours`);

  process.exit(0);
}

diagnoseShift().catch(err => {
  console.error(err);
  process.exit(1);
});
