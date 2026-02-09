// REPLACEMENT CODE FOR ASSESSMENT FUNCTIONS
// This fixes the race condition and speed issues

/**
 * Calculate assessment data for a single employee (NO cache writes - just returns data)
 * Uses EXACT same calculation logic as timecard
 */
async function calculateSingleEmployeeAssessment(db, businessId, employeeId, month = null) {
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
    const schedule = businessData?.schedule || {};

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

    // Calculate required hours
    let monthlyWeekdays = 0;
    let monthlySaturdays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const checkDate = new Date(year, monthNum - 1, day);
      const dayOfWeek = checkDate.getDay();

      if (dayOfWeek >= 1 && dayOfWeek <= 5) monthlyWeekdays++;
      else if (dayOfWeek === 6) monthlySaturdays++;
    }

    const requiredHours = (monthlyWeekdays * (defaultScheduledWorkHours - 1)) + (monthlySaturdays * saturdayScheduledHours);

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

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    Object.keys(eventsByDate).forEach(dateStr => {
      const dayEvents = eventsByDate[dateStr].sort((a, b) => a.timestamp - b.timestamp);
      const firstClockIn = dayEvents.find(e => e.type.toLowerCase().includes('in'));
      const lastClockOut = dayEvents.filter(e => e.type.toLowerCase().includes('out')).pop();

      if (firstClockIn && lastClockOut) {
        const actualStart = firstClockIn.timestamp;
        const actualEnd = lastClockOut.timestamp;
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay();
        const dayMultiplier = dailyMultipliers[dayOfWeek];

        let scheduledStartTime = defaultScheduledStartTime;
        let scheduledEndTime = defaultScheduledEndTime;
        let scheduledWorkHours = defaultScheduledWorkHours;

        if (dayOfWeek === 6) {
          scheduledStartTime = saturdayStartTime;
          scheduledEndTime = saturdayEndTime;
          scheduledWorkHours = saturdayScheduledHours;
        }

        const [schedStartH, schedStartM] = scheduledStartTime.split(':').map(Number);
        const [schedEndH, schedEndM] = scheduledEndTime.split(':').map(Number);

        const schedStart = new Date(actualStart);
        schedStart.setHours(schedStartH, schedStartM, 0, 0);
        const schedEnd = new Date(actualStart);
        schedEnd.setHours(schedEndH, schedEndM, 0, 0);

        const payableStart = new Date(Math.max(actualStart.getTime(), schedStart.getTime()));
        const payableEnd = new Date(Math.min(actualEnd.getTime(), schedEnd.getTime()));
        const payableDuration = Math.max(0, (payableEnd.getTime() - payableStart.getTime()) / (1000 * 60 * 60));

        const needsLunchBreak = dayOfWeek >= 1 && dayOfWeek <= 5;
        let dayPayableHours = needsLunchBreak ? Math.max(0, payableDuration - (breakMinutes / 60)) : payableDuration;
        const maxPayableHours = needsLunchBreak ? Math.max(0, scheduledWorkHours - (breakMinutes / 60)) : scheduledWorkHours;
        dayPayableHours = Math.min(dayPayableHours, maxPayableHours);

        if (!dailyHoursByMultiplier[dayMultiplier]) dailyHoursByMultiplier[dayMultiplier] = 0;
        dailyHoursByMultiplier[dayMultiplier] += dayPayableHours;
        totalPayableHours += dayPayableHours;
        workingDays++;
      }
    });

    const currentHours = Math.round(totalPayableHours * 100) / 100;
    const hoursShort = Math.max(0, requiredHours - currentHours);

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
    let pastDueHours = 0;

    if (year == currentYear && monthNum == currentMonth) {
      let weekdaysPassed = 0;
      let saturdaysPassed = 0;

      for (let day = 1; day < currentDay; day++) {
        const checkDate = new Date(year, monthNum - 1, day);
        const dayOfWeek = checkDate.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) weekdaysPassed++;
        else if (dayOfWeek === 6) saturdaysPassed++;
      }

      const requiredHoursSoFar = (weekdaysPassed * (defaultScheduledWorkHours - 1)) + (saturdaysPassed * saturdayScheduledHours);
      pastDueHours = Math.max(0, requiredHoursSoFar - currentHours);
    }

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
 * Processes in PARALLEL and writes cache ONCE at the end
 */
async function calculateAndCacheAssessment(db, businessId, month, requiredHoursPerMonth = 176) {
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
      calculateSingleEmployeeAssessment(db, businessId, doc.id, month)
    );

    console.log(`🔄 Processing ${employeePromises.length} employees in parallel...`);

    const employeeResults = await Promise.all(employeePromises);

    // Filter out skipped employees
    const validEmployees = employeeResults.filter(emp => emp && !emp.skipped);

    console.log(`✅ Successfully calculated ${validEmployees.length} employees`);

    // Write ENTIRE cache in ONE operation (no race condition!)
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
