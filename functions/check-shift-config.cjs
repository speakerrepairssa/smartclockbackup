/**
 * SHIFT CONFIGURATION DIAGNOSTIC TOOL
 * Run this to see exactly what your shift is configured for
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

async function checkShiftConfiguration() {
  try {
    const businessId = 'cF9egD36y6dXX2X14bsA'; // Your business ID
    const shiftName = 'monday to saterday shift';

    console.log('🔍 Checking shift configuration...\n');

    // Get all shifts
    const shiftsRef = db.collection('businesses').doc(businessId).collection('shifts');
    const shiftsSnap = await shiftsRef.get();

    if (shiftsSnap.empty) {
      console.log('❌ No shifts found!');
      return;
    }

    console.log(`✅ Found ${shiftsSnap.size} shifts\n`);

    // Find the specific shift
    let targetShift = null;
    let targetShiftId = null;

    shiftsSnap.forEach(doc => {
      const data = doc.data();
      console.log(`📋 Shift: "${data.shiftName}" (ID: ${doc.id})`);
      if (data.shiftName.toLowerCase().includes('monday') ||
          data.shiftName.toLowerCase().includes('saterday')) {
        targetShift = data;
        targetShiftId = doc.id;
      }
    });

    if (!targetShift) {
      console.log('\n❌ Could not find shift matching "monday to saterday shift"');
      return;
    }

    console.log(`\n🎯 Analyzing shift: "${targetShift.shiftName}"\n`);
    console.log('=' .repeat(80));

    // Calculate February 2026 hours
    const year = 2026;
    const monthNum = 2; // February
    const daysInMonth = 28;

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayCounts = { sunday: 0, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0 };

    // Count each day type in February 2026
    for (let day = 1; day <= daysInMonth; day++) {
      const checkDate = new Date(year, monthNum - 1, day);
      const dayOfWeek = checkDate.getDay();
      const dayName = dayNames[dayOfWeek];
      dayCounts[dayName]++;
    }

    console.log('\n📅 Days in February 2026:');
    Object.entries(dayCounts).forEach(([day, count]) => {
      console.log(`  ${day.padEnd(10)}: ${count} days`);
    });

    console.log('\n⚙️  Shift Schedule Configuration:\n');

    let totalRequiredHours = 0;
    const issues = [];

    dayNames.forEach(dayName => {
      const daySchedule = targetShift.schedule[dayName];
      const count = dayCounts[dayName];

      if (!daySchedule) {
        console.log(`  ${dayName.toUpperCase().padEnd(12)}: ⚠️  NOT CONFIGURED`);
        return;
      }

      const enabled = daySchedule.enabled;
      const startTime = daySchedule.startTime || 'N/A';
      const endTime = daySchedule.endTime || 'N/A';
      const breakDuration = daySchedule.breakDuration || targetShift.defaultBreakDuration || 0;

      console.log(`  ${dayName.toUpperCase().padEnd(12)}: ${enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`    Time: ${startTime} - ${endTime}`);
      console.log(`    Break: ${breakDuration} minutes`);

      if (enabled && count > 0) {
        // Calculate hours for this day type
        if (startTime !== 'N/A' && endTime !== 'N/A') {
          const [startH, startM] = startTime.split(':').map(Number);
          const [endH, endM] = endTime.split(':').map(Number);

          let startDecimal = startH + startM / 60;
          let endDecimal = endH + endM / 60;

          if (endDecimal < startDecimal) {
            endDecimal += 24; // Overnight shift
          }

          const totalHours = endDecimal - startDecimal;
          const dayHours = Math.max(0, totalHours - (breakDuration / 60));
          const dayTotalHours = dayHours * count;

          totalRequiredHours += dayTotalHours;

          console.log(`    Hours: ${totalHours.toFixed(2)}h - ${(breakDuration/60).toFixed(2)}h break = ${dayHours.toFixed(2)}h payable`);
          console.log(`    Month: ${count} days × ${dayHours.toFixed(2)}h = ${dayTotalHours.toFixed(2)}h total`);

          // Check for issues
          if (dayName === 'sunday' && enabled) {
            issues.push(`⚠️  Sunday is ENABLED - should it be working?`);
          }
          if (breakDuration < 30 && totalHours >= 6) {
            issues.push(`⚠️  ${dayName} has only ${breakDuration}min break for ${totalHours.toFixed(1)}h shift`);
          }
        }
      } else {
        console.log(`    Month: NOT COUNTED (${count} days in Feb, but disabled)`);
      }
      console.log('');
    });

    console.log('=' .repeat(80));
    console.log(`\n📊 TOTAL REQUIRED HOURS FOR FEBRUARY 2026: ${totalRequiredHours.toFixed(2)} hours`);
    console.log(`   Expected: 180 hours`);
    console.log(`   Difference: ${(totalRequiredHours - 180).toFixed(2)} hours\n`);

    if (issues.length > 0) {
      console.log('🚨 ISSUES FOUND:\n');
      issues.forEach(issue => console.log(`   ${issue}`));
      console.log('');
    }

    // Check which employees are assigned to this shift
    console.log('👥 Checking employee assignments...\n');
    const staffRef = db.collection('businesses').doc(businessId).collection('staff');
    const staffSnap = await staffRef.get();

    let assignedCount = 0;
    let unassignedCount = 0;

    staffSnap.forEach(doc => {
      const staff = doc.data();
      const name = staff.employeeName || 'Unnamed';
      if (staff.shiftId === targetShiftId) {
        console.log(`   ✅ ${name} - assigned to this shift`);
        assignedCount++;
      } else if (staff.shiftId) {
        console.log(`   ⚠️  ${name} - assigned to different shift: ${staff.shiftId}`);
        unassignedCount++;
      } else {
        console.log(`   ⚠️  ${name} - NO SHIFT ASSIGNED (using business default)`);
        unassignedCount++;
      }
    });

    console.log(`\n📈 Summary: ${assignedCount} employees using this shift, ${unassignedCount} using other/default\n`);

    if (unassignedCount > 0) {
      console.log('⚠️  WARNING: Some employees are not assigned to this shift!');
      console.log('   They will use business default schedule, which may have different calculations.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

checkShiftConfiguration();
