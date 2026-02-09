// Assessment Cache Calculator
// Pre-calculates all assessment data for instant loading
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, setDoc, query, where } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBssR7qaFYd1Bcm7urHQrKfLPVvdoZJ1kw",
  authDomain: "aiclock-82608.firebaseapp.com",
  databaseURL: "https://aiclock-82608-default-rtdb.firebaseio.com",
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.appspot.com",
  messagingSenderId: "847148296718",
  appId: "1:847148296718:web:a8bf69cb527ee7c7e1ea5f",
  measurementId: "G-L6LMK5WY01"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Calculate past due hours for an employee based on their assigned shift schedule
 * Past due hours = total hours that should have been worked for days that have passed (excluding today)  
 */
async function calculatePastDueHoursForEmployee(businessId, employee, month) {
  // If no shift assigned, return 0
  if (!employee.shiftId) {
    console.log(`⚠️ No shift assigned to employee ${employee.employeeName}, returning 0 past due hours`);
    return 0;
  }

  try {
    console.log(`🔄 Loading shift "${employee.shiftId}" for employee ${employee.employeeName}`);
    
    // Get the employee's assigned shift from database
    const shiftRef = collection(db, "businesses", businessId, "shifts");
    const shiftQuery = query(shiftRef, where("__name__", "==", employee.shiftId));
    const shiftSnap = await getDocs(shiftQuery);
    
    if (shiftSnap.empty) {
      console.log(`⚠️ Shift "${employee.shiftId}" not found for employee ${employee.employeeName}`);
      return 0;
    }
    
    const shift = shiftSnap.docs[0].data();
    const schedule = shift.schedule;
    
    console.log(`✅ Found shift: ${shift.shiftName}`);
    
    // Get current date (today is Monday, February 9th, 2026)
    const today = new Date(2026, 1, 9); // February 9, 2026 (month is 0-indexed)
    const [year, monthNum] = month.split('-');
    const monthStart = new Date(year, monthNum - 1, 1); // February 1, 2026
    
    // Calculate days that have passed (Feb 1-8, excluding today Feb 9)
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1); // Feb 8th
    
    let pastDueHours = 0;
    
    // Loop through each day from start of month to yesterday
    const currentDate = new Date(monthStart);
    console.log(`📅 Calculating past due hours from ${monthStart.toDateString()} to ${yesterday.toDateString()}`);
    
    while (currentDate <= yesterday) {
      const dayOfWeek = currentDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];
      
      const daySchedule = schedule[dayName];
      
      if (daySchedule && daySchedule.enabled) {
        // Calculate hours for this day based on shift schedule
        const [startH, startM] = daySchedule.startTime.split(':').map(Number);
        const [endH, endM] = daySchedule.endTime.split(':').map(Number);
        
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const workMinutes = endMinutes - startMinutes;
        const breakMinutes = daySchedule.breakDuration || shift.defaultBreakDuration || 60;
        const actualMinutes = workMinutes - breakMinutes;
        
        const hoursForDay = actualMinutes / 60;
        pastDueHours += hoursForDay;
        
        console.log(`${currentDate.toDateString()} (${dayName}): ${hoursForDay} hours (${workMinutes}min work - ${breakMinutes}min break)`);
      } else {
        console.log(`${currentDate.toDateString()} (${dayName}): 0 hours (off day)`);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`✅ Total past due hours for ${employee.employeeName}: ${pastDueHours}`);
    return Math.round(pastDueHours * 100) / 100;
    
  } catch (error) {
    console.error('❌ Error calculating past due hours:', error);
    return 0;
  }
}

/**
 * Calculate and cache assessment data for a business and month
 */
export async function calculateAndCacheAssessment(businessId, month, requiredHoursPerMonth = 176) {
  try {
    console.log('📊 Starting assessment calculation for:', { businessId, month, requiredHoursPerMonth });
    
    // 1. Get all staff members with their pay rates
    const staffRef = collection(db, "businesses", businessId, "staff");
    const staffSnap = await getDocs(staffRef);
    
    console.log(`👥 Found ${staffSnap.size} staff members`);
    
    const employees = [];
    let employeeIndex = 1;
    
    staffSnap.forEach(doc => {
      const staff = doc.data();
      const slot = parseInt(staff.slot || doc.id);
      
      // Skip empty slots or deleted employees
      if (!staff.employeeName || staff.employeeName.startsWith('Deleted')) {
        return;
      }
      
      const payRate = parseFloat(staff.payRate || staff.hourlyRate || 0);
      
      employees.push({
        slot,
        employeeId: doc.id,
        employeeName: staff.employeeName,
        payRate: isNaN(payRate) ? 0 : payRate,
        shiftId: staff.shiftId, // Include shift ID for past due hours calculation
        phone: staff.phone || '',
        email: staff.email || '',
        position: staff.position || '',
        active: staff.active !== false
      });
    });
    
    // Sort by slot number
    employees.sort((a, b) => a.slot - b.slot);
    
    // 2. Get attendance events for this month
    const [year, monthNum] = month.split('-');
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0);
    
    console.log(`📅 Calculating for period: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);
    
    const attendanceRef = collection(db, "businesses", businessId, "attendance_events");
    const attendanceSnap = await getDocs(attendanceRef);
    
    console.log(`📋 Processing ${attendanceSnap.size} attendance events`);
    
    // 3. Process attendance events and calculate actual hours
    const employeeAttendance = {};
    
    // Initialize all employees with zero data
    employees.forEach(emp => {
      employeeAttendance[emp.employeeId] = {
        totalMinutes: 0,
        totalHours: 0,
        attendanceDays: 0,
        events: []
      };
    });
    
    attendanceSnap.forEach(doc => {
      const event = doc.data();
      const eventDate = event.timestamp?.toDate ? event.timestamp.toDate() : new Date(event.timestamp);
      
      // Filter events for this month
      if (eventDate >= monthStart && eventDate <= monthEnd) {
        const employeeId = event.employeeId;
        
        if (employeeAttendance[employeeId]) {
          // Convert attendanceStatus to clock-in/clock-out format (same as timecard)
          const eventType = event.type || (event.attendanceStatus === 'in' ? 'clock-in' : 'clock-out');
          
          employeeAttendance[employeeId].events.push({
            timestamp: eventDate,
            type: eventType,
            eventDate: event.eventDate || eventDate.toISOString().split('T')[0]
          });
        }
      }
    });
    
    // 4. Calculate actual working hours using SAME LOGIC AS TIMECARD
    // Use chronological event pairing with clock-in → clock-out matching
    Object.keys(employeeAttendance).forEach(empId => {
      const attendance = employeeAttendance[empId];
      
      // Sort events chronologically (CRITICAL for accurate pairing)
      const events = attendance.events.sort((a, b) => a.timestamp - b.timestamp);
      
      let totalMinutes = 0;
      let currentClockIn = null;
      let workingDays = new Set();
      
      console.log(`📊 Processing ${events.length} events for employee:`, empId);
      
      // CHRONOLOGICAL PAIRING: Match each clock-in with next clock-out
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const eventTime = event.timestamp;
        const eventDate = event.eventDate;
        
        // Normalize event type (handle variations: 'in', 'clock-in', 'out', 'clock-out')
        const eventType = event.type.toLowerCase().includes('in') ? 'clock-in' : 'clock-out';
        
        if (eventType === 'clock-in') {
          if (currentClockIn) {
            console.log('⚠️ Found clock-in while already clocked in - treating as new session');
          }
          currentClockIn = eventTime;
          workingDays.add(eventDate);
          
        } else if (eventType === 'clock-out') {
          if (currentClockIn) {
            // Calculate work period
            const diffMs = eventTime.getTime() - currentClockIn.getTime();
            const diffMinutes = Math.max(0, diffMs / (1000 * 60)); // Ensure positive
            
            console.log(`⏱️ Work period: ${currentClockIn.toLocaleTimeString()} → ${eventTime.toLocaleTimeString()} = ${(diffMinutes/60).toFixed(2)}h`);
            
            totalMinutes += diffMinutes;
            currentClockIn = null; // Reset for next period
            workingDays.add(eventDate);
            
          } else {
            console.log('⚠️ Clock-out without matching clock-in - skipping');
          }
        }
      }
      
      // Handle incomplete day (ended with clock-in, no clock-out)
      if (currentClockIn) {
        console.log('⚠️ Incomplete period (no clock-out) - not counting');
      }
      
      attendance.totalMinutes = totalMinutes;
      attendance.totalHours = Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimals
      attendance.attendanceDays = workingDays.size;
      
      console.log(`✅ Employee ${empId} total: ${attendance.totalHours}h over ${attendance.attendanceDays} days`);
    });
    
    // 5. Generate assessment records
    const assessmentRecords = [];
    let totalEmployees = 0;
    let totalHoursWorked = 0;
    let totalHoursShort = 0;
    let totalAmountDue = 0;
    let totalPotentialPayroll = 0;
    
    // Process employees sequentially to handle async past due hours calculation
    for (const emp of employees) {
      const attendance = employeeAttendance[emp.employeeId] || { totalHours: 0, attendanceDays: 0 };
      
      const currentHours = Math.round(attendance.totalHours * 100) / 100; // Round to 2 decimal places
      const hoursShort = Math.max(0, requiredHoursPerMonth - currentHours);
      
      // Calculate past due hours based on employee's assigned shift schedule
      const pastDueHours = await calculatePastDueHoursForEmployee(businessId, emp, month);
      
      const currentIncomeDue = currentHours * emp.payRate;
      const potentialIncome = requiredHoursPerMonth * emp.payRate;
      
      // Determine status
      let status = 'On Track';
      let statusColor = '#28a745';
      
      if (hoursShort > 40) {
        status = 'Critical';
        statusColor = '#dc3545';
      } else if (hoursShort > 0) {
        status = 'Behind';
        statusColor = '#fd7e14';
      }
      
      const record = {
        employeeIndex: totalEmployees + 1,
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        slot: emp.slot,
        requiredHours: requiredHoursPerMonth,
        currentHours: currentHours,
        pastDueHours: pastDueHours,
        hoursShort: hoursShort,
        payRate: emp.payRate,
        currentIncomeDue: Math.round(currentIncomeDue * 100) / 100,
        potentialIncome: Math.round(potentialIncome * 100) / 100,
        status: status,
        statusColor: statusColor,
        attendanceDays: attendance.attendanceDays,
        attendanceStatus: emp.active ? 'active' : 'inactive',
        calculatedAt: new Date().toISOString(),
        month: month
      };
      
      assessmentRecords.push(record);
      
      // Update totals
      totalEmployees++;
      totalHoursWorked += currentHours;
      totalHoursShort += hoursShort;
      totalAmountDue += currentIncomeDue;
      totalPotentialPayroll += potentialIncome;
    };
    
    // 6. Calculate summary data
    const averageAttendance = totalEmployees > 0 ? 
      Math.round((totalHoursWorked / (requiredHoursPerMonth * totalEmployees)) * 10000) / 100 : 0;
    
    const summary = {
      totalEmployees,
      totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
      totalHoursShort: Math.round(totalHoursShort * 100) / 100,
      totalAmountDue: Math.round(totalAmountDue * 100) / 100,
      totalPotentialPayroll: Math.round(totalPotentialPayroll * 100) / 100,
      averageAttendance: averageAttendance,
      requiredHoursPerMonth,
      calculatedAt: new Date().toISOString(),
      month: month
    };
    
    console.log('📈 Assessment Summary:', summary);
    console.log(`👥 Generated ${assessmentRecords.length} employee records`);
    
    // 7. Store in cache collection
    const cacheRef = doc(db, "businesses", businessId, "assessment_cache", month);
    await setDoc(cacheRef, {
      summary,
      employees: assessmentRecords,
      lastUpdated: new Date(),
      calculationVersion: "1.0"
    });
    
    console.log('✅ Assessment data cached successfully');
    
    return {
      success: true,
      summary,
      employeeCount: assessmentRecords.length,
      cached: true
    };
    
  } catch (error) {
    console.error('❌ Error calculating assessment:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Manual trigger function for testing
 */
export async function triggerAssessmentCalculation() {
  const businessId = 'biz_machine_2'; // Your current business ID
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
  
  console.log('🚀 Manual trigger for:', { businessId, month: currentMonth });
  
  const result = await calculateAndCacheAssessment(businessId, currentMonth);
  console.log('📊 Calculation result:', result);
  
  return result;
}

// Export for Cloud Functions
export { calculateAndCacheAssessment as default };