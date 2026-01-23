const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const busboy = require('busboy');

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Add debug webhook
const { debugWebhook } = require('./debug-webhook.js');
exports.debugWebhook = debugWebhook;

/**
 * Cloud Function to handle attendance webhooks from Hikvision devices
 * Dynamically maps deviceId to the correct business
 */
exports.attendanceWebhook = onRequest(async (req, res) => {
  // Set CORS headers for all responses
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    logger.info("Attendance webhook received", { 
      method: req.method, 
      headers: req.headers,
      contentType: req.get('content-type'),
      contentLength: req.get('content-length')
    });

    // 🎯 EXTRACT DEVICE INTERNAL ID FROM MULTIPART BOUNDARY
    let deviceInternalId = null;
    const contentType = req.get('content-type');
    if (contentType && contentType.includes('multipart/form-data')) {
      const boundaryMatch = contentType.match(/boundary=([^;,\s]+)/);
      if (boundaryMatch) {
        // Extract device ID from boundary (e.g., "------------------------I30zHlMXSZssZgWvd3t1iH")
        deviceInternalId = boundaryMatch[1].replace(/^-+/, ''); // Remove leading dashes
        logger.info("🔑 Extracted device internal ID from boundary", { 
          contentType,
          boundary: boundaryMatch[1],
          deviceInternalId 
        });
      }
    }

    let eventData = {};

    // Handle multipart/form-data from VPS relay
    if (req.get('content-type')?.includes('multipart/form-data')) {
      logger.info("🔄 Parsing multipart data...");
      eventData = await parseMultipartData(req);
      logger.info("📦 Multipart data parsed:", { 
        fieldCount: Object.keys(eventData).length,
        fields: Object.keys(eventData)
      });
    }
    // Handle JSON from direct HTTP calls
    else if (req.get('content-type')?.includes('application/json')) {
      eventData = req.body;
      logger.info("📦 JSON data received:", eventData);
    }
    // Handle URL-encoded data
    else if (req.get('content-type')?.includes('application/x-www-form-urlencoded')) {
      eventData = req.body;
      logger.info("📦 URL-encoded data received:", eventData);
    }
    else {
      throw new Error(`Unsupported content type: ${req.get('content-type')}`);
    }

    // Log all received data for debugging
    logger.info("📦 Raw eventData keys:", Object.keys(eventData));
    logger.info("📦 EventData sample:", JSON.stringify(eventData).substring(0, 1000));

    // Handle test mode
    if (eventData.testMode) {
      logger.info("🧪 Test mode detected - returning success without processing");
      res.status(200).json({ 
        success: true, 
        message: 'Test successful - webhook is receiving data',
        testMode: true,
        deviceId: eventData.deviceId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if this is just a heartbeat/keepalive (no employee or AccessControllerEvent data)
    if (!eventData.employeeId && !eventData.verifyNo && !eventData.event_log && !eventData.AccessControllerEvent) {
      logger.info("⏭️ Skipping heartbeat/keepalive message (no employee data)");
      res.status(200).json({ success: true, message: 'Heartbeat received' });
      return;
    }

    // 🔍 EXTRACT BADGE NUMBER AND EVENT DATA
    let { deviceId, employeeId, employeeName, attendanceStatus, timestamp, event_log, AccessControllerEvent } = eventData;
    let verifyNo = null;
    let serialNo = null;

    // Parse direct AccessControllerEvent if present (JSON payload)
    if (AccessControllerEvent) {
      verifyNo = AccessControllerEvent.employeeNoString;
      employeeName = AccessControllerEvent.name;
      attendanceStatus = AccessControllerEvent.attendanceStatus;
      serialNo = AccessControllerEvent.serialNo;
      
      logger.info("📦 Direct AccessControllerEvent data", { 
        verifyNo, 
        employeeName,
        attendanceStatus,
        serialNo,
        rawAccessControllerEvent: AccessControllerEvent
      });
    }

    // Parse event_log if it exists (from VPS relay multipart)
    else if (event_log && typeof event_log === 'string') {
      try {
        // Clean the JSON string
        const cleanedJson = event_log.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        logger.info("🧹 Cleaned JSON:", cleanedJson.substring(0, 500));
        
        const eventLogData = JSON.parse(cleanedJson);
        logger.info("✅ Parsed event_log:", eventLogData);
        
        if (eventLogData.AccessControllerEvent) {
          verifyNo = eventLogData.AccessControllerEvent.employeeNoString || eventLogData.AccessControllerEvent.verifyNo;
          employeeName = eventLogData.AccessControllerEvent.name;
          serialNo = eventLogData.AccessControllerEvent.serialNo;
          deviceId = eventLogData.deviceID || deviceId;
          
          // Determine attendance status from event
          if (eventLogData.AccessControllerEvent.attendanceStatus) {
            attendanceStatus = eventLogData.AccessControllerEvent.attendanceStatus;
          } else {
            // Toggle logic: alternate between in/out for same employee
            attendanceStatus = 'in'; // Default to 'in', business logic will handle toggle
          }
          
          logger.info("📦 Extracted badge data from event_log", { 
            verifyNo, 
            employeeName,
            serialNo, 
            deviceId,
            attendanceStatus,
            rawEventLogData: eventLogData.AccessControllerEvent
          });
        }
      } catch (parseError) {
        logger.warn("Failed to parse event_log", parseError);
        logger.info("📝 Raw event_log field:", event_log);
      }
    }

    // Extract badge number from direct fields
    if (!verifyNo && eventData.verifyNo) {
      verifyNo = eventData.verifyNo;
    }
    if (!serialNo && eventData.serialNo) {
      serialNo = eventData.serialNo;
    }

    // 🎯 CRITICAL: ALWAYS use slot number (1-6), IGNORE device auto-generated employeeId
    if (verifyNo && parseInt(verifyNo) >= 1 && parseInt(verifyNo) <= 6) {
      employeeId = verifyNo.toString();
      employeeName = employeeName || `Employee ${verifyNo}`;
      logger.info("✅ Using verifyNo as slot number", { 
        slotNumber: verifyNo,
        employeeId: employeeId,
        ignoredDeviceEmployeeId: eventData.employeeId
      });
    } else {
      logger.error("🚨 INVALID SLOT NUMBER", {
        verifyNo,
        deviceEmployeeId: eventData.employeeId,
        expectedRange: "1-6"
      });
      // Don't process invalid slot numbers
      res.status(400).json({ 
        error: 'Invalid slot number - must be 1-6',
        verifyNo,
        deviceEmployeeId: eventData.employeeId
      });
      return;
    }

    logger.info("🎯 Final extracted values", { 
      employeeId, 
      verifyNo, 
      employeeName,
      deviceId,
      attendanceStatus 
    });

    // 🔑 DEVICE INTERNAL ID TO EMPLOYEE MAPPING
    // If we have a device internal ID, try to map it to an employee slot
    if (deviceInternalId && !employeeId && !verifyNo) {
      logger.info("🔍 Looking up employee mapping for device internal ID", { deviceInternalId });
      
      // First find the business by deviceId
      const tempBusinessId = await findBusinessByDeviceId(deviceId);
      if (tempBusinessId) {
        try {
          const mappingRef = db.collection('businesses')
            .doc(tempBusinessId)
            .collection('device_mappings')
            .doc(deviceInternalId);
          
          const mappingSnap = await mappingRef.get();
          
          if (mappingSnap.exists) {
            const mappingData = mappingSnap.data();
            employeeId = mappingData.employeeId;
            verifyNo = mappingData.slotId;
            employeeName = mappingData.employeeName || `Employee ${mappingData.slotId}`;
            
            logger.info("✅ Found device mapping", { 
              deviceInternalId, 
              mappedToSlot: mappingData.slotId,
              employeeName: mappingData.employeeName
            });
          } else {
            logger.warn("❌ No mapping found for device internal ID", { 
              deviceInternalId, 
              businessId: tempBusinessId 
            });
          }
        } catch (mappingError) {
          logger.error("Error looking up device mapping", mappingError);
        }
      }
    }

    // Validate required fields
    if (!deviceId || (!employeeId && !verifyNo && !deviceInternalId)) {
      throw new Error('Missing required fields: deviceId and (employeeId or verifyNo/badgeNumber or deviceInternalId)');
    }

    logger.info("🎯 Processing attendance", { 
      deviceId, 
      employeeId, 
      employeeName, 
      verifyNo, 
      serialNo,
      attendanceStatus 
    });

    // 🔥 DYNAMIC DEVICE-TO-BUSINESS MAPPING
    const businessId = await findBusinessByDeviceId(deviceId);
    
    if (!businessId) {
      logger.error("Device not registered to any business", { 
        deviceId,
        solution: "Admin must register this device in the admin dashboard" 
      });
      res.status(400).json({ 
        error: 'Device not registered',
        deviceId,
        message: 'This device needs to be registered to a business by an admin',
        action: 'Contact admin to register device'
      });
      return;
    }

    logger.info("Mapped device to business", { deviceId, businessId });

    // Process attendance event for the correct business
    await processAttendanceEvent(businessId, {
      deviceId,
      employeeId,
      employeeName: employeeName || `Employee ${employeeId || verifyNo}`,
      attendanceStatus: attendanceStatus || 'in',
      timestamp: timestamp || new Date().toISOString(),
      verifyNo,
      serialNo
    });

    res.status(200).json({ 
      success: true, 
      message: 'Attendance processed successfully',
      businessId,
      deviceId,
      employeeId,
      verifyNo,
      attendanceStatus
    });

  } catch (error) {
    logger.error("Error processing attendance webhook", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Parse multipart/form-data from VPS HTTP relay using rawBody buffer approach
 * Based on working solution from January 19, 2026
 */
function parseMultipartData(req) {
  return new Promise((resolve, reject) => {
    try {
      // Use rawBody buffer if available (preferred method that was working)
      if (req.rawBody) {
        logger.info("🔄 Using rawBody buffer for multipart parsing");
        
        const bb = busboy({ 
          headers: req.headers,
          limits: {
            fieldSize: 10 * 1024 * 1024,
            fields: 50
          }
        });
        
        const fields = {};
        let hasData = false;

        bb.on('field', (fieldname, value, info) => {
          logger.info(`📝 Field ${fieldname}:`, { 
            valueLength: value.length,
            preview: value.substring(0, 200),
            truncated: info
          });
          
          fields[fieldname] = value;
          hasData = true;
        });

        bb.on('file', (fieldname, file, info) => {
          logger.info(`📎 File field: ${fieldname}`, info);
          file.resume(); // Drain the stream
          hasData = true;
        });

        bb.on('finish', () => {
          logger.info("✅ Multipart parsing completed", { 
            fieldCount: Object.keys(fields).length,
            fields: Object.keys(fields)
          });
          resolve(fields);
        });

        bb.on('error', (err) => {
          logger.error("❌ Busboy error:", err);
          reject(new Error(`Multipart parsing failed: ${err.message}`));
        });

        // Write the raw body buffer to busboy
        if (req.rawBody && req.rawBody.length > 0) {
          logger.info("📦 Writing rawBody to busboy", { 
            bufferLength: req.rawBody.length,
            bufferPreview: req.rawBody.toString('utf8', 0, Math.min(200, req.rawBody.length))
          });
          bb.write(req.rawBody);
          bb.end();
        } else {
          logger.warn("⚠️ rawBody is empty or undefined");
          reject(new Error('No rawBody data available'));
        }
        
      } else {
        // Fallback: collect body manually then parse
        logger.info("🔄 Collecting request body manually");
        
        let body = Buffer.alloc(0);
        
        req.on('data', chunk => {
          body = Buffer.concat([body, chunk]);
        });
        
        req.on('end', () => {
          logger.info("📦 Body collected:", { length: body.length });
          
          const bb = busboy({ 
            headers: req.headers,
            limits: {
              fieldSize: 10 * 1024 * 1024,
              fields: 50
            }
          });
          
          const fields = {};

          bb.on('field', (fieldname, value, info) => {
            logger.info(`📝 Field ${fieldname}:`, { 
              valueLength: value.length,
              preview: value.substring(0, 200)
            });
            fields[fieldname] = value;
          });

          bb.on('file', (fieldname, file, info) => {
            logger.info(`📎 File field: ${fieldname}`, info);
            file.resume();
          });

          bb.on('finish', () => {
            logger.info("✅ Manual parsing completed", { fieldCount: Object.keys(fields).length });
            resolve(fields);
          });

          bb.on('error', (err) => {
            logger.error("❌ Manual busboy error:", err);
            reject(err);
          });

          bb.write(body);
          bb.end();
        });

        req.on('error', (err) => {
          logger.error("❌ Request error:", err);
          reject(err);
        });
      }

    } catch (error) {
      logger.error("❌ Error setting up multipart parser:", error);
      reject(error);
    }
  });
}

/**
 * 🔍 FIND BUSINESS BY DEVICE ID
 * Queries all businesses to find which one owns the device
 */
async function findBusinessByDeviceId(deviceId) {
  try {
    logger.info("Searching for business with deviceId", { deviceId });

    // Query all businesses for device assignments
    const businessesSnapshot = await db.collection('businesses').get();
    
    for (const doc of businessesSnapshot.docs) {
      const businessData = doc.data();
      
      // Check if this business owns the device
      if (businessData.deviceId === deviceId) {
        logger.info("Found business for device", { 
          businessId: doc.id, 
          businessName: businessData.businessName,
          deviceId 
        });
        return doc.id;
      }
    }

    // Device not found in any business - return null instead of defaulting
    logger.warn("No business found for deviceId - device may need to be registered", { deviceId });
    return null;

  } catch (error) {
    logger.error("Error finding business by deviceId", error);
    throw error;
  }
}

/**
 * 📝 PROCESS ATTENDANCE EVENT
 * Updates the correct business's attendance data with badge number mapping
 */
async function processAttendanceEvent(businessId, eventData) {
  try {
    const { employeeId, employeeName, attendanceStatus, timestamp, deviceId, verifyNo, serialNo } = eventData;
    
    logger.info("🎯 Processing attendance for business", { 
      businessId, 
      employeeId, 
      employeeName, 
      attendanceStatus,
      verifyNo,
      serialNo,
      rawEventData: eventData
    });

    // 🎯 EXTRACT SLOT NUMBER FROM DEVICE EMPLOYEE ID
    // Device Employee ID = Slot Number (direct 1:1 mapping)
    let slotNumber;
    
    // Priority 1: verifyNo (from AccessControllerEvent.employeeNoString)
    if (verifyNo && !isNaN(verifyNo)) {
      slotNumber = parseInt(verifyNo);
      logger.info("✅ Using verifyNo as slot number", { verifyNo, slotNumber });
    } 
    // Priority 2: employeeId (fallback)
    else if (employeeId && !isNaN(employeeId)) {
      slotNumber = parseInt(employeeId);
      logger.info("✅ Using employeeId as slot number", { employeeId, slotNumber });
    } 
    // Priority 3: Check if we have a huge number (like 207) - this indicates a problem
    else if (employeeId && parseInt(employeeId) > 100) {
      logger.error("🚨 DETECTED AUTO-GENERATED EMPLOYEE ID", { 
        employeeId, 
        verifyNo,
        message: "Employee ID is too large - likely auto-generated instead of device slot number"
      });
      // Try to extract from the original event data
      if (eventData.AccessControllerEvent?.employeeNoString) {
        slotNumber = parseInt(eventData.AccessControllerEvent.employeeNoString);
        logger.info("🔧 Recovered slot number from AccessControllerEvent", { slotNumber });
      } else {
        throw new Error(`Invalid employee ID detected: ${employeeId}. Expected slot number 1-6, got ${employeeId}`);
      }
    } 
    else {
      logger.error("❌ No valid slot number found", { 
        employeeId, 
        verifyNo, 
        eventData 
      });
      throw new Error("No valid slot number found in device event");
    }

    // Validate slot number is in expected range (1-6)
    if (slotNumber < 1 || slotNumber > 6) {
      logger.error("🚨 Slot number out of range", { 
        slotNumber, 
        expectedRange: "1-6",
        eventData 
      });
      throw new Error(`Slot number ${slotNumber} is out of expected range 1-6`);
    }

    logger.info("🎯 Using slot number from device", { slotNumber, verifyNo, employeeId });

    const isClockingIn = attendanceStatus === 'in' || attendanceStatus === 'checkIn';

    // 🎯 UPDATE NUMBERED STAFF SLOT (CRITICAL: Use slot number as document ID)
    const staffSlotRef = db.collection('businesses')
      .doc(businessId)
      .collection('staff')
      .doc(slotNumber.toString()); // Use slot number directly
    
    // Get existing slot data
    const slotSnap = await staffSlotRef.get();
    const existingSlotData = slotSnap.exists ? slotSnap.data() : {};
    
    // Auto-sync employee data from device on first clock or name change
    const updatedSlotData = {
      employeeId: slotNumber.toString(),
      employeeName: employeeName || existingSlotData.employeeName || `Employee ${slotNumber}`,
      badgeNumber: slotNumber.toString(),
      deviceId: slotNumber.toString(),
      slot: slotNumber,
      active: true, // Activate on first clock
      assignedAt: existingSlotData.assignedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attendanceStatus: isClockingIn ? 'in' : 'out'
    };

    await staffSlotRef.set(updatedSlotData, { merge: true });

    // 📊 UPDATE STATUS COLLECTION FOR REAL-TIME MONITORING
    const statusRef = db.collection('businesses')
      .doc(businessId)
      .collection('status')
      .doc(slotNumber.toString());

    await statusRef.set({
      employeeId: slotNumber.toString(),
      employeeName: employeeName || `Employee ${slotNumber}`,
      badgeNumber: slotNumber.toString(),
      attendanceStatus: isClockingIn ? 'in' : 'out',
      lastClockTime: timestamp,
      lastEventType: isClockingIn ? 'checkin' : 'checkout',
      deviceId: deviceId || 'Unknown',
      slot: slotNumber,
      active: true,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // 📅 STORE EVENT IN DATE-ORGANIZED COLLECTION
    const eventDate = new Date(timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
    const eventTime = new Date(timestamp).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
    
    const eventsRef = db.collection('businesses')
      .doc(businessId)
      .collection('attendance_events')
      .doc(eventDate)
      .collection(slotNumber.toString()) // Slot number (1, 2, 3, etc.)
      .doc();
    
    await eventsRef.set({
      employeeId: slotNumber.toString(),
      employeeName: employeeName || `Employee ${slotNumber}`,
      slotNumber: slotNumber,
      time: eventTime,
      timestamp: timestamp,
      type: isClockingIn ? 'clock-in' : 'clock-out',
      attendanceStatus: attendanceStatus,
      deviceId: deviceId,
      serialNo: serialNo || null,
      recordedAt: new Date().toISOString()
    });

    // 🗂️ UPDATE EMPLOYEE TIMESHEET (Daily Processing)
    const timesheetRef = db.collection('businesses')
      .doc(businessId)
      .collection('employee_timesheets')
      .doc(slotNumber.toString())
      .collection('daily_sheets')
      .doc(eventDate);
    
    // Get existing timesheet or create new
    const timesheetSnap = await timesheetRef.get();
    const existingTimesheet = timesheetSnap.exists ? timesheetSnap.data() : {
      employeeId: slotNumber.toString(),
      employeeName: employeeName || `Employee ${slotNumber}`,
      date: eventDate,
      clockEvents: [],
      workPeriods: [],
      totalHours: 0,
      breakMinutes: 0,
      overtimeHours: 0,
      status: 'active'
    };
    
    // Add new clock event
    existingTimesheet.clockEvents.push({
      timestamp: timestamp,
      type: isClockingIn ? 'clock-in' : 'clock-out',
      time: eventTime
    });
    
    // Calculate work periods and total hours
    const clockEvents = existingTimesheet.clockEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const workPeriods = [];
    let totalHours = 0;
    
    for (let i = 0; i < clockEvents.length; i += 2) {
      const clockIn = clockEvents[i];
      const clockOut = clockEvents[i + 1];
      
      if (clockIn && clockOut && clockIn.type === 'clock-in' && clockOut.type === 'clock-out') {
        const start = new Date(clockIn.timestamp);
        const end = new Date(clockOut.timestamp);
        const hours = (end - start) / (1000 * 60 * 60); // Convert to hours
        
        workPeriods.push({
          start: clockIn.time,
          end: clockOut.time,
          hours: Math.round(hours * 100) / 100
        });
        
        totalHours += hours;
      }
    }
    
    existingTimesheet.workPeriods = workPeriods;
    existingTimesheet.totalHours = Math.round(totalHours * 100) / 100;
    existingTimesheet.overtimeHours = Math.max(0, totalHours - 8); // Over 8 hours = overtime
    existingTimesheet.lastUpdated = new Date().toISOString();
    
    await timesheetRef.set(existingTimesheet);

    // 🏪 UPDATE LAST ATTENDANCE TRACKING
    const lastAttendanceRef = db.collection('businesses')
      .doc(businessId)
      .collection('employee_last_attendance')
      .doc(slotNumber.toString());
    
    await lastAttendanceRef.set({
      employeeId: slotNumber.toString(),
      employeeName: employeeName || `Employee ${slotNumber}`,
      lastEventType: isClockingIn ? 'clock-in' : 'clock-out',
      lastEventTime: timestamp,
      attendanceStatus: isClockingIn ? 'in' : 'out',
      updatedAt: new Date().toISOString()
    });

    logger.info("Attendance event processed successfully", { 
      businessId, 
      slotNumber,
      employeeName,
      attendanceStatus,
      eventDate,
      collectionsUpdated: ['staff', 'status', 'attendance_events', 'employee_timesheets', 'employee_last_attendance']
    });

  } catch (error) {
    logger.error("Error processing attendance event", error);
    throw error;
  }
}

/**
 * � AUTO-SYNC SLOTS ON BUSINESS UPDATE
 * Triggers when slotsAllowed field changes in business document
 */
exports.autoSyncSlots = onDocumentUpdated("businesses/{businessId}", async (event) => {
  try {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const businessId = event.params.businessId;

    // Check if slotsAllowed changed
    if (beforeData.slotsAllowed !== afterData.slotsAllowed) {
      logger.info("SlotsAllowed changed, auto-syncing", {
        businessId,
        before: beforeData.slotsAllowed,
        after: afterData.slotsAllowed
      });

      const newSlotsAllowed = afterData.slotsAllowed || 50;
      
      // Call the existing sync logic
      await syncSlots(businessId, newSlotsAllowed);
      
      logger.info("Auto-sync completed", { businessId, newSlotsAllowed });
    }

  } catch (error) {
    logger.error("Error in auto-sync slots", error);
  }
});

/**
 * 🔧 SYNC BUSINESS SLOTS HELPER FUNCTION
 */
async function syncSlots(businessId, slotsAllowed) {
  const businessRef = db.collection('businesses').doc(businessId);
  const staffRef = businessRef.collection('staff');

  // Get current slots
  const currentSlotsSnap = await staffRef.get();
  const currentSlots = new Set();
  currentSlotsSnap.forEach(doc => {
    currentSlots.add(parseInt(doc.id));
  });

  const targetSlots = parseInt(slotsAllowed);

  // CREATE NEW SLOTS (up to slotsAllowed)
  const slotsToCreate = [];
  for (let i = 1; i <= targetSlots; i++) {
    if (!currentSlots.has(i)) {
      slotsToCreate.push(i);
    }
  }

  // Create missing slots with blank device fields
  for (const slotNum of slotsToCreate) {
    // Create staff slot
    await staffRef.doc(slotNum.toString()).set({
      employeeId: slotNum.toString(),
      employeeName: `Employee ${slotNum}`,
      badgeNumber: slotNum.toString(),
      slotNumber: slotNum,
      isActive: false,
      deviceId: "", // Blank - admin assigns manually
      assignedAt: null,
      createdAt: FieldValue.serverTimestamp()
    });

    // Create status slot
    const statusRef = businessRef.collection('status');
    await statusRef.doc(slotNum.toString()).set({
      employeeId: slotNum.toString(),
      employeeName: `Employee ${slotNum}`,
      currentStatus: "out",
      lastUpdate: FieldValue.serverTimestamp(),
      isActive: false,
      slotNumber: slotNum,
      deviceId: "" // Blank - admin assigns manually
    });

    // Create employee_last_attendance slot
    const lastAttendanceRef = businessRef.collection('employee_last_attendance');
    await lastAttendanceRef.doc(slotNum.toString()).set({
      employeeId: slotNum.toString(),
      employeeName: `Employee ${slotNum}`,
      lastClockIn: null,
      lastClockOut: null,
      currentStatus: "out",
      lastUpdate: FieldValue.serverTimestamp(),
      deviceId: "" // Blank - admin assigns manually
    });
  }

  // REMOVE EXCESS SLOTS (above slotsAllowed, but only if empty)
  const slotsToRemove = [];
  for (const slotNum of currentSlots) {
    if (slotNum > targetSlots) {
      const slotDoc = await staffRef.doc(slotNum.toString()).get();
      const slotData = slotDoc.data();
      
      // Only remove if slot is not active and not assigned
      if (!slotData.active && !slotData.assignedAt) {
        slotsToRemove.push(slotNum);
      }
    }
  }

  // Remove excess empty slots
  for (const slotNum of slotsToRemove) {
    await staffRef.doc(slotNum.toString()).delete();
  }

  // Update business document
  await businessRef.update({
    slotsAllowed: targetSlots,
    lastSlotSync: new Date().toISOString()
  });

  return {
    slotsCreated: slotsToCreate.length,
    slotsRemoved: slotsToRemove.length
  };
}

/**
 * Update business device count
 */
async function updateBusinessDeviceCount(businessId) {
  try {
    // Count devices for this business
    const devicesSnapshot = await db.collection('businesses')
      .doc(businessId)
      .collection('devices')
      .get();
    
    const deviceCount = devicesSnapshot.size;
    
    // Update business document
    await db.collection('businesses').doc(businessId).update({
      deviceCount: deviceCount,
      lastDeviceCountUpdate: FieldValue.serverTimestamp()
    });
    
    logger.info("Updated device count", { businessId, deviceCount });
    return deviceCount;
  } catch (error) {
    logger.error("Error updating device count", { businessId, error });
    throw error;
  }
}

/**
 * 🔧 SYNC BUSINESS SLOTS (Manual trigger)
 * Creates/removes slot documents based on slotsAllowed setting
 */
exports.syncBusinessSlots = onRequest(async (req, res) => {
  try {
    const { businessId, slotsAllowed } = req.body;
    
    if (!businessId || !slotsAllowed) {
      throw new Error('Missing businessId or slotsAllowed');
    }

    logger.info("Manual sync business slots", { businessId, slotsAllowed });

    const result = await syncSlots(businessId, slotsAllowed);

    // Update device count
    await updateBusinessDeviceCount(businessId);

    logger.info("Manual slot sync completed", { 
      businessId,
      slotsAllowed,
      ...result
    });

    res.json({
      success: true,
      businessId,
      slotsAllowed: parseInt(slotsAllowed),
      slotsCreated: result.slotsCreated,
      slotsRemoved: result.slotsRemoved,
      message: 'Slots synchronized successfully'
    });

  } catch (error) {
    logger.error("Error syncing business slots", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 🔧 FIX EXISTING BUSINESSES
 * Updates old business documents to new structure
 */
exports.fixExistingBusinesses = onRequest(async (req, res) => {
  try {
    logger.info("Fixing existing business documents");

    const businessesSnapshot = await db.collection('businesses').get();
    const updates = [];

    for (const doc of businessesSnapshot.docs) {
      const business = doc.data();
      const businessId = doc.id;
      
      // Check if business needs updating
      const needsUpdate = {
        removeMonthlyFee: business.hasOwnProperty('monthlyFee'),
        addSlotsAllowed: !business.hasOwnProperty('slotsAllowed'),
        updatePlan: business.plan && business.plan.includes('(')
      };

      if (needsUpdate.removeMonthlyFee || needsUpdate.addSlotsAllowed || needsUpdate.updatePlan) {
        const updateData = {};
        
        // Remove monthly fee
        if (needsUpdate.removeMonthlyFee) {
          updateData.monthlyFee = FieldValue.delete();
        }
        
        // Add slots allowed (default 50)
        if (needsUpdate.addSlotsAllowed) {
          updateData.slotsAllowed = 50;
        }
        
        // Clean up plan names
        if (needsUpdate.updatePlan) {
          if (business.plan.includes('Basic')) {
            updateData.plan = 'Basic';
          } else if (business.plan.includes('Professional')) {
            updateData.plan = 'Professional';
          } else if (business.plan.includes('Enterprise')) {
            updateData.plan = 'Enterprise';
          }
        }

        // Apply update
        await db.collection('businesses').doc(businessId).update(updateData);
        
        updates.push({
          businessId,
          businessName: business.businessName,
          changes: needsUpdate
        });
        
        logger.info("Updated business", { businessId, businessName: business.businessName, updateData });
      }
    }

    res.json({
      success: true,
      message: 'Existing businesses fixed',
      updatedBusinesses: updates.length,
      details: updates
    });

  } catch (error) {
    logger.error("Error fixing existing businesses", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 🔧 GET ALL BUSINESSES AND THEIR DEVICES
 */
exports.getBusinessDevices = onRequest(async (req, res) => {
  try {
    const businessesSnapshot = await db.collection('businesses').get();
    const businessDevices = [];

    businessesSnapshot.forEach(doc => {
      const data = doc.data();
      businessDevices.push({
        businessId: doc.id,
        businessName: data.businessName,
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        deviceIp: data.deviceIp,
        slotsAllowed: data.slotsAllowed
      });
    });

    res.json({
      success: true,
      businesses: businessDevices
    });

  } catch (error) {
    logger.error("Error getting business devices", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 🔧 ADMIN FUNCTION: Reconstruct Staff Collection with Proper Slots
 * This function cleans up auto-generated staff documents and creates numbered slots
 */
exports.reconstructStaffCollection = onRequest(async (req, res) => {
  try {
    const businessId = req.query.businessId;
    
    if (!businessId) {
      return res.status(400).json({ 
        error: 'businessId is required',
        usage: 'Add ?businessId=your_business_id to the URL'
      });
    }
    logger.info("Reconstructing slots collection", { businessId });

    // Get business configuration
    const businessRef = db.collection('businesses').doc(businessId);
    const businessSnap = await businessRef.get();
    
    if (!businessSnap.exists) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const businessData = businessSnap.data();
    const maxSlots = businessData.slotsAllowed || 10;

    // Create batch for operations
    const batch = db.batch();

    // Create numbered slots (1 through maxSlots) with NEW STRUCTURE
    for (let slotNum = 1; slotNum <= maxSlots; slotNum++) {
      const slotRef = businessRef.collection('slots').doc(slotNum.toString());
      
      batch.set(slotRef, {
        slotNumber: slotNum,
        employeeName: `Employee ${slotNum}`,
        badgeNumber: slotNum.toString(),
        deviceEmployeeId: slotNum.toString(),
        active: false,
        assignedAt: null,
        lockedIn: false,
        createdBy: 'manual_reconstruction',
        createdAt: FieldValue.serverTimestamp()
      });
    }

    // Execute batch
    await batch.commit();

    logger.info("Slots collection reconstructed successfully", { 
      businessId, 
      slotsCreated: maxSlots
    });

    res.json({
      success: true,
      businessId: businessId,
      slotsCreated: maxSlots,
      structure: {
        slots: `/businesses/${businessId}/slots/{1-${maxSlots}}`,
        events: `/businesses/${businessId}/slots/{slotNumber}/events/{YYYY-MM-DD}`,
        liveMonitoring: `/businesses/${businessId}/live_monitoring/{slotNumber}`
      }
    });

  } catch (error) {
    logger.error("Error reconstructing slots collection", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 🔑 ADMIN FUNCTION: Set Device Internal ID Mapping
 * Maps device-generated internal IDs to employee slots
 * URL: /setDeviceMapping?businessId=biz_srcomponents&deviceInternalId=I30zHlMXSZssZgWvd3t1iH&slotId=1&employeeName=azam
 */
exports.setDeviceMapping = onRequest(async (req, res) => {
  try {
    const { businessId, deviceInternalId, slotId, employeeName } = req.query;
    
    if (!businessId || !deviceInternalId || !slotId) {
      return res.status(400).json({ 
        error: 'Missing required parameters: businessId, deviceInternalId, slotId' 
      });
    }

    logger.info("Setting device mapping", { businessId, deviceInternalId, slotId, employeeName });

    // Create the mapping document
    const mappingRef = db.collection('businesses')
      .doc(businessId)
      .collection('device_mappings')
      .doc(deviceInternalId);

    await mappingRef.set({
      deviceInternalId: deviceInternalId,
      slotId: slotId.toString(),
      employeeId: slotId.toString(),
      employeeName: employeeName || `Employee ${slotId}`,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    logger.info("Device mapping created successfully", { 
      businessId, 
      deviceInternalId, 
      slotId, 
      employeeName 
    });

    res.json({
      success: true,
      businessId: businessId,
      deviceInternalId: deviceInternalId,
      slotId: slotId,
      employeeName: employeeName || `Employee ${slotId}`,
      message: 'Device mapping created successfully'
    });

  } catch (error) {
    logger.error("Error setting device mapping", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 📊 PAYROLL FUNCTION: Process Daily Attendance into Timesheets
 * Converts raw attendance events into structured daily timesheets
 * URL: /processDailyTimesheets?businessId=biz_srcomponents&date=2026-01-23
 */
exports.processDailyTimesheets = onRequest(async (req, res) => {
  try {
    const { businessId, date } = req.query;
    
    if (!businessId || !date) {
      return res.status(400).json({ 
        error: 'Missing required parameters: businessId, date (YYYY-MM-DD)' 
      });
    }

    logger.info("Processing daily timesheets", { businessId, date });

    // Get all attendance events for the date organized by slot
    const eventsBySlot = {};
    const dateRef = db.collection('businesses')
      .doc(businessId)
      .collection('attendance_events')
      .doc(date);
    
    // Get all slot collections for this date (1, 2, 3, 4, 5, 6)
    const slotsSnapshot = await dateRef.listCollections();
    
    for (const slotCollection of slotsSnapshot) {
      const slotId = slotCollection.id;
      const slotEventsSnapshot = await slotCollection.get();
      
      if (!slotEventsSnapshot.empty) {
        eventsBySlot[slotId] = slotEventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    }
    
    if (Object.keys(eventsBySlot).length === 0) {
      return res.json({
        success: true,
        message: 'No attendance events found for the date',
        businessId,
        date,
        timesheetsProcessed: 0
      });
    }

    // Process events by slot - events are already grouped by slot
    const timesheetsCreated = [];
    const batch = db.batch();
    let processedCount = 0;
    
    for (const [slotId, events] of Object.entries(eventsBySlot)) {
      if (events.length === 0) continue;
      
      // Sort events by time for this slot
      events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Get employee info from first event
      const firstEvent = events[0];
      const employeeName = firstEvent.employeeName || `Employee ${slotId}`;
      
      // Calculate work periods and total hours
      const clockEvents = events.map(event => ({
        timestamp: event.timestamp,
        type: event.attendanceStatus === 'in' ? 'clock-in' : 'clock-out',
        time: new Date(event.timestamp).toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      }));

      // Calculate work periods (pairs of clock-in/clock-out)
      const workPeriods = [];
      let totalHours = 0;
      
      for (let i = 0; i < clockEvents.length - 1; i += 2) {
        const clockIn = clockEvents[i];
        const clockOut = clockEvents[i + 1];
        
        if (clockIn && clockOut && clockIn.type === 'clock-in' && clockOut.type === 'clock-out') {
          const startTime = new Date(clockIn.timestamp);
          const endTime = new Date(clockOut.timestamp);
          const hours = (endTime - startTime) / (1000 * 60 * 60); // Convert to hours
          
          workPeriods.push({
            start: clockIn.time,
            end: clockOut.time,
            hours: parseFloat(hours.toFixed(2))
          });
          
          totalHours += hours;
        }
      }

      // Get business break duration
      const businessRef = db.collection('businesses').doc(businessId);
      const businessSnap = await businessRef.get();
      const breakMinutes = businessSnap.exists ? (businessSnap.data().breakDuration || 60) : 60;

      // Determine status
      let status = 'complete';
      if (clockEvents.length % 2 !== 0) {
        status = 'incomplete'; // Odd number of events (missing clock-out)
      }

      // Create timesheet document
      const timesheetRef = db.collection('businesses')
        .doc(businessId)
        .collection('employee_timesheets')
        .doc(slotId) // Use slot ID
        .collection(date.substring(0, 7)) // YYYY-MM
        .doc(date);

      batch.set(timesheetRef, {
        employeeId: slotId,
        employeeName: employeeName,
        date: date,
        clockEvents: clockEvents,
        workPeriods: workPeriods,
        totalHours: parseFloat(totalHours.toFixed(2)),
        breakMinutes: breakMinutes,
        overtimeHours: Math.max(0, totalHours - 8), // Over 8 hours is overtime
        status: status,
        lastUpdated: FieldValue.serverTimestamp()
      });

      timesheetsCreated.push({
        employeeId: slotId,
        employeeName: employeeName,
        totalHours: parseFloat(totalHours.toFixed(2)),
        status: status
      });

      processedCount++;
    }

    // Execute batch
    await batch.commit();

    logger.info("Daily timesheets processed successfully", { 
      businessId, 
      date,
      timesheetsProcessed: processedCount,
      timesheets: timesheetsCreated
    });

    res.json({
      success: true,
      businessId: businessId,
      date: date,
      timesheetsProcessed: processedCount,
      message: 'Daily timesheets processed successfully'
    });

  } catch (error) {
    logger.error("Error processing daily timesheets", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 📈 PAYROLL FUNCTION: Calculate Monthly Employee Summaries
 * Aggregates daily timesheets into monthly payroll summaries
 * URL: /calculateMonthlyHours?businessId=biz_srcomponents&month=2026-01
 */
exports.calculateMonthlyHours = onRequest(async (req, res) => {
  try {
    const { businessId, month } = req.query;
    
    if (!businessId || !month) {
      return res.status(400).json({ 
        error: 'Missing required parameters: businessId, month (YYYY-MM)' 
      });
    }

    logger.info("Calculating monthly hours", { businessId, month });

    // Get all employees from staff collection
    const staffRef = db.collection('businesses').doc(businessId).collection('staff');
    const staffSnapshot = await staffRef.get();
    
    const batch = db.batch();
    let processedEmployees = 0;

    for (const staffDoc of staffSnapshot.docs) {
      const employeeId = staffDoc.id;
      const employeeData = staffDoc.data();
      
      // Skip if not a numbered slot or not active
      if (isNaN(employeeId) || !employeeData.active) {
        continue;
      }

      // Get all timesheets for this employee in the month
      const timesheetsRef = db.collection('businesses')
        .doc(businessId)
        .collection('employee_timesheets')
        .doc(employeeId)
        .collection(month);
      
      const timesheetsSnapshot = await timesheetsRef.get();
      
      let totalHours = 0;
      let totalOvertimeHours = 0;
      let daysWorked = 0;
      let completeDays = 0;
      let incompleteDays = 0;

      timesheetsSnapshot.forEach(doc => {
        const timesheet = doc.data();
        totalHours += timesheet.totalHours || 0;
        totalOvertimeHours += timesheet.overtimeHours || 0;
        daysWorked++;
        
        if (timesheet.status === 'complete') {
          completeDays++;
        } else {
          incompleteDays++;
        }
      });

      // Calculate pay (example rates - can be customized per business)
      const regularRate = 25.00; // $25/hour regular
      const overtimeRate = 37.50; // $37.50/hour overtime (1.5x)
      
      const regularHours = totalHours - totalOvertimeHours;
      const regularPay = regularHours * regularRate;
      const overtimePay = totalOvertimeHours * overtimeRate;
      const totalPay = regularPay + overtimePay;

      // Create monthly summary
      const summaryRef = db.collection('businesses')
        .doc(businessId)
        .collection('employee_monthly_summary')
        .doc(employeeId)
        .collection('monthly')
        .doc(month);

      batch.set(summaryRef, {
        employeeId: employeeId,
        employeeName: employeeData.employeeName || `Employee ${employeeId}`,
        month: month,
        totalHours: parseFloat(totalHours.toFixed(2)),
        regularHours: parseFloat(regularHours.toFixed(2)),
        overtimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
        daysWorked: daysWorked,
        completeDays: completeDays,
        incompleteDays: incompleteDays,
        regularRate: regularRate,
        overtimeRate: overtimeRate,
        regularPay: parseFloat(regularPay.toFixed(2)),
        overtimePay: parseFloat(overtimePay.toFixed(2)),
        totalPay: parseFloat(totalPay.toFixed(2)),
        calculatedAt: FieldValue.serverTimestamp()
      });

      processedEmployees++;
    }

    // Execute batch
    await batch.commit();

    logger.info("Monthly summaries calculated successfully", { 
      businessId, 
      month,
      employeesProcessed: processedEmployees
    });

    res.json({
      success: true,
      businessId: businessId,
      month: month,
      employeesProcessed: processedEmployees,
      message: 'Monthly summaries calculated successfully'
    });

  } catch (error) {
    logger.error("Error calculating monthly hours", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 💼 PAYROLL FUNCTION: Generate Business Payroll Report
 * Creates comprehensive payroll reports for businesses
 * URL: /generatePayrollReport?businessId=biz_srcomponents&month=2026-01
 */
exports.generatePayrollReport = onRequest(async (req, res) => {
  try {
    const { businessId, month } = req.query;
    
    if (!businessId || !month) {
      return res.status(400).json({ 
        error: 'Missing required parameters: businessId, month (YYYY-MM)' 
      });
    }

    logger.info("Generating payroll report", { businessId, month });

    // Get business information
    const businessRef = db.collection('businesses').doc(businessId);
    const businessSnap = await businessRef.get();
    const businessData = businessSnap.data();

    // Get all employee monthly summaries
    const summariesSnapshot = await db.collectionGroup('monthly')
      .where('month', '==', month)
      .get();
    
    const employeeSummaries = [];
    let totalBusinessHours = 0;
    let totalBusinessPay = 0;
    let totalEmployees = 0;

    summariesSnapshot.forEach(doc => {
      const summary = doc.data();
      // Filter to this business only
      if (doc.ref.path.includes(`businesses/${businessId}/`)) {
        employeeSummaries.push(summary);
        totalBusinessHours += summary.totalHours || 0;
        totalBusinessPay += summary.totalPay || 0;
        totalEmployees++;
      }
    });

    // Sort by employee ID
    employeeSummaries.sort((a, b) => parseInt(a.employeeId) - parseInt(b.employeeId));

    // Create payroll report
    const payrollReport = {
      businessId: businessId,
      businessName: businessData?.businessName || 'Unknown Business',
      month: month,
      generatedAt: FieldValue.serverTimestamp(),
      totalEmployees: totalEmployees,
      totalHours: parseFloat(totalBusinessHours.toFixed(2)),
      totalPayroll: parseFloat(totalBusinessPay.toFixed(2)),
      averageHoursPerEmployee: totalEmployees > 0 ? parseFloat((totalBusinessHours / totalEmployees).toFixed(2)) : 0,
      averagePayPerEmployee: totalEmployees > 0 ? parseFloat((totalBusinessPay / totalEmployees).toFixed(2)) : 0,
      employeeSummaries: employeeSummaries,
      reportMetadata: {
        slotsAllowed: businessData?.slotsAllowed || 0,
        activeEmployees: totalEmployees,
        slotUtilization: businessData?.slotsAllowed ? parseFloat((totalEmployees / businessData.slotsAllowed * 100).toFixed(2)) : 0
      }
    };

    // Save payroll report
    const reportRef = db.collection('businesses')
      .doc(businessId)
      .collection('payroll_reports')
      .doc(month);

    await reportRef.set(payrollReport);

    logger.info("Payroll report generated successfully", { 
      businessId, 
      month,
      totalEmployees,
      totalPayroll: totalBusinessPay
    });

    res.json({
      success: true,
      ...payrollReport,
      message: 'Payroll report generated successfully'
    });

  } catch (error) {
    logger.error("Error generating payroll report", error);
    res.status(500).json({ error: error.message });
  }
});

// Import and export the correct structure setup function
const { setupCorrectFirebaseStructure } = require('./setupCorrectStructure');
exports.setupCorrectFirebaseStructure = setupCorrectFirebaseStructure;

// Import and export the clean collections function
const { cleanAndRecreateCollections } = require('./cleanCollections');
exports.cleanAndRecreateCollections = cleanAndRecreateCollections;