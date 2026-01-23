const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');

// Initialize Firestore
const db = getFirestore();

exports.setupCorrectFirebaseStructure = onRequest(async (req, res) => {
  try {
    logger.info('Setting up correct Firebase structure according to documentation');
    
    const batch = db.batch();
    
    // 1. Create Business Configuration
    const businessRef = db.collection('businesses').doc('biz_srcomponents');
    batch.set(businessRef, {
      businessName: 'SR Components',
      businessId: 'biz_srcomponents',
      adminEmail: 'info@srcomponents.co.za',
      apiEnabled: true,
      approved: true,
      approvedAt: new Date().toISOString(),
      breakDuration: 60,
      slotsAllowed: 6,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      deviceId: 'FC4349999', // For legacy device lookup
      status: 'active'
    });
    
    // 2. Create Numbered Staff Slots (1, 2, 3, 4, 5, 6) - CORE REQUIREMENT
    for (let slotId = 1; slotId <= 6; slotId++) {
      const staffSlotRef = db.collection('businesses')
        .doc('biz_srcomponents')
        .collection('staff')
        .doc(slotId.toString()); // Use slot number as document ID
      
      batch.set(staffSlotRef, {
        employeeId: slotId.toString(),
        employeeName: `Employee ${slotId}`, // Default placeholder
        badgeNumber: slotId.toString(),
        deviceId: slotId.toString(),
        slot: slotId,
        active: false, // Not yet assigned
        assignedAt: null,
        updatedAt: null,
        attendanceStatus: 'out'
      });
    }
    
    // 3. Create Status Collection for Real-time Monitoring
    for (let slotId = 1; slotId <= 6; slotId++) {
      const statusRef = db.collection('businesses')
        .doc('biz_srcomponents')
        .collection('status')
        .doc(slotId.toString());
      
      batch.set(statusRef, {
        employeeId: slotId.toString(),
        employeeName: `Employee ${slotId}`,
        badgeNumber: slotId.toString(),
        attendanceStatus: 'out',
        lastClockTime: null,
        lastEventType: null,
        deviceId: 'FC4349999',
        slot: slotId,
        active: false,
        updatedAt: new Date().toISOString()
      });
    }
    
    // 4. Create Employee Last Clock-in Collection
    const lastClockInRef = db.collection('businesses')
      .doc('biz_srcomponents')
      .collection('employee_last_clockin')
      .doc('placeholder');
    
    batch.set(lastClockInRef, {
      placeholder: true,
      created: new Date().toISOString()
    });
    
    // 5. Create Employee Last Clock-out Collection  
    const lastClockOutRef = db.collection('businesses')
      .doc('biz_srcomponents')
      .collection('employee_last_checkout')
      .doc('placeholder');
    
    batch.set(lastClockOutRef, {
      placeholder: true,
      created: new Date().toISOString()
    });
    
    // 6. Create Employee Last Attendance Collection
    const lastAttendanceRef = db.collection('businesses')
      .doc('biz_srcomponents')
      .collection('employee_last_attendance')
      .doc('placeholder');
    
    batch.set(lastAttendanceRef, {
      placeholder: true,
      created: new Date().toISOString()
    });
    
    // 7. Create Status Employees Collection
    const statusEmployeesRef = db.collection('businesses')
      .doc('biz_srcomponents')
      .collection('status')
      .doc('employees');
    
    batch.set(statusEmployeesRef, {
      lastUpdated: new Date().toISOString(),
      totalActiveEmployees: 0
    });
    
    await batch.commit();
    
    // Create additional collections that need documents
    const batch2 = db.batch();
    
    // 8. Create sample attendance events structure (for today)
    const today = new Date().toISOString().split('T')[0]; // 2026-01-23
    const eventsRef = db.collection('businesses')
      .doc('biz_srcomponents')
      .collection('attendance_events')
      .doc(today)
      .collection('events')
      .doc('placeholder');
    
    batch2.set(eventsRef, {
      placeholder: true,
      date: today,
      created: new Date().toISOString()
    });
    
    // 9. Create Employee Timesheets Structure (missing collection #1)
    for (let employeeId = 1; employeeId <= 6; employeeId++) {
      const timesheetRef = db.collection('businesses')
        .doc('biz_srcomponents')
        .collection('employee_timesheets')
        .doc(employeeId.toString())
        .collection('daily_sheets')
        .doc(today);
      
      batch2.set(timesheetRef, {
        employeeId: employeeId.toString(),
        employeeName: `Employee ${employeeId}`,
        date: today,
        clockEvents: [],
        workPeriods: [],
        totalHours: 0,
        breakMinutes: 0,
        overtimeHours: 0,
        status: 'pending',
        lastUpdated: new Date().toISOString()
      });
    }
    
    // 10. Create Monthly Summary Structure (missing collection #2)
    const currentMonth = new Date().toISOString().substring(0, 7); // 2026-01
    for (let employeeId = 1; employeeId <= 6; employeeId++) {
      const monthlyRef = db.collection('businesses')
        .doc('biz_srcomponents')
        .collection('employee_monthly_summary')
        .doc(employeeId.toString())
        .collection('monthly_reports')
        .doc(currentMonth);
      
      batch2.set(monthlyRef, {
        employeeId: employeeId.toString(),
        employeeName: `Employee ${employeeId}`,
        month: currentMonth,
        totalDaysWorked: 0,
        totalHours: 0,
        totalOvertimeHours: 0,
        totalBreakMinutes: 0,
        averageHoursPerDay: 0,
        status: 'active',
        lastUpdated: new Date().toISOString()
      });
    }
    
    // 11. Create Payroll Reports Structure (missing collection #3)
    const payrollRef = db.collection('businesses')
      .doc('biz_srcomponents')
      .collection('payroll_reports')
      .doc(currentMonth);
    
    batch2.set(payrollRef, {
      month: currentMonth,
      businessName: 'SR Components',
      totalEmployees: 6,
      totalHours: 0,
      totalOvertimeHours: 0,
      payrollCalculations: [],
      status: 'pending',
      generatedAt: new Date().toISOString()
    });
    
    await batch2.commit();
    
    logger.info('Correct Firebase structure created successfully');
    
    res.json({
      success: true,
      message: 'Correct Firebase structure created according to documentation',
      structure: {
        business: '/businesses/biz_srcomponents',
        staff_slots: '/businesses/biz_srcomponents/staff/{1|2|3|4|5|6}',
        status_tracking: '/businesses/biz_srcomponents/status/{1|2|3|4|5|6}',
        attendance_events: `/businesses/biz_srcomponents/attendance_events/${today}/events/`,
        employee_timesheets: '/businesses/biz_srcomponents/employee_timesheets/{1|2|3|4|5|6}/{YYYY-MM-DD}',
        monthly_summaries: `/businesses/biz_srcomponents/employee_monthly_summary/{1|2|3|4|5|6}/${currentMonth}`,
        payroll_reports: `/businesses/biz_srcomponents/payroll_reports/${currentMonth}`
      },
      keyFeatures: {
        numberedSlots: 'Documents use slot numbers (1,2,3...) not auto-generated IDs',
        autoAssignment: 'First clock event will sync device employee to correct slot',
        payrollReady: 'All required collections for payroll system created',
        realTimeStatus: 'Status collection ready for live monitoring'
      }
    });
    
  } catch (error) {
    logger.error('Error setting up Firebase structure:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});