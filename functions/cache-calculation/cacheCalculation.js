/**
 * ASSESSMENT CACHE CALCULATION MODULE
 * Isolated from index.js to prevent accidental modifications to other functions
 * Handles calculation and caching of employee assessment data
 */

const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

/**
 * Calculate assessment data for a single employee (returns data only, no cache writes)
 * Uses EXACT same calculation logic as timecard
 */
async function calculateSingleEmployeeAssessment(businessId, employeeId, month = null) {
  try {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    console.log(`🔄 Calculating assessment for employee ${employeeId} in ${businessId}, month: ${targetMonth}`);

    // Get employee info
    const staffDoc = await db.collection("businesses").doc(businessId).collection("staff").doc(employeeId).get();
    if (!staffDoc.exists) {
      console.log(`⚠️ Employee ${employeeId} not found in staff`);
      return { skipped: true, reason: 'not_found' };
    }

    const employee = staffDoc.data();

    // Try multiple field names for employee name
    const employeeName = employee.employeeName || employee.name || employee.empName || `Slot ${employeeId}`;

    // Skip auto-named empty slots
    if (employeeName.match(/^Employee \d+$/)) {
      console.log(`⏭️  Skipping empty slot: ${employeeName}`);
      return { skipped: true, reason: 'empty_slot' };
    }

    const payRate = parseFloat(employee.payRate || employee.hourlyRate || 0);
    const slot = employee.slot || parseInt(employeeId) || 0;

    // Get multipliers and business settings
    const dailyMultipliers = {
      0: parseFloat(employee.sundayMultiplier || 1.5),
      1: parseFloat(employee.mondayMultiplier || 1.0),
      2: parseFloat(employee.tuesdayMultiplier || 1.0),
      3: parseFloat(employee.wednesdayMultiplier || 1.0),
      4: parseFloat(employee.thursdayMultiplier || 1.0),
      5: parseFloat(employee.fridayMultiplier || 1.0),
      6: parseFloat(employee.saturdayMultiplier || 1.25)
    };

    const businessDoc = await db.collection("businesses").doc(businessId).get();
    const businessData = businessDoc.data();
    const breakMinutes = businessData?.breakDuration || 60;

    let defaultScheduledWorkHours = 9;
    let defaultScheduledStartTime = '08:30';
    let defaultScheduledEndTime = '17:30';
    let saturdayScheduledHours = 6;
    let saturdayStartTime = '08:30';
    let saturdayEndTime = '14:30';

    if (businessData?.workStartTime && businessData?.workEndTime) {
      defaultScheduledStartTime = businessData.workStartTime;
      defaultScheduledEndTime = businessData.workEndTime;
      const [startH, startM] = defaultScheduledStartTime.split(':').map(Number);
      const [endH, endM] = defaultScheduledEndTime.split(':').map(Number);
      defaultScheduledWorkHours = (endH + endM/60) - (startH + startM/60);
    }

    if (businessData?.saturdayStartTime && businessData?.saturdayEndTime) {
      saturdayStartTime = businessData.saturdayStartTime;
      saturdayEndTime = businessData.saturdayEndTime;
      const [startH, startM] = saturdayStartTime.split(':').map(Number);
      const [endH, endM] = saturdayEndTime.split(':').map(Number);
      saturdayScheduledHours = (endH + endM/60) - (startH + startM/60);
    }

    // Parse month
    const [year, monthNum] = targetMonth.split('-');
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    // ========================================
    // SHIFT-BASED REQUIRED HOURS CALCULATION
    // Optimized: Count each day type, then multiply by shift hours
    // ========================================
    let requiredHours = 0;
    let usingShift = false;
    let shiftSchedule = null; // Store shift schedule for actual hours calculation

    // Check if employee has a shift assigned
    if (employee.shiftId) {
      try {
        console.log(`🔄 Loading shift for employee ${employeeId}: ${employee.shiftId}`);
        const shiftDoc = await db.collection("businesses").doc(businessId)
          .collection("shifts").doc(employee.shiftId).get();

        if (shiftDoc.exists && shiftDoc.data().active) {
          const shift = shiftDoc.data();
          shiftSchedule = shift; // Store for actual hours calculation
          usingShift = true;
          console.log(`✅ Using shift "${shift.shiftName}" for ${employeeName}`);

          // Step 1: Count how many times each day of week appears in the month
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayCounts = { sunday: 0, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0 };

          for (let day = 1; day <= daysInMonth; day++) {
            const checkDate = new Date(year, monthNum - 1, day);
            const dayOfWeek = checkDate.getDay(); // 0=Sunday, 6=Saturday
            const dayName = dayNames[dayOfWeek];
            dayCounts[dayName]++;
          }

          // Step 2: For each day type, calculate hours and multiply by count
          dayNames.forEach(dayName => {
            const daySchedule = shift.schedule[dayName];

            if (daySchedule && daySchedule.enabled && dayCounts[dayName] > 0) {
              // Calculate hours for this day type
              const [startH, startM] = daySchedule.startTime.split(':').map(Number);
              const [endH, endM] = daySchedule.endTime.split(':').map(Number);

              let startDecimal = startH + startM / 60;
              let endDecimal = endH + endM / 60;

              // Handle overnight shifts (crossing midnight)
              if (endDecimal < startDecimal) {
                endDecimal += 24;
              }

              const totalHours = endDecimal - startDecimal;
              const breakDuration = daySchedule.breakDuration || shift.defaultBreakDuration || 0;
              const dayHours = Math.max(0, totalHours - (breakDuration / 60));

              // Multiply by number of times this day appears in the month
              const dayTotalHours = dayHours * dayCounts[dayName];
              requiredHours += dayTotalHours;

              console.log(`  ${dayName}: ${dayCounts[dayName]} days × ${dayHours.toFixed(2)}h = ${dayTotalHours.toFixed(2)}h`);
            }
          });

          console.log(`📊 Shift-based required hours for ${employeeName}: ${requiredHours.toFixed(2)}h`);
        } else {
          console.log(`⚠️ Shift ${employee.shiftId} not found or inactive for ${employeeName}, using business default`);
        }
      } catch (shiftError) {
        console.error(`❌ Error loading shift for ${employeeId}:`, shiftError);
        console.log(`⚠️ Falling back to business default schedule`);
      }
    }

    // Fall back to business-wide schedule if no shift or shift loading failed
    if (!usingShift) {
      let monthlyWeekdays = 0;
      let monthlySaturdays = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const checkDate = new Date(year, monthNum - 1, day);
        const dayOfWeek = checkDate.getDay();

        if (dayOfWeek >= 1 && dayOfWeek <= 5) monthlyWeekdays++;
        else if (dayOfWeek === 6) monthlySaturdays++;
      }

      requiredHours = (monthlyWeekdays * (defaultScheduledWorkHours - 1)) + (monthlySaturdays * saturdayScheduledHours);
      console.log(`📊 Business-default required hours for ${employeeName}: ${requiredHours.toFixed(2)}h`);
    }

    // Get attendance events
    const eventsByDate = {};
    const attendanceRef = db.collection("businesses").doc(businessId).collection("attendance_events");

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      try {
        const dayEventsRef = attendanceRef.doc(dateStr).collection(employeeId);
        const dayEventsSnap = await dayEventsRef.get();

        dayEventsSnap.forEach(doc => {
          const event = doc.data();

          if (event.testMode) return;
          if (event.status === 'pending' && !event.resolvedManually) return;

          if (event.timestamp) {
            const timestamp = event.timestamp.toDate ? event.timestamp.toDate() : new Date(event.timestamp);
            let eventType = event.type || (event.attendanceStatus === 'in' ? 'clock-in' : 'clock-out');

            if (eventType) {
              if (!eventsByDate[dateStr]) eventsByDate[dateStr] = [];
              eventsByDate[dateStr].push({ type: eventType, timestamp: timestamp, dateStr: dateStr });
            }
          }
        });
      } catch (dayError) {
        // Day might not exist
      }
    }

    // Skip if no attendance
    if (Object.keys(eventsByDate).length === 0) {
      console.log(`⏭️  Skipping ${employeeId} (${employeeName}): No attendance events`);
      return { skipped: true, reason: 'no_attendance' };
    }

    // Calculate hours
    let totalPayableHours = 0;
    let dailyHoursByMultiplier = {};
    let workingDays = 0;

    Object.values(dailyMultipliers).forEach(multiplier => {
      if (!dailyHoursByMultiplier[multiplier]) dailyHoursByMultiplier[multiplier] = 0;
    });

    Object.keys(eventsByDate).forEach(dateStr => {
      const dayEvents = eventsByDate[dateStr].sort((a, b) => a.timestamp - b.timestamp);

      // NEW: Chronological pairing logic (matching timecard)
      let totalMinutes = 0;
      let currentClockIn = null;

      for (let i = 0; i < dayEvents.length; i++) {
        const event = dayEvents[i];
        const eventTime = event.timestamp;

        if (event.type.toLowerCase().includes('in')) {
          // Reset to new clock-in (handles duplicate clock-ins)
          currentClockIn = eventTime;
        } else if (event.type.toLowerCase().includes('out')) {
          if (currentClockIn) {
            // Calculate work period
            const diffMs = eventTime.getTime() - currentClockIn.getTime();
            const diffMinutes = Math.max(0, diffMs / (1000 * 60));
            totalMinutes += diffMinutes;
            currentClockIn = null;
          }
        }
      }

      // If there are no complete periods, don't count this day
      if (totalMinutes === 0) {
        console.log(`⏭️ Skipping ${dateStr} - no complete clock-in/out pairs`);
        return;
      }

      const actualHours = totalMinutes / 60;
      console.log(`📅 ${dateStr}: Raw time worked: ${actualHours.toFixed(2)}h (${totalMinutes.toFixed(0)} minutes)`);

      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const dayMultiplier = dailyMultipliers[dayOfWeek];

      // Get day-specific schedule (from shift if available, otherwise business default)
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];

      let scheduledStartTime, scheduledEndTime, breakDuration;

      if (shiftSchedule && shiftSchedule.schedule[dayName] && shiftSchedule.schedule[dayName].enabled) {
        // Use shift-based schedule for this day
        const daySchedule = shiftSchedule.schedule[dayName];
        scheduledStartTime = daySchedule.startTime;
        scheduledEndTime = daySchedule.endTime;
        breakDuration = daySchedule.breakDuration || shiftSchedule.defaultBreakDuration || 60;
      } else {
        // Fall back to business default schedule
        if (dayOfWeek === 6) {
          scheduledStartTime = saturdayStartTime;
          scheduledEndTime = saturdayEndTime;
          breakDuration = breakMinutes;
        } else {
          scheduledStartTime = defaultScheduledStartTime;
          scheduledEndTime = defaultScheduledEndTime;
          breakDuration = breakMinutes;
        }
      }

      // Calculate scheduled hours
      const [schedStartH, schedStartM] = scheduledStartTime.split(':').map(Number);
      const [schedEndH, schedEndM] = scheduledEndTime.split(':').map(Number);
      let schedStart = schedStartH + schedStartM / 60;
      let schedEnd = schedEndH + schedEndM / 60;

      // Handle overnight shifts
      if (schedEnd < schedStart) {
        schedEnd += 24;
      }

      const scheduledHours = schedEnd - schedStart;
      const maxPayableHours = Math.max(0, scheduledHours - (breakDuration / 60));

      // Deduct break and cap at max payable hours
      let dayPayableHours = Math.max(0, actualHours - (breakDuration / 60));
      dayPayableHours = Math.min(dayPayableHours, maxPayableHours);

      console.log(`  Break: ${breakDuration}min | Max payable: ${maxPayableHours.toFixed(2)}h | Payable: ${dayPayableHours.toFixed(2)}h`);

      if (!dailyHoursByMultiplier[dayMultiplier]) dailyHoursByMultiplier[dayMultiplier] = 0;
      dailyHoursByMultiplier[dayMultiplier] += dayPayableHours;
      totalPayableHours += dayPayableHours;
      workingDays++;
    });

    const currentHours = Math.round(totalPayableHours * 100) / 100;

    // Calculate income
    let totalIncome = 0;
    Object.entries(dailyHoursByMultiplier).forEach(([multiplier, hours]) => {
      const rateForThisMultiplier = payRate * parseFloat(multiplier);
      const incomeForThisRate = hours * rateForThisMultiplier;
      totalIncome += incomeForThisRate;
    });

    const currentIncomeDue = totalIncome;
    const potentialIncome = requiredHours * payRate;

    // Calculate past due
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    const currentTimeDecimal = currentHour + currentMinute / 60;
    let pastDueHours = 0;

    if (year == currentYear && monthNum == currentMonth) {
      let requiredHoursSoFar = 0;

      // Calculate based on shift schedule if available
      if (usingShift && shiftSchedule && shiftSchedule.schedule) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        // Determine if today's shift is past due (current time is past shift end time)
        let includeTodayInPastDue = false;
        const todayDayOfWeek = today.getDay();
        const todayDayName = dayNames[todayDayOfWeek];
        const todaySchedule = shiftSchedule.schedule[todayDayName];

        if (todaySchedule && todaySchedule.enabled) {
          const [endH, endM] = todaySchedule.endTime.split(':').map(Number);
          const endTimeDecimal = endH + endM / 60;
          // If current time is past the shift end time, include today in past due
          if (currentTimeDecimal >= endTimeDecimal) {
            includeTodayInPastDue = true;
          }
        }

        const lastDayToCount = includeTodayInPastDue ? currentDay : currentDay - 1;

        for (let day = 1; day <= lastDayToCount; day++) {
          const checkDate = new Date(year, monthNum - 1, day);
          const dayOfWeek = checkDate.getDay();
          const dayName = dayNames[dayOfWeek];
          const daySchedule = shiftSchedule.schedule[dayName];

          if (daySchedule && daySchedule.enabled) {
            // Calculate hours for this specific day
            const [startH, startM] = daySchedule.startTime.split(':').map(Number);
            const [endH, endM] = daySchedule.endTime.split(':').map(Number);

            let startDecimal = startH + startM / 60;
            let endDecimal = endH + endM / 60;

            // Handle overnight shifts
            if (endDecimal < startDecimal) {
              endDecimal += 24;
            }

            const totalHours = endDecimal - startDecimal;
            const breakDuration = daySchedule.breakDuration || shiftSchedule.defaultBreakDuration || 0;
            const dayHours = Math.max(0, totalHours - (breakDuration / 60));

            requiredHoursSoFar += dayHours;
          }
        }
      } else {
        // Fall back to business default schedule
        // For fallback, assume standard shift end time of 17:30
        const standardEndTime = 17.5; // 17:30 in decimal
        const includeTodayInPastDue = currentTimeDecimal >= standardEndTime;
        const lastDayToCount = includeTodayInPastDue ? currentDay : currentDay - 1;

        let weekdaysPassed = 0;
        let saturdaysPassed = 0;

        for (let day = 1; day <= lastDayToCount; day++) {
          const checkDate = new Date(year, monthNum - 1, day);
          const dayOfWeek = checkDate.getDay();
          if (dayOfWeek >= 1 && dayOfWeek <= 5) weekdaysPassed++;
          else if (dayOfWeek === 6) saturdaysPassed++;
        }

        requiredHoursSoFar = (weekdaysPassed * (defaultScheduledWorkHours - 1)) + (saturdaysPassed * saturdayScheduledHours);
      }

      // Past due hours = total hours that SHOULD have been worked by yesterday
      // NOT the shortfall (that's what hoursShort is for)
      pastDueHours = requiredHoursSoFar;
    }

    // Recalculate hoursShort based on past due hours (not total required hours)
    // Hours Short = how far behind they are NOW (past due - current)
    const hoursShort = Math.max(0, pastDueHours - currentHours);

    // Determine status
    let status = 'On Track';
    if (hoursShort > 40) status = 'Critical';
    else if (hoursShort > 0) status = 'Behind';

    console.log(`✅ ${employeeName}: ${currentHours}h over ${workingDays} days`);

    // Return data (NO cache writes here)
    return {
      employeeId: employeeId,
      employeeIndex: slot,
      employeeName: employeeName,
      phone: employee.phone || null,  // ✅ Add phone from staff record
      email: employee.email || null,  // ✅ Add email from staff record
      shiftId: employee.shiftId || null,
      shiftName: shiftSchedule ? shiftSchedule.shiftName : 'No Shift Assigned',
      currentHours: currentHours,
      dailyHoursBreakdown: dailyHoursByMultiplier,
      requiredHours: requiredHours,
      hoursShort: hoursShort,
      pastDueHours: Math.round(pastDueHours * 100) / 100,
      workingDays: workingDays,
      payRate: payRate,
      dailyMultipliers: dailyMultipliers,
      currentIncomeDue: Math.round(currentIncomeDue * 100) / 100,
      potentialIncome: Math.round(potentialIncome * 100) / 100,
      status: status,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error(`❌ Failed to calculate assessment for employee ${employeeId}:`, error);
    return { skipped: true, reason: 'error', error: error.message };
  }
}

