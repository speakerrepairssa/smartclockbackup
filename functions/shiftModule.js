/**
 * SHIFT MANAGEMENT MODULE
 * Handles creation, management, and assignment of work shifts
 * Isolated module to prevent conflicts with other functions
 */

const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

/**
 * Helper: Calculate hours for a single day based on schedule
 * Supports overnight shifts that cross midnight
 */
function calculateShiftHours(startTime, endTime, breakMinutes = 0) {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let startDecimal = startH + startM/60;
  let endDecimal = endH + endM/60;

  // If end < start, shift crosses midnight
  if (endDecimal < startDecimal) {
    endDecimal += 24; // Add 24 hours to end time
  }

  const totalHours = endDecimal - startDecimal;
  const payableHours = totalHours - (breakMinutes / 60);

  return Math.max(0, payableHours);
}

/**
 * Helper: Calculate total required hours for a shift in a given month
 */
async function calculateRequiredHoursForShift(businessId, shiftId, month) {
  try {
    const shiftDoc = await db.collection("businesses").doc(businessId)
      .collection("shifts").doc(shiftId).get();

    if (!shiftDoc.exists) {
      return { error: 'Shift not found', requiredHours: 0 };
    }

    const shift = shiftDoc.data();
    const [year, monthNum] = month.split('-');
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    let requiredHours = 0;
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthNum - 1, day);
      const dayOfWeek = date.getDay();
      const dayName = dayNames[dayOfWeek];
      const daySchedule = shift.schedule[dayName];

      if (daySchedule && daySchedule.enabled) {
        const breakDuration = daySchedule.breakDuration || shift.defaultBreakDuration || 0;
        const dayHours = calculateShiftHours(
          daySchedule.startTime,
          daySchedule.endTime,
          breakDuration
        );
        requiredHours += dayHours;
      }
    }

    return {
      shiftName: shift.shiftName,
      requiredHours: Math.round(requiredHours * 100) / 100
    };

  } catch (error) {
    console.error('Error calculating shift hours:', error);
    return { error: error.message, requiredHours: 0 };
  }
}

/**
 * Get all active shifts for a business
 */
async function getShifts(businessId) {
  try {
    const shiftsRef = db.collection("businesses").doc(businessId).collection("shifts");
    const shiftsSnap = await shiftsRef.where("active", "==", true).get();

    const shifts = [];
    shiftsSnap.forEach(doc => {
      shifts.push({
        shiftId: doc.id,
        ...doc.data()
      });
    });

    // Sort by default first, then by name
    shifts.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.shiftName.localeCompare(b.shiftName);
    });

    return { success: true, shifts };

  } catch (error) {
    console.error('Error getting shifts:', error);
    return { success: false, error: error.message, shifts: [] };
  }
}

/**
 * Get a single shift by ID
 */
async function getShift(businessId, shiftId) {
  try {
    const shiftDoc = await db.collection("businesses").doc(businessId)
      .collection("shifts").doc(shiftId).get();

    if (!shiftDoc.exists) {
      return { success: false, error: 'Shift not found' };
    }

    return {
      success: true,
      shift: {
        shiftId: shiftDoc.id,
        ...shiftDoc.data()
      }
    };

  } catch (error) {
    console.error('Error getting shift:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the default shift for a business
 */
async function getDefaultShift(businessId) {
  try {
    const shiftsRef = db.collection("businesses").doc(businessId).collection("shifts");
    const defaultShiftSnap = await shiftsRef
      .where("isDefault", "==", true)
      .where("active", "==", true)
      .limit(1)
      .get();

    if (defaultShiftSnap.empty) {
      return { success: true, shift: null };
    }

    const doc = defaultShiftSnap.docs[0];
    return {
      success: true,
      shift: {
        shiftId: doc.id,
        ...doc.data()
      }
    };

  } catch (error) {
    console.error('Error getting default shift:', error);
    return { success: false, error: error.message, shift: null };
  }
}

/**
 * Validate shift data
 */
function validateShiftData(shiftData) {
  const errors = [];

  // Check shift name
  if (!shiftData.shiftName || shiftData.shiftName.trim().length === 0) {
    errors.push('Shift name is required');
  }

  // Check that at least one day is enabled
  const schedule = shiftData.schedule || {};
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const hasEnabledDay = dayNames.some(day => schedule[day] && schedule[day].enabled);

  if (!hasEnabledDay) {
    errors.push('At least one day must be enabled');
  }

  // Validate each enabled day
  dayNames.forEach(day => {
    const daySchedule = schedule[day];
    if (daySchedule && daySchedule.enabled) {
      // Check time format
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(daySchedule.startTime)) {
        errors.push(`${day}: Invalid start time format (use HH:MM)`);
      }
      if (!timeRegex.test(daySchedule.endTime)) {
        errors.push(`${day}: Invalid end time format (use HH:MM)`);
      }

      // Check break duration
      if (daySchedule.breakDuration && daySchedule.breakDuration < 0) {
        errors.push(`${day}: Break duration cannot be negative`);
      }

      // Calculate hours to ensure break isn't longer than work
      if (daySchedule.startTime && daySchedule.endTime) {
        const workHours = calculateShiftHours(
          daySchedule.startTime,
          daySchedule.endTime,
          0 // Don't include break in this check
        );
        const breakHours = (daySchedule.breakDuration || 0) / 60;

        if (breakHours >= workHours) {
          errors.push(`${day}: Break duration must be less than working hours`);
        }
      }
    }
  });

  // Validate daily multipliers
  const dailyMultipliers = shiftData.dailyMultipliers || {};
  dayNames.forEach(day => {
    const multiplier = dailyMultipliers[day];
    if (multiplier !== undefined && multiplier !== null) {
      if (isNaN(multiplier) || multiplier < 0) {
        errors.push(`${day}: Invalid multiplier value (must be a positive number)`);
      }
    }
  });

  return errors;
}

/**
 * Create a new shift
 */
async function createShift(businessId, shiftData) {
  try {
    // Validate data
    const validationErrors = validateShiftData(shiftData);
    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors };
    }

    // If this is set as default, unset other defaults
    if (shiftData.isDefault) {
      const shiftsRef = db.collection("businesses").doc(businessId).collection("shifts");
      const currentDefaults = await shiftsRef.where("isDefault", "==", true).get();

      const batch = db.batch();
      currentDefaults.forEach(doc => {
        batch.update(doc.ref, { isDefault: false });
      });
      await batch.commit();
    }

    // Create shift document
    const shiftRef = db.collection("businesses").doc(businessId).collection("shifts").doc();
    const newShift = {
      shiftId: shiftRef.id,
      shiftName: shiftData.shiftName,
      description: shiftData.description || '',
      schedule: shiftData.schedule,
      defaultBreakDuration: shiftData.defaultBreakDuration || 60,
      isDefault: shiftData.isDefault || false,
      color: shiftData.color || '#4CAF50',
      dailyMultipliers: shiftData.dailyMultipliers || {
        sunday: 1.5,
        monday: 1.0,
        tuesday: 1.0,
        wednesday: 1.0,
        thursday: 1.0,
        friday: 1.0,
        saturday: 1.25
      },
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await shiftRef.set(newShift);

    console.log(`✅ Created shift: ${shiftData.shiftName} (${shiftRef.id})`);

    return {
      success: true,
      shiftId: shiftRef.id,
      shift: newShift
    };

  } catch (error) {
    console.error('Error creating shift:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing shift
 */
async function updateShift(businessId, shiftId, shiftData) {
  try {
    // Validate data
    const validationErrors = validateShiftData(shiftData);
    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors };
    }

    // Check if shift exists
    const shiftRef = db.collection("businesses").doc(businessId).collection("shifts").doc(shiftId);
    const shiftDoc = await shiftRef.get();

    if (!shiftDoc.exists) {
      return { success: false, error: 'Shift not found' };
    }

    // If setting as default, unset other defaults
    if (shiftData.isDefault) {
      const shiftsRef = db.collection("businesses").doc(businessId).collection("shifts");
      const currentDefaults = await shiftsRef
        .where("isDefault", "==", true)
        .get();

      const batch = db.batch();
      currentDefaults.forEach(doc => {
        if (doc.id !== shiftId) {
          batch.update(doc.ref, { isDefault: false });
        }
      });
      await batch.commit();
    }

    // Update shift
    const updateData = {
      shiftName: shiftData.shiftName,
      description: shiftData.description || '',
      schedule: shiftData.schedule,
      defaultBreakDuration: shiftData.defaultBreakDuration || 60,
      isDefault: shiftData.isDefault || false,
      color: shiftData.color || '#4CAF50',
      dailyMultipliers: shiftData.dailyMultipliers || {
        sunday: 1.5,
        monday: 1.0,
        tuesday: 1.0,
        wednesday: 1.0,
        thursday: 1.0,
        friday: 1.0,
        saturday: 1.25
      },
      updatedAt: new Date().toISOString()
    };

    await shiftRef.update(updateData);

    console.log(`✅ Updated shift: ${shiftData.shiftName} (${shiftId})`);

    return {
      success: true,
      shiftId: shiftId,
      shift: { ...updateData, shiftId }
    };

  } catch (error) {
    console.error('Error updating shift:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get list of employees using a specific shift
 */
async function getEmployeesOnShift(businessId, shiftId) {
  try {
    const staffRef = db.collection("businesses").doc(businessId).collection("staff");
    const staffSnap = await staffRef.where("shiftId", "==", shiftId).get();

    const employees = [];
    staffSnap.forEach(doc => {
      const data = doc.data();
      employees.push({
        employeeId: doc.id,
        employeeName: data.employeeName || data.name || data.empName || `Slot ${doc.id}`,
        slot: data.slot
      });
    });

    return { success: true, employees, count: employees.length };

  } catch (error) {
    console.error('Error getting employees on shift:', error);
    return { success: false, error: error.message, employees: [], count: 0 };
  }
}

/**
 * Delete a shift (soft delete)
 * Validates that no employees are assigned to it
 */
async function deleteShift(businessId, shiftId) {
  try {
    // Check if shift exists
    const shiftRef = db.collection("businesses").doc(businessId).collection("shifts").doc(shiftId);
    const shiftDoc = await shiftRef.get();

    if (!shiftDoc.exists) {
      return { success: false, error: 'Shift not found' };
    }

    // Check if any employees are using this shift
    const employeesResult = await getEmployeesOnShift(businessId, shiftId);

    if (employeesResult.count > 0) {
      return {
        success: false,
        error: 'Cannot delete shift that is assigned to employees',
        employees: employeesResult.employees,
        count: employeesResult.count
      };
    }

    // Soft delete the shift
    await shiftRef.update({
      active: false,
      updatedAt: new Date().toISOString()
    });

    console.log(`🗑️  Deleted shift: ${shiftDoc.data().shiftName} (${shiftId})`);

    return { success: true, message: 'Shift deleted successfully' };

  } catch (error) {
    console.error('Error deleting shift:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Assign a shift to an employee
 * Automatically copies daily multipliers from shift to employee
 */
async function assignShiftToEmployee(businessId, employeeId, shiftId) {
  try {
    // Update employee
    const employeeRef = db.collection("businesses").doc(businessId)
      .collection("staff").doc(employeeId);
    const employeeDoc = await employeeRef.get();

    if (!employeeDoc.exists) {
      return { success: false, error: 'Employee not found' };
    }

    let shiftName = null;
    let dailyMultipliers = null;

    // Validate shift exists and get shift data
    if (shiftId) {
      const shiftDoc = await db.collection("businesses").doc(businessId)
        .collection("shifts").doc(shiftId).get();

      if (!shiftDoc.exists || !shiftDoc.data().active) {
        return { success: false, error: 'Shift not found or inactive' };
      }

      const shiftData = shiftDoc.data();
      shiftName = shiftData.shiftName;
      dailyMultipliers = shiftData.dailyMultipliers || {};
    }

    // Prepare employee update
    const updateData = {
      shiftId: shiftId || null,
      shiftName: shiftName || null,
      updatedAt: new Date().toISOString()
    };

    // Copy multipliers from shift to employee
    if (dailyMultipliers) {
      updateData.mondayMultiplier = dailyMultipliers.monday || 1.0;
      updateData.tuesdayMultiplier = dailyMultipliers.tuesday || 1.0;
      updateData.wednesdayMultiplier = dailyMultipliers.wednesday || 1.0;
      updateData.thursdayMultiplier = dailyMultipliers.thursday || 1.0;
      updateData.fridayMultiplier = dailyMultipliers.friday || 1.0;
      updateData.saturdayMultiplier = dailyMultipliers.saturday || 1.25;
      updateData.sundayMultiplier = dailyMultipliers.sunday || 1.5;
    }

    await employeeRef.update(updateData);

    console.log(`✅ Assigned shift ${shiftName || 'default'} to employee ${employeeId}`);
    if (dailyMultipliers) {
      console.log(`📊 Copied multipliers to employee: Mon=${dailyMultipliers.monday}, Sat=${dailyMultipliers.saturday}, Sun=${dailyMultipliers.sunday}`);
    }

    return {
      success: true,
      message: shiftId ? `Shift assigned successfully with multipliers` : 'Reverted to business default schedule'
    };

  } catch (error) {
    console.error('Error assigning shift to employee:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  // CRUD Operations
  getShifts,
  getShift,
  getDefaultShift,
  createShift,
  updateShift,
  deleteShift,

  // Integration Functions
  calculateRequiredHoursForShift,
  getEmployeesOnShift,
  assignShiftToEmployee,

  // Helper Functions
  calculateShiftHours
};