/**
 * Calculate and cache assessment data for ALL employees
 * Processes in PARALLEL and writes cache ONCE at the end (NO race condition!)
 */
async function calculateAndCacheAssessment(businessId, month, requiredHoursPerMonth = 176) {
  try {
    console.log('📊 Starting assessment calculation for:', { businessId, month });

    // Get all staff members
    const staffRef = db.collection("businesses").doc(businessId).collection("staff");
    const staffSnap = await staffRef.get();

    console.log(`👥 Found ${staffSnap.size} staff members`);

    if (staffSnap.empty) {
      return { totalEmployees: 0, message: 'No staff members found' };
    }

    // Process ALL employees in PARALLEL
    const employeePromises = staffSnap.docs.map(doc =>
      calculateSingleEmployeeAssessment(businessId, doc.id, month)
    );

    console.log(`🔄 Processing ${employeePromises.length} employees in parallel...`);

    const employeeResults = await Promise.all(employeePromises);

    // Filter out skipped employees
    const validEmployees = employeeResults.filter(emp => emp && !emp.skipped);

    console.log(`✅ Successfully calculated ${validEmployees.length} employees`);

    // Write ENTIRE cache in ONE operation (fixing the race condition!)
    if (validEmployees.length > 0) {
      const cacheRef = db.collection("businesses").doc(businessId).collection("assessment_cache").doc(month);

      validEmployees.sort((a, b) => a.employeeIndex - b.employeeIndex);

      const cacheData = {
        month: month,
        summary: {
          totalEmployees: validEmployees.length,
          totalHoursWorked: validEmployees.reduce((sum, e) => sum + e.currentHours, 0),
          totalHoursShort: validEmployees.reduce((sum, e) => sum + e.hoursShort, 0),
          totalAmountDue: validEmployees.reduce((sum, e) => sum + e.currentIncomeDue, 0)
        },
        employees: validEmployees,
        lastUpdated: new Date().toISOString()
      };

      await cacheRef.set(cacheData);
      console.log(`💾 Cache written successfully for ${validEmployees.length} employees`);
    }

    return {
      totalEmployees: validEmployees.length,
      message: `Successfully updated cache for ${validEmployees.length} employees`
    };

  } catch (error) {
    console.error('❌ Assessment calculation failed:', error);
    throw error;
  }
}

module.exports = {
  calculateSingleEmployeeAssessment,
  calculateAndCacheAssessment
};
