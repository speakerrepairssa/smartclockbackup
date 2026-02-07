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
    let { deviceId, employeeId, employeeName, attendanceStatus, timestamp, event_log, AccessControllerEvent, businessId } = eventData;
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

    // 🔥 DYNAMIC DEVICE-TO-BUSINESS MAPPING - Now supports multiple businesses
    let businessIds;
    
    // If businessId is provided directly (for testing), use it
    if (businessId) {
      businessIds = [businessId];
      logger.info("Using provided businessId for testing", { businessId });
    } else {
      // Otherwise, find by deviceId
      businessIds = await findBusinessByDeviceId(deviceId);
    }
    
    if (!businessIds || businessIds.length === 0) {
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

    logger.info("Mapped device to businesses", { deviceId, businessIds, count: businessIds.length });

    // Process attendance event for ALL businesses that have this device
    const processPromises = businessIds.map(businessId => 
      processAttendanceEvent(businessId, {
        deviceId,
        employeeId,
        employeeName: employeeName || `Employee ${employeeId || verifyNo}`,
        attendanceStatus: attendanceStatus || 'in',
        timestamp: timestamp || new Date().toISOString(),
        verifyNo,
        serialNo
      })
    );

    await Promise.all(processPromises);

    // 🚀 AUTO-UPDATE ASSESSMENT CACHE for this specific employee
    try {
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM format
      
      // Update cache for only this employee in all affected businesses
      const cachePromises = businessIds.map(async (businessId) => {
        logger.info(`🔄 Updating assessment cache for employee ${employeeId} in business ${businessId}`);
        return updateSingleEmployeeCache(businessId, employeeId, currentMonth);
      });
      
      await Promise.all(cachePromises);
      logger.info(`✅ Assessment cache updated for employee ${employeeId}`);
    } catch (cacheError) {
      logger.warn("⚠️ Assessment cache update failed (non-critical)", { error: cacheError.message });
      // Don't fail the main webhook - cache update is optional
    }

    res.status(200).json({ 
      success: true, 
      message: `Attendance processed successfully for ${businessIds.length} business(es)`,
      businessIds,
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
    logger.info("Searching for businesses with deviceId", { deviceId });

    // Query all businesses to check their devices subcollection
    const businessesSnapshot = await db.collection('businesses').get();
    const businessIds = [];
    
    for (const doc of businessesSnapshot.docs) {
      // Check if this business has the device in its devices subcollection
      const deviceDoc = await db.collection('businesses')
        .doc(doc.id)
        .collection('devices')
        .doc(deviceId)
        .get();
      
      if (deviceDoc.exists) {
        const businessData = doc.data();
        logger.info("Found business for device in subcollection", { 
          businessId: doc.id, 
          businessName: businessData.businessName,
          deviceId 
        });
        businessIds.push(doc.id);
      }
    }

    if (businessIds.length === 0) {
      logger.warn("No business found for deviceId - device may need to be registered", { deviceId });
      return null;
    }

    logger.info(`Found ${businessIds.length} business(es) with device ${deviceId}`, { businessIds });
    return businessIds;

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
    
    // Get business plan limits early for validation
    const businessRef = db.collection('businesses').doc(businessId);
    const businessDoc = await businessRef.get();
    const businessData = businessDoc.exists ? businessDoc.data() : {};
    
    const planLimits = {
      'Basic': 5,
      'Standard': 10,
      'Professional': 20,
      'Premium': 30,
      'Enterprise': 50
    };
    
    const planName = businessData.plan || 'Professional';
    const maxEmployees = businessData.maxEmployees || planLimits[planName] || 20;
    
    logger.info("🎯 Processing attendance for business", { 
      businessId, 
      employeeId, 
      employeeName, 
      attendanceStatus,
      verifyNo,
      serialNo,
      planName,
      maxEmployees,
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
        throw new Error(`Invalid employee ID detected: ${employeeId}. Expected slot number 1-${maxEmployees}, got ${employeeId}`);
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

    // Validate slot number is in expected range based on business plan
    if (slotNumber < 1 || slotNumber > maxEmployees) {
      logger.error("🚨 Slot number out of range", { 
        slotNumber, 
        expectedRange: `1-${maxEmployees}`,
        planName,
        businessId,
        eventData 
      });
      throw new Error(`Slot number ${slotNumber} is out of expected range 1-${maxEmployees} for ${planName} plan`);
    }

    logger.info("🎯 Using slot number from device", { slotNumber, verifyNo, employeeId });

    const isClockingIn = attendanceStatus === 'in' || attendanceStatus === 'checkIn';

    // 🚨 DUPLICATE PREVENTION: Check last clock status to prevent duplicate punches
    const statusRef = db.collection('businesses')
      .doc(businessId)
      .collection('status')
      .doc(slotNumber.toString());
    
    const currentStatusSnap = await statusRef.get();
    const currentStatus = currentStatusSnap.exists ? currentStatusSnap.data() : null;
    const lastClockStatus = currentStatus?.attendanceStatus || 'out'; // Default to 'out' if no history
    
    logger.info("🔍 Duplicate detection check", { 
      slotNumber, 
      currentPunch: attendanceStatus,
      lastClockStatus,
      isDuplicate: (isClockingIn && lastClockStatus === 'in') || (!isClockingIn && lastClockStatus === 'out')
    });
    
    // Check for duplicate clock-ins or clock-outs
    if (isClockingIn && lastClockStatus === 'in') {
      logger.warn("🚨 DUPLICATE CLOCK-IN DETECTED", {
        slotNumber,
        employeeName,
        lastClockStatus,
        newPunch: attendanceStatus,
        timestamp,
        businessId,
        message: "Employee trying to clock in while already clocked in - treating as mispunch"
      });
      
      // Store as mispunch event
      const eventDate = new Date(timestamp).toISOString().split('T')[0];
      const mispunchRef = db.collection('businesses')
        .doc(businessId)
        .collection('attendance_events')
        .doc(eventDate)
        .collection(slotNumber.toString())
        .doc();
      
      await mispunchRef.set({
        employeeId: slotNumber.toString(),
        employeeName: employeeName || `Employee ${slotNumber}`,
        slotNumber: slotNumber,
        time: new Date(timestamp).toLocaleTimeString('en-US', { hour12: false }),
        timestamp: timestamp,
        type: 'clock-in',
        attendanceStatus: 'in',
        deviceId: deviceId,
        serialNo: serialNo || null,
        recordedAt: new Date().toISOString(),
        isDuplicatePunch: true,
        mispunchType: 'duplicate_clock_in',
        lastClockStatus: lastClockStatus,
        mispunchReason: 'Employee attempted to clock in while already clocked in'
      });
      
      throw new Error(`Duplicate clock-in detected for ${employeeName}. Last status was already "in". Punch stored as mispunch for admin review.`);
    }
    
    if (!isClockingIn && lastClockStatus === 'out') {
      logger.warn("🚨 DUPLICATE CLOCK-OUT DETECTED", {
        slotNumber,
        employeeName,
        lastClockStatus,
        newPunch: attendanceStatus,
        timestamp,
        businessId,
        message: "Employee trying to clock out while already clocked out - treating as mispunch"
      });
      
      // Store as mispunch event
      const eventDate = new Date(timestamp).toISOString().split('T')[0];
      const mispunchRef = db.collection('businesses')
        .doc(businessId)
        .collection('attendance_events')
        .doc(eventDate)
        .collection(slotNumber.toString())
        .doc();
      
      await mispunchRef.set({
        employeeId: slotNumber.toString(),
        employeeName: employeeName || `Employee ${slotNumber}`,
        slotNumber: slotNumber,
        time: new Date(timestamp).toLocaleTimeString('en-US', { hour12: false }),
        timestamp: timestamp,
        type: 'clock-out',
        attendanceStatus: 'out',
        deviceId: deviceId,
        serialNo: serialNo || null,
        recordedAt: new Date().toISOString(),
        isDuplicatePunch: true,
        mispunchType: 'duplicate_clock_out',
        lastClockStatus: lastClockStatus,
        mispunchReason: 'Employee attempted to clock out while already clocked out'
      });
      
      throw new Error(`Duplicate clock-out detected for ${employeeName}. Last status was already "out". Punch stored as mispunch for admin review.`);
    }

    logger.info("✅ Valid punch - no duplicates detected", { slotNumber, attendanceStatus, lastClockStatus });

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

    // 📊 UPDATE STATUS COLLECTION FOR REAL-TIME MONITORING (with lastClockStatus tracking)
    const statusUpdateRef = db.collection('businesses')
      .doc(businessId)
      .collection('status')
      .doc(slotNumber.toString());

    await statusUpdateRef.set({
      employeeId: slotNumber.toString(),
      employeeName: employeeName || `Employee ${slotNumber}`,
      badgeNumber: slotNumber.toString(),
      attendanceStatus: isClockingIn ? 'in' : 'out',
      lastClockTime: timestamp,
      lastEventType: isClockingIn ? 'checkin' : 'checkout',
      deviceId: deviceId || 'Unknown',
      slot: slotNumber,
      active: true,
      updatedAt: new Date().toISOString(),
      lastClockStatus: isClockingIn ? 'in' : 'out', // Track for duplicate detection
      previousClockStatus: lastClockStatus // Keep history
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
      recordedAt: new Date().toISOString(),
      lastClockStatus: lastClockStatus, // Previous status for context
      isDuplicatePunch: false, // Valid punch
      isManual: eventData.isManual || false,
      manualNotes: eventData.manualNotes || null
    });

    // � TRIGGER WHATSAPP ON CLOCK-OUT
    if (!isClockingIn) {
      try {
        await sendDailyUpdateWhatsApp(businessId, slotNumber.toString(), employeeName, eventDate);
      } catch (whatsappError) {
        logger.error("Failed to send WhatsApp notification", { error: whatsappError.message });
        // Don't fail the whole operation if WhatsApp fails
      }
    }

    logger.info("✅ UNIFIED: Attendance event processed successfully", { 
      businessId, 
      slotNumber,
      employeeName,
      attendanceStatus,
      eventDate,
      collectionsUpdated: ['staff', 'status', 'attendance_events'] // Only unified collections
    });

  } catch (error) {
    logger.error("Error processing attendance event", error);
    throw error;
  }
}

/**
 * 🔄 MIGRATE DATA TO UNIFIED COLLECTIONS
 * Consolidates all old collection data into attendance_events
 */
exports.migrateToUnifiedCollections = onRequest(async (req, res) => {
  try {
    const { businessId } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: businessId' 
      });
    }

    logger.info("🚀 Starting migration to unified collections", { businessId });
    
    const batch = db.batch();
    let migrationCount = 0;
    const migratedData = {
      fromEmployeeTimesheets: 0,
      fromDeviceEvents: 0,
      fromEmployeeLastAttendance: 0,
      totalEvents: 0
    };

    // 1️⃣ MIGRATE FROM EMPLOYEE_TIMESHEETS
    logger.info("📊 Migrating from employee_timesheets");
    
    const timesheetsRef = db.collection('businesses').doc(businessId).collection('employee_timesheets');
    const employeeTimesheets = await timesheetsRef.get();
    
    for (const empDoc of employeeTimesheets.docs) {
      const employeeId = empDoc.id;
      logger.info(`Processing employee ${employeeId}`);
      
      // Get all daily sheets for this employee
      const dailySheetsRef = empDoc.ref.collection('daily_sheets');
      const dailySheets = await dailySheetsRef.get();
      
      for (const dayDoc of dailySheets.docs) {
        const dayData = dayDoc.data();
        const date = dayData.date;
        
        // Convert clock events to attendance_events format
        if (dayData.clockEvents && Array.isArray(dayData.clockEvents)) {
          dayData.clockEvents.forEach((clockEvent, index) => {
            const eventRef = db.collection('businesses')
              .doc(businessId)
              .collection('attendance_events')
              .doc();
            
            const attendanceStatus = clockEvent.type === 'clock-in' ? 'in' : 'out';
            
            const unifiedEvent = {
              businessId,
              slotNumber: parseInt(employeeId),
              employeeId: employeeId,
              employeeName: dayData.employeeName || `Employee ${employeeId}`,
              timestamp: clockEvent.timestamp,
              attendanceStatus,
              eventDate: date,
              eventTime: clockEvent.time,
              deviceId: 'migrated_from_timesheet',
              deviceName: 'Migrated Data',
              verifyNo: `migrated_${date}_${employeeId}_${index}`,
              source: 'timesheet_migration',
              migratedAt: new Date().toISOString(),
              originalCollection: 'employee_timesheets',
              metadata: {
                workPeriods: dayData.workPeriods || [],
                totalHours: dayData.totalHours || 0,
                overtimeHours: dayData.overtimeHours || 0
              }
            };
            
            batch.set(eventRef, unifiedEvent);
            migrationCount++;
            migratedData.fromEmployeeTimesheets++;
          });
        }
      }
    }

    // 2️⃣ UPDATE STATUS FROM EMPLOYEE_LAST_ATTENDANCE
    logger.info("🏪 Updating status from employee_last_attendance");
    
    const lastAttendanceRef = db.collection('businesses').doc(businessId).collection('employee_last_attendance');
    const lastAttendanceDocs = await lastAttendanceRef.get();
    
    for (const doc of lastAttendanceDocs.docs) {
      const data = doc.data();
      const slotNumber = parseInt(doc.id);
      
      // Update status collection with last known state
      const statusRef = db.collection('businesses')
        .doc(businessId)
        .collection('status')
        .doc(slotNumber.toString());
      
      const statusUpdate = {
        employeeId: slotNumber.toString(),
        employeeName: data.employeeName || `Employee ${slotNumber}`,
        badgeNumber: slotNumber.toString(),
        attendanceStatus: data.currentStatus || 'out',
        lastClockStatus: data.currentStatus || 'out',
        lastClockTime: data.lastEventTime || new Date().toISOString(),
        lastEventType: data.lastEventType || 'checkout',
        updatedAt: new Date().toISOString(),
        migratedFrom: 'employee_last_attendance'
      };
      
      batch.set(statusRef, statusUpdate, { merge: true });
      migratedData.fromEmployeeLastAttendance++;
    }

    // 3️⃣ COMMIT ALL CHANGES
    logger.info(`💾 Committing ${migrationCount} events to attendance_events`);
    
    if (migrationCount > 0) {
      await batch.commit();
      logger.info("✅ Migration batch committed successfully");
    }

    migratedData.totalEvents = migrationCount;
    
    logger.info("✅ Migration completed successfully", migratedData);

    res.json({
      success: true,
      message: '✅ Migration completed successfully',
      summary: {
        businessId,
        fromEmployeeTimesheets: migratedData.fromEmployeeTimesheets,
        fromDeviceEvents: migratedData.fromDeviceEvents,
        statusUpdates: migratedData.fromEmployeeLastAttendance,
        totalEvents: migratedData.totalEvents,
        migratedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("❌ Migration failed", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Migration failed'
    });
  }
});

/**
 * �️ CLEANUP OLD COLLECTIONS
 * Removes old collections that are no longer used in unified architecture
 */
exports.cleanupOldCollections = onRequest(async (req, res) => {
  try {
    const { businessId, confirm } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: businessId' 
      });
    }

    if (confirm !== 'true') {
      return res.status(400).json({ 
        error: 'This is a destructive operation. Add ?confirm=true to proceed.',
        warning: 'This will permanently delete old collections: employee_timesheets, employee_last_attendance, device_*_events'
      });
    }

    logger.info("🗑️ Starting cleanup of old collections", { businessId });
    
    const businessRef = db.collection('businesses').doc(businessId);
    const deletedCollections = [];
    
    try {
      // Get all collections for this business
      const allCollections = await businessRef.listCollections();
      
      // Delete employee_timesheets
      const timesheetsCollection = allCollections.find(col => col.id === 'employee_timesheets');
      if (timesheetsCollection) {
        logger.info("Deleting employee_timesheets collection");
        await deleteCollectionRecursively(timesheetsCollection);
        deletedCollections.push('employee_timesheets');
      }
      
      // Delete employee_last_attendance
      const lastAttendanceCollection = allCollections.find(col => col.id === 'employee_last_attendance');
      if (lastAttendanceCollection) {
        logger.info("Deleting employee_last_attendance collection");
        await deleteCollectionRecursively(lastAttendanceCollection);
        deletedCollections.push('employee_last_attendance');
      }
      
      // Delete device-specific collections (pattern: device_*_events)
      const deviceCollections = allCollections.filter(col => 
        col.id.startsWith('device_') && col.id.endsWith('_events')
      );
      
      for (const deviceCol of deviceCollections) {
        logger.info(`Deleting device collection: ${deviceCol.id}`);
        await deleteCollectionRecursively(deviceCol);
        deletedCollections.push(deviceCol.id);
      }
      
      logger.info("✅ Cleanup completed successfully", { deletedCollections });
      
      res.json({
        success: true,
        message: '✅ Cleanup completed successfully',
        summary: {
          businessId,
          deletedCollections,
          cleanupAt: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error("❌ Cleanup failed", error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        message: 'Cleanup failed'
      });
    }

  } catch (error) {
    logger.error("❌ Cleanup request failed", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Cleanup request failed'
    });
  }
});

/**
 * Helper function to recursively delete a collection and all subcollections
 */
async function deleteCollectionRecursively(collectionRef, batchSize = 100) {
  const query = collectionRef.limit(batchSize);
  
  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();
  
  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }
  
  const batch = db.batch();
  
  for (const doc of snapshot.docs) {
    // Delete any subcollections first
    const subcollections = await doc.ref.listCollections();
    for (const subcol of subcollections) {
      await deleteCollectionRecursively(subcol);
    }
    
    // Then delete the document
    batch.delete(doc.ref);
  }
  
  await batch.commit();
  
  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

/**
 * �🔧 AUTO-SYNC SLOTS ON BUSINESS UPDATE
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

    // ✅ UNIFIED: Status collection handles attendance state tracking
  }

  // REMOVE EXCESS SLOTS (above slotsAllowed, but only if empty)
  const slotsToRemove = [];
  for (const slotNum of currentSlots) {
    if (slotNum > targetSlots) {
      const slotDoc = await staffRef.doc(slotNum.toString()).get();
      const slotData = slotDoc.data();
      
      // Check status collection to see if someone is currently clocked in
      const statusDoc = await businessRef.collection('status').doc(slotNum.toString()).get();
      const statusData = statusDoc.exists ? statusDoc.data() : null;
      const isCurrentlyIn = statusData && (statusData.currentStatus === 'in' || statusData.attendanceStatus === 'in');
      
      // Only remove if slot is not currently in use (not clocked in)
      if (!isCurrentlyIn && !slotData.isActive && !slotData.active) {
        slotsToRemove.push(slotNum);
      }
    }
  }

  // Remove excess empty slots and their related documents
  for (const slotNum of slotsToRemove) {
    // Delete staff slot
    await staffRef.doc(slotNum.toString()).delete();
    
    // Delete status slot
    await businessRef.collection('status').doc(slotNum.toString()).delete();
    
    // ✅ UNIFIED: Status collection handles attendance state tracking
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

/**
 * Send daily update WhatsApp on clock-out
 */
async function sendDailyUpdateWhatsApp(businessId, employeeId, employeeName, currentDate) {
  try {
    // Get WhatsApp settings
    const settingsRef = db.collection('businesses').doc(businessId).collection('settings').doc('whatsapp');
    const settingsDoc = await settingsRef.get();

    if (!settingsDoc.exists || !settingsDoc.data().enabled) {
      logger.info("WhatsApp not enabled for business", { businessId });
      return;
    }

    const settings = settingsDoc.data();

    // Get employee phone number from staff collection
    const staffRef = db.collection('businesses').doc(businessId).collection('staff').doc(employeeId);
    const staffDoc = await staffRef.get();
    
    if (!staffDoc.exists || !staffDoc.data().phone) {
      logger.warn("Employee phone number not found", { businessId, employeeId });
      return;
    }

    const employeePhone = staffDoc.data().phone;
    const hourlyRate = staffDoc.data().hourlyRate || 0;

    // Get business settings for required hours
    const businessRef = db.collection('businesses').doc(businessId);
    const businessDoc = await businessRef.get();
    const businessData = businessDoc.data();
    
    // Calculate required hours per month (default: 8 hours/day × working days)
    const workingDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    let daysPerWeek = 0;
    workingDays.forEach(day => {
      if (businessData[day] === true) daysPerWeek++;
    });
    const weeksInMonth = 4.33; // Average
    const requiredHoursPerMonth = Math.round(8 * daysPerWeek * weeksInMonth);

    // Calculate past due hours (days passed this month × 8 hours)
    const today = new Date();
    const dayOfMonth = today.getDate();
    const pastDueHours = Math.round(dayOfMonth * 8 * (daysPerWeek / 7));

    // Get all timesheets for current month
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${year}-${month}`;

    const timesheetsRef = db.collection('businesses')
      .doc(businessId)
      .collection('employee_timesheets')
      .doc(employeeId)
      .collection('daily_sheets');
    
    const timesheetsSnap = await timesheetsRef
      .where('date', '>=', `${monthPrefix}-01`)
      .where('date', '<=', `${monthPrefix}-31`)
      .get();

    // Calculate total hours worked this month
    let totalHoursWorked = 0;
    timesheetsSnap.forEach(doc => {
      totalHoursWorked += doc.data().totalHours || 0;
    });
    totalHoursWorked = Math.round(totalHoursWorked * 100) / 100;

    // Calculate lost hours
    const lostHours = Math.max(0, pastDueHours - totalHoursWorked);

    // Calculate earnings
    const earnings = Math.round(totalHoursWorked * hourlyRate);
    const currency = businessData.currency || 'R';

    // Generate timecard link (using business dashboard + employee ID)
    const timecardLink = `https://aiclock-82608.web.app/pages/business-dashboard.html?view=timecard&employee=${employeeId}`;

    // Get template for clock-out trigger
    const templatesRef = db.collection('businesses').doc(businessId).collection('whatsapp_templates');
    const templatesSnap = await templatesRef.where('trigger', '==', 'clock-out').where('active', '==', true).get();

    if (templatesSnap.empty) {
      logger.info("No active clock-out template found", { businessId });
      return;
    }

    const template = templatesSnap.docs[0].data();
    let message = template.message;

    // Replace variables - support both {{name}} and {{1}} formats
    message = message.replace(/\{\{employeeName\}\}/g, employeeName || 'Employee');
    message = message.replace(/\{\{1\}\}/g, employeeName || 'Employee');
    message = message.replace(/\{\{2\}\}/g, requiredHoursPerMonth.toString());
    message = message.replace(/\{\{3\}\}/g, pastDueHours.toString());
    message = message.replace(/\{\{4\}\}/g, totalHoursWorked.toString());
    message = message.replace(/\{\{5\}\}/g, lostHours.toString());
    message = message.replace(/\{\{6\}\}/g, timecardLink);
    message = message.replace(/\{\{7\}\}/g, `${currency}${earnings}`);
    message = message.replace(/\{\{time\}\}/g, new Date().toLocaleTimeString());
    message = message.replace(/\{\{date\}\}/g, new Date().toLocaleDateString());

    // Send message based on provider
    if (settings.apiProvider === 'twilio') {
      await sendViaTwilio(settings, employeePhone, message);
    } else if (settings.apiProvider === 'cloud-api') {
      await sendViaWhatsAppBusiness(settings, employeePhone, message);
    } else if (settings.apiProvider === '360dialog') {
      await sendVia360Dialog(settings, employeePhone, message);
    } else if (settings.apiProvider === 'wati') {
      await sendViaWati(settings, employeePhone, message);
    } else {
      await sendViaGenericAPI(settings, employeePhone, message);
    }

    logger.info("Daily update WhatsApp sent successfully", { 
      businessId, 
      employeeId,
      employeeName,
      hoursWorked: totalHoursWorked,
      earnings 
    });

  } catch (error) {
    logger.error("Error sending daily update WhatsApp", { 
      error: error.message,
      businessId,
      employeeId 
    });
    throw error;
  }
}

/**
 * 📱 WHATSAPP MESSAGE SENDER
 * Send WhatsApp messages based on templates and triggers
 */
exports.sendWhatsAppMessage = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { businessId, trigger, employeeData } = req.body;

    if (!businessId || !trigger) {
      throw new Error('Missing required fields: businessId and trigger');
    }

    logger.info("WhatsApp message request", { businessId, trigger, employeeData });

    // Get WhatsApp settings
    const settingsRef = db.collection('businesses').doc(businessId).collection('settings').doc('whatsapp');
    const settingsDoc = await settingsRef.get();

    if (!settingsDoc.exists || !settingsDoc.data().enabled) {
      logger.info("WhatsApp not enabled for business", { businessId });
      res.json({ success: true, message: 'WhatsApp not enabled' });
      return;
    }

    const settings = settingsDoc.data();

    // Get active templates for this trigger
    const templatesRef = db.collection('businesses').doc(businessId).collection('whatsapp_templates');
    const templatesSnap = await templatesRef.where('trigger', '==', trigger).where('active', '==', true).get();

    if (templatesSnap.empty) {
      logger.info("No active templates for trigger", { businessId, trigger });
      res.json({ success: true, message: 'No active templates' });
      return;
    }

    const messages = [];

    for (const templateDoc of templatesSnap.docs) {
      const template = templateDoc.data();
      
      // Replace variables in message
      let message = template.message;
      message = message.replace(/\{\{employeeName\}\}/g, employeeData.employeeName || 'Employee');
      message = message.replace(/\{\{employeeId\}\}/g, employeeData.employeeId || '');
      message = message.replace(/\{\{time\}\}/g, new Date().toLocaleTimeString());
      message = message.replace(/\{\{date\}\}/g, new Date().toLocaleDateString());
      message = message.replace(/\{\{businessName\}\}/g, employeeData.businessName || 'Your Business');
      message = message.replace(/\{\{status\}\}/g, employeeData.status || '');
      message = message.replace(/\{\{hoursWorked\}\}/g, employeeData.hoursWorked || '');
      message = message.replace(/\{\{daysWorked\}\}/g, employeeData.daysWorked || '');

      // Determine recipient phone number
      let toNumbers = [];
      if (template.recipient === 'employee' || template.recipient === 'both') {
        if (employeeData.phone) {
          toNumbers.push(employeeData.phone);
        }
      }
      if (template.recipient === 'manager' || template.recipient === 'both') {
        // Get business owner/manager phone
        const businessDoc = await db.collection('businesses').doc(businessId).get();
        if (businessDoc.exists && businessDoc.data().phone) {
          toNumbers.push(businessDoc.data().phone);
        }
      }

      // Send messages via WhatsApp API
      for (const toNumber of toNumbers) {
        try {
          // Different API implementations based on provider
          if (settings.apiProvider === 'twilio') {
            await sendViaTwilio(settings, toNumber, message);
          } else if (settings.apiProvider === 'whatsapp-business') {
            await sendViaWhatsAppBusiness(settings, toNumber, message);
          } else if (settings.apiProvider === '360dialog') {
            await sendVia360Dialog(settings, toNumber, message);
          } else if (settings.apiProvider === 'wati') {
            await sendViaWati(settings, toNumber, message);
          } else {
            // Generic HTTP API call
            await sendViaGenericAPI(settings, toNumber, message);
          }

          messages.push({ to: toNumber, message, status: 'sent' });
          logger.info("WhatsApp message sent", { businessId, toNumber, trigger });
        } catch (error) {
          logger.error("Error sending WhatsApp message", { error: error.message, toNumber });
          messages.push({ to: toNumber, message, status: 'failed', error: error.message });
        }
      }
    }

    res.json({
      success: true,
      messagesSent: messages.length,
      messages
    });

  } catch (error) {
    logger.error("Error in sendWhatsAppMessage", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions for different WhatsApp API providers
async function sendViaTwilio(settings, toNumber, message) {
  const https = require('https');
  const querystring = require('querystring');
  
  const auth = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
  const postData = querystring.stringify({
    From: `whatsapp:${settings.fromNumber}`,
    To: `whatsapp:${toNumber}`,
    Body: message
  });

  const options = {
    hostname: 'api.twilio.com',
    port: 443,
    path: `/2010-04-01/Accounts/${settings.apiKey}/Messages.json`,
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Twilio API error: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sendViaWhatsAppBusiness(settings, toNumber, message) {
  const https = require('https');
  
  const postData = JSON.stringify({
    messaging_product: 'whatsapp',
    to: toNumber.replace(/\+/g, ''),
    type: 'text',
    text: { body: message }
  });

  // Use Cloud API specific fields
  const phoneNumberId = settings.cloudPhoneNumberId || settings.fromNumber;
  const accessToken = settings.cloudAccessToken || settings.apiKey;

  const options = {
    hostname: 'graph.facebook.com',
    port: 443,
    path: `/v18.0/${phoneNumberId}/messages`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`WhatsApp Cloud API error: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sendVia360Dialog(settings, toNumber, message) {
  const https = require('https');
  
  const postData = JSON.stringify({
    to: toNumber,
    type: 'text',
    text: { body: message }
  });

  const options = {
    hostname: 'waba.360dialog.io',
    port: 443,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'D360-API-KEY': settings.apiKey,
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`360Dialog API error: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sendViaWati(settings, toNumber, message) {
  const https = require('https');
  
  const postData = JSON.stringify({
    whatsappNumber: toNumber.replace(/\+/g, ''),
    text: message
  });

  const endpoint = settings.apiEndpoint || 'live-server-9619.wati.io';
  const options = {
    hostname: endpoint.replace('https://', '').replace('http://', ''),
    port: 443,
    path: '/api/v1/sendSessionMessage',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Wati API error: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sendViaGenericAPI(settings, toNumber, message) {
  if (!settings.apiEndpoint) {
    throw new Error('API endpoint required for generic provider');
  }

  const https = require('https');
  const url = new URL(settings.apiEndpoint);
  
  const postData = JSON.stringify({
    to: toNumber,
    message: message,
    from: settings.fromNumber
  });

  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve({ status: 'sent' });
        } else {
          reject(new Error(`API error: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * 🎯 UPDATE BUSINESS PLAN LIMITS
 * HTTP endpoint to update business plan and employee limits
 */
exports.updateBusinessPlan = onRequest(async (req, res) => {
  try {
    const { businessId, plan, maxEmployees } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ 
        error: 'businessId is required',
        example: '/updateBusinessPlan?businessId=biz_machine_2&plan=Premium&maxEmployees=30'
      });
    }

    const validPlans = ['Basic', 'Standard', 'Professional', 'Premium', 'Enterprise'];
    const planName = plan || 'Professional';
    const employeeLimit = maxEmployees ? parseInt(maxEmployees) : null;
    
    if (!validPlans.includes(planName)) {
      return res.status(400).json({ 
        error: 'Invalid plan',
        validPlans,
        providedPlan: planName
      });
    }

    logger.info("Updating business plan", { businessId, planName, employeeLimit });

    const businessRef = db.collection('businesses').doc(businessId);
    const updateData = {
      plan: planName,
      planUpdatedAt: new Date().toISOString()
    };
    
    if (employeeLimit !== null) {
      updateData.maxEmployees = employeeLimit;
    }
    
    await businessRef.update(updateData);

    // Get updated business data to return
    const updatedDoc = await businessRef.get();
    const updatedData = updatedDoc.data();

    res.json({
      success: true,
      message: `Business plan updated successfully`,
      businessId,
      plan: updatedData.plan,
      maxEmployees: updatedData.maxEmployees,
      planUpdatedAt: updatedData.planUpdatedAt
    });

  } catch (error) {
    logger.error("Business plan update failed", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 🔍 CHECK BUSINESS SETTINGS
 * Shows actual business document settings vs created slots
 */
exports.checkBusinessSettings = onRequest(async (req, res) => {
  try {
    const { businessId } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ error: 'Missing businessId' });
    }

    const businessRef = db.collection('businesses').doc(businessId);
    const businessDoc = await businessRef.get();
    
    if (!businessDoc.exists) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    const businessData = businessDoc.data();
    
    // Count actual slots created
    const staffRef = businessRef.collection('staff');
    const staffDocs = await staffRef.get();
    const actualSlots = staffDocs.size;
    
    const statusRef = businessRef.collection('status');
    const statusDocs = await statusRef.get();
    const statusSlots = statusDocs.size;
    
    const report = {
      businessId,
      businessDocument: {
        slotsAllowed: businessData.slotsAllowed,
        plan: businessData.plan,
        maxEmployees: businessData.maxEmployees
      },
      actualCollections: {
        staffSlots: actualSlots,
        statusSlots: statusSlots
      },
      discrepancy: {
        shouldHave: businessData.slotsAllowed || businessData.maxEmployees,
        actuallyHas: actualSlots
      }
    };
    
    res.json({
      success: true,
      message: 'Business settings check completed',
      report
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 🔧 FIX SLOT COUNT
 * Syncs slot count with actual business admin setting
 */
exports.fixSlotCount = onRequest(async (req, res) => {
  try {
    const { businessId } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ error: 'Missing businessId' });
    }

    const businessRef = db.collection('businesses').doc(businessId);
    const businessDoc = await businessRef.get();
    
    if (!businessDoc.exists) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    const businessData = businessDoc.data();
    
    // Get the ACTUAL slot count from admin settings
    const correctSlotCount = businessData.slotsAllowed || businessData.maxEmployees || 5;
    
    logger.info(`Fixing slot count for ${businessId} to ${correctSlotCount} slots`);
    
    // Get current collections
    const staffRef = businessRef.collection('staff');
    const statusRef = businessRef.collection('status');
    
    const staffDocs = await staffRef.get();
    const statusDocs = await statusRef.get();
    
    const currentStaffSlots = staffDocs.size;
    const currentStatusSlots = statusDocs.size;
    
    // If we have too many slots, remove excess
    if (currentStaffSlots > correctSlotCount) {
      const batch = db.batch();
      for (let i = correctSlotCount + 1; i <= currentStaffSlots; i++) {
        batch.delete(staffRef.doc(i.toString()));
        batch.delete(statusRef.doc(i.toString()));
      }
      await batch.commit();
      logger.info(`Removed ${currentStaffSlots - correctSlotCount} excess slots`);
    }
    
    // If we have too few slots, add missing ones
    if (currentStaffSlots < correctSlotCount) {
      const batch = db.batch();
      for (let i = currentStaffSlots + 1; i <= correctSlotCount; i++) {
        // Add staff slot
        batch.set(staffRef.doc(i.toString()), {
          employeeId: i.toString(),
          employeeName: `Employee ${i}`,
          active: false,
          slotNumber: i,
          badgeNumber: i.toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deviceId: "",
          phone: "",
          email: ""
        });
        
        // Add status slot
        batch.set(statusRef.doc(i.toString()), {
          employeeId: i.toString(),
          employeeName: `Employee ${i}`,
          badgeNumber: i.toString(),
          attendanceStatus: 'out',
          lastClockStatus: 'out',
          lastClockTime: new Date().toISOString(),
          lastEventType: 'checkout',
          isActive: false,
          slotNumber: i,
          updatedAt: new Date().toISOString(),
          deviceId: ""
        });
      }
      await batch.commit();
      logger.info(`Added ${correctSlotCount - currentStaffSlots} missing slots`);
    }
    
    res.json({
      success: true,
      message: `Slot count fixed for ${businessId}`,
      summary: {
        businessId,
        correctSlotCount,
        previousStaffSlots: currentStaffSlots,
        previousStatusSlots: currentStatusSlots,
        action: currentStaffSlots > correctSlotCount ? 'removed_excess' : 
                currentStaffSlots < correctSlotCount ? 'added_missing' : 'already_correct'
      }
    });

  } catch (error) {
    logger.error("❌ Fix slot count failed", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 🏗️ SETUP UNIFIED STRUCTURE FOR ALL BUSINESSES
 * Creates the correct collections for existing and new businesses
 */
exports.setupUnifiedStructure = onRequest(async (req, res) => {
  try {
    logger.info("🏗️ Setting up unified structure for all businesses");
    
    const businessesRef = db.collection('businesses');
    const businesses = await businessesRef.get();
    
    const setupResults = [];
    let totalBusinesses = 0;
    
    for (const businessDoc of businesses.docs) {
      const businessId = businessDoc.id;
      const businessData = businessDoc.data();
      totalBusinesses++;
      
      logger.info(`Setting up unified structure for: ${businessId}`);
      
      // Get plan info for slot limits
      const planName = businessData.plan || 'Basic';
      const planLimits = {
        'Basic': 5,
        'Standard': 10, 
        'Professional': 20,
        'Premium': 30,
        'Enterprise': 50
      };
      const maxEmployees = planLimits[planName] || 5;
      
      // 1️⃣ CREATE STAFF COLLECTION (Employee Management)
      const staffRef = businessDoc.ref.collection('staff');
      for (let i = 1; i <= maxEmployees; i++) {
        await staffRef.doc(i.toString()).set({
          employeeId: i.toString(),
          employeeName: `Employee ${i}`,
          active: false,
          slotNumber: i,
          badgeNumber: i.toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deviceId: "",
          phone: "",
          email: ""
        });
      }
      
      // 2️⃣ CREATE STATUS COLLECTION (Real-time Monitoring)  
      const statusRef = businessDoc.ref.collection('status');
      for (let i = 1; i <= maxEmployees; i++) {
        await statusRef.doc(i.toString()).set({
          employeeId: i.toString(),
          employeeName: `Employee ${i}`,
          badgeNumber: i.toString(),
          attendanceStatus: 'out',
          lastClockStatus: 'out',
          lastClockTime: new Date().toISOString(),
          lastEventType: 'checkout',
          isActive: false,
          slotNumber: i,
          updatedAt: new Date().toISOString(),
          deviceId: ""
        });
      }
      
      // 3️⃣ CREATE ATTENDANCE_EVENTS COLLECTION (Unified Data Storage)
      // This will be populated by new attendance events - no placeholder needed
      
      setupResults.push({
        businessId: businessId,
        plan: planName,
        maxEmployees: maxEmployees,
        collectionsCreated: ['staff', 'status', 'attendance_events'],
        slotsCreated: maxEmployees
      });
      
      logger.info(`✅ Setup completed for ${businessId}: ${planName} plan with ${maxEmployees} slots`);
    }
    
    logger.info("🏗️ Unified structure setup completed for all businesses", { 
      totalBusinesses,
      setupResults: setupResults.length
    });
    
    res.json({
      success: true,
      message: '🏗️ Unified structure setup completed for all businesses',
      summary: {
        totalBusinesses,
        structure: ['staff', 'status', 'attendance_events'],
        setupResults
      }
    });

  } catch (error) {
    logger.error("❌ Unified structure setup failed", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Unified structure setup failed'
    });
  }
});

/**
 * 🧹 NUCLEAR CLEANUP - DELETE ALL COLLECTIONS FROM ALL BUSINESSES
 */
exports.nuclearCleanup = onRequest(async (req, res) => {
  try {
    const { confirm } = req.query;
    
    if (confirm !== 'NUCLEAR_CLEANUP_CONFIRMED') {
      return res.status(400).json({ 
        error: 'This will DELETE ALL COLLECTIONS from ALL BUSINESSES. Use ?confirm=NUCLEAR_CLEANUP_CONFIRMED',
        warning: 'THIS IS IRREVERSIBLE!'
      });
    }

    logger.info("🧹 NUCLEAR CLEANUP STARTING - DELETING ALL COLLECTIONS");
    
    const businessesRef = db.collection('businesses');
    const businesses = await businessesRef.get();
    
    const deletedItems = [];
    let totalBusinesses = 0;
    let totalCollections = 0;
    
    for (const businessDoc of businesses.docs) {
      const businessId = businessDoc.id;
      totalBusinesses++;
      
      logger.info(`Processing business: ${businessId}`);
      
      // Get all collections for this business
      const allCollections = await businessDoc.ref.listCollections();
      
      for (const collection of allCollections) {
        const collectionName = collection.id;
        totalCollections++;
        
        logger.info(`  Deleting collection: ${collectionName}`);
        
        // Delete all documents in collection
        const docs = await collection.get();
        if (docs.size > 0) {
          const batch = db.batch();
          docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
        
        deletedItems.push(`${businessId}/${collectionName} (${docs.size} docs)`);
      }
    }
    
    logger.info("🧹 NUCLEAR CLEANUP COMPLETED", { 
      totalBusinesses, 
      totalCollections,
      deletedItems: deletedItems.length 
    });
    
    res.json({
      success: true,
      message: '🧹 NUCLEAR CLEANUP COMPLETED - All collections deleted',
      summary: {
        totalBusinesses,
        totalCollections,
        deletedItems: deletedItems.slice(0, 20), // Show first 20
        totalDeleted: deletedItems.length
      }
    });

  } catch (error) {
    logger.error("❌ Nuclear cleanup failed", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Nuclear cleanup failed'
    });
  }
});

/**
 * 🏗️ RECREATE UNIFIED ARCHITECTURE FOR ALL BUSINESSES
 */
exports.recreateUnifiedArchitecture = onRequest(async (req, res) => {
  try {
    const { confirm } = req.query;
    
    if (confirm !== 'RECREATE_CONFIRMED') {
      return res.status(400).json({ 
        error: 'Use ?confirm=RECREATE_CONFIRMED to recreate collections'
      });
    }

    logger.info("🏗️ RECREATING UNIFIED ARCHITECTURE FOR ALL BUSINESSES");
    
    const businessesRef = db.collection('businesses');
    const businesses = await businessesRef.get();
    
    const recreatedItems = [];
    let totalBusinesses = 0;
    
    for (const businessDoc of businesses.docs) {
      const businessId = businessDoc.id;
      const businessData = businessDoc.data();
      totalBusinesses++;
      
      logger.info(`Recreating collections for: ${businessId}`);
      
      // Get plan info
      const planName = businessData.plan || 'Basic';
      const planLimits = {
        'Basic': 5,
        'Standard': 10, 
        'Professional': 20,
        'Premium': 30,
        'Enterprise': 50
      };
      const maxEmployees = planLimits[planName] || 5;
      
      // 1. Create STAFF collection (employee management)
      const staffRef = businessDoc.ref.collection('staff');
      for (let i = 1; i <= maxEmployees; i++) {
        await staffRef.doc(i.toString()).set({
          employeeId: i.toString(),
          employeeName: `Employee ${i}`,
          active: false,
          slotNumber: i,
          badgeNumber: i.toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deviceId: ""
        });
      }
      
      // 2. Create STATUS collection (real-time monitoring)  
      const statusRef = businessDoc.ref.collection('status');
      for (let i = 1; i <= maxEmployees; i++) {
        await statusRef.doc(i.toString()).set({
          employeeId: i.toString(),
          employeeName: `Employee ${i}`,
          badgeNumber: i.toString(),
          attendanceStatus: 'out',
          lastClockStatus: 'out',
          lastClockTime: new Date().toISOString(),
          lastEventType: 'checkout',
          isActive: false,
          slotNumber: i,
          updatedAt: new Date().toISOString(),
          deviceId: ""
        });
      }
      
      // 3. Create ATTENDANCE_EVENTS collection (unified data storage)
      const attendanceRef = businessDoc.ref.collection('attendance_events');
      // Create a ready marker without reserved name
      await attendanceRef.doc('ready_marker').set({
        message: 'Attendance events collection ready for unified architecture',
        businessId: businessId,
        maxEmployees: maxEmployees,
        plan: planName,
        createdAt: new Date().toISOString(),
        structure: 'unified_architecture_v1'
      });
      
      recreatedItems.push(`${businessId}: staff(${maxEmployees}), status(${maxEmployees}), attendance_events`);
    }
    
    logger.info("🏗️ UNIFIED ARCHITECTURE RECREATION COMPLETED", { 
      totalBusinesses,
      recreatedItems: recreatedItems.length
    });
    
    res.json({
      success: true,
      message: '🏗️ UNIFIED ARCHITECTURE RECREATED FOR ALL BUSINESSES',
      summary: {
        totalBusinesses,
        collectionsPerBusiness: ['staff', 'status', 'attendance_events'],
        recreatedItems
      }
    });

  } catch (error) {
    logger.error("❌ Architecture recreation failed", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Architecture recreation failed'
    });
  }
});

/**
 * 🔍 DEEP INSPECTION - Shows REAL nested structure 
 */
exports.deepInspection = onRequest(async (req, res) => {
  try {
    const { businessId } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ error: 'Missing businessId' });
    }

    const businessRef = db.collection('businesses').doc(businessId);
    const report = {
      businessId,
      timestamp: new Date().toISOString(),
      collections: {},
      nestedStructures: {}
    };

    // Get all top-level collections
    const allCollections = await businessRef.listCollections();
    
    for (const collection of allCollections) {
      const collectionName = collection.id;
      const docs = await collection.get();
      
      report.collections[collectionName] = {
        documentCount: docs.size,
        sampleDocuments: []
      };

      // Check each document for subcollections (nested structure)
      let docCount = 0;
      for (const doc of docs.docs) {
        if (docCount < 5) { // Sample first 5 docs
          const docData = doc.data();
          const subcollections = await doc.ref.listCollections();
          
          const docInfo = {
            docId: doc.id,
            hasData: Object.keys(docData).length > 0,
            subcollections: subcollections.map(sub => sub.id)
          };

          // If this doc has subcollections, dive deeper
          if (subcollections.length > 0) {
            docInfo.nestedData = {};
            for (const subcol of subcollections) {
              const subDocs = await subcol.get();
              docInfo.nestedData[subcol.id] = {
                count: subDocs.size,
                sampleIds: subDocs.docs.slice(0, 3).map(d => d.id)
              };
            }
          }
          
          report.collections[collectionName].sampleDocuments.push(docInfo);
          docCount++;
        }
      }
    }

    // Specifically check attendance_events structure
    const attendanceRef = businessRef.collection('attendance_events');
    const attendanceDocs = await attendanceRef.get();
    
    report.attendanceEventsStructure = {
      topLevelDocs: attendanceDocs.size,
      structure: []
    };
    
    // Check first few attendance docs for nested structure
    for (let i = 0; i < Math.min(5, attendanceDocs.size); i++) {
      const doc = attendanceDocs.docs[i];
      const subcollections = await doc.ref.listCollections();
      
      if (subcollections.length > 0) {
        const structureInfo = {
          docId: doc.id,
          subcollections: []
        };
        
        for (const subcol of subcollections) {
          const subDocs = await subcol.get();
          structureInfo.subcollections.push({
            name: subcol.id,
            count: subDocs.size
          });
        }
        
        report.attendanceEventsStructure.structure.push(structureInfo);
      }
    }

    res.json({
      success: true,
      message: 'Deep inspection completed - showing REAL structure',
      report: report
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 🔍 INSPECT DATABASE STATE
 * Shows current state of all collections for debugging
 */
exports.inspectDatabaseState = onRequest(async (req, res) => {
  try {
    const { businessId } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: businessId' 
      });
    }

    logger.info("🔍 Inspecting database state", { businessId });
    
    const businessRef = db.collection('businesses').doc(businessId);
    const report = {
      businessId,
      timestamp: new Date().toISOString(),
      collections: {}
    };

    // Get all collections for this business
    const allCollections = await businessRef.listCollections();
    
    for (const collection of allCollections) {
      const collectionName = collection.id;
      const docs = await collection.get();
      
      report.collections[collectionName] = {
        exists: true,
        documentCount: docs.size,
        sampleDocs: []
      };

      // Sample first 3 documents
      let count = 0;
      docs.forEach(doc => {
        if (count < 3) {
          const data = doc.data();
          report.collections[collectionName].sampleDocs.push({
            id: doc.id,
            hasTimestamp: !!(data.timestamp || data.lastUpdate || data.createdAt)
          });
          count++;
        }
      });
    }

    // Check attendance_events specifically
    try {
      const attendanceEventsRef = businessRef.collection('attendance_events');
      const attendanceEventsDocs = await attendanceEventsRef.limit(10).get();
      
      report.attendanceEventsDetails = {
        totalCount: attendanceEventsDocs.size,
        hasEvents: attendanceEventsDocs.size > 0
      };
    } catch (e) {
      report.attendanceEventsDetails = { error: e.message };
    }

    logger.info("Database inspection completed", { 
      collectionsFound: Object.keys(report.collections),
      attendanceEventsCount: report.attendanceEventsDetails?.totalCount || 0
    });

    res.json({
      success: true,
      summary: `Found ${Object.keys(report.collections).length} collections, ${report.attendanceEventsDetails?.totalCount || 0} attendance events`,
      collectionsPresent: Object.keys(report.collections),
      attendanceEventsCount: report.attendanceEventsDetails?.totalCount || 0,
      fullReport: report
    });

  } catch (error) {
    logger.error("❌ Inspection failed", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Inspection failed'
    });
  }
});

/**
 * Hard Reset Business Data - Admin Tool
 * Completely wipes and recreates a business's data with clean structure
 */
exports.hardResetBusinessData = onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Only POST method allowed' });
    return;
  }

  const { businessId, adminKey } = req.body;

  // Basic admin authentication
  if (adminKey !== 'Azam198419880001#') {
    logger.warn("❌ Unauthorized hard reset attempt", { businessId });
    res.status(403).json({ success: false, error: 'Unauthorized access' });
    return;
  }

  if (!businessId) {
    res.status(400).json({ success: false, error: 'Business ID is required' });
    return;
  }

  try {
    logger.info(`🔄 Starting hard reset for business: ${businessId}`);
    
    // Step 1: Get business document to preserve essential settings
    const businessRef = db.collection('businesses').doc(businessId);
    const businessDoc = await businessRef.get();
    
    if (!businessDoc.exists) {
      res.status(404).json({ success: false, error: 'Business not found' });
      return;
    }

    const businessData = businessDoc.data();
    const slotsAllowed = businessData.slotsAllowed || 10;
    
    logger.info(`📊 Business has ${slotsAllowed} slots allowed`);

    // Step 2: Nuclear cleanup - Delete ALL subcollections
    const collectionsToClean = ['staff', 'status', 'attendance_events', 'employees', 'timecards', 'timecard_data', 'employee_status'];
    let deletedCount = 0;

    for (const collectionName of collectionsToClean) {
      const collectionRef = businessRef.collection(collectionName);
      const snapshot = await collectionRef.get();
      
      for (const doc of snapshot.docs) {
        await doc.ref.delete();
        deletedCount++;
      }
      
      logger.info(`🗑️ Deleted ${snapshot.size} documents from ${collectionName}`);
    }

    // Step 3: Create clean unified structure
    const staffBatch = db.batch();
    const statusBatch = db.batch();
    
    for (let slot = 1; slot <= slotsAllowed; slot++) {
      // Create clean staff record
      const staffRef = businessRef.collection('staff').doc(slot.toString());
      staffBatch.set(staffRef, {
        slot: slot,
        employeeId: slot,
        employeeName: `Employee ${slot}`,
        badgeNumber: slot.toString(),
        active: true,
        phone: null,
        email: null,
        position: null,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });

      // Create clean status record
      const statusRef = businessRef.collection('status').doc(slot.toString());
      statusBatch.set(statusRef, {
        employeeId: slot,
        attendanceStatus: 'unknown',
        lastClockTime: null,
        lastClockType: null,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }

    // Commit batches
    await staffBatch.commit();
    await statusBatch.commit();

    // Step 4: Update business document timestamp
    await businessRef.update({
      lastHardReset: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });

    const summary = {
      businessId,
      slotsRecreated: slotsAllowed,
      documentsDeleted: deletedCount,
      collectionsProcessed: collectionsToClean,
      resetTimestamp: new Date().toISOString()
    };

    logger.info("✅ Hard reset completed successfully", summary);
    
    res.json({
      success: true,
      message: `Hard reset completed for ${businessId}`,
      summary
    });

  } catch (error) {
    logger.error("❌ Hard reset failed", { businessId, error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Hard reset operation failed'
    });
  }
});

/**
 * Restore Point Function - Reset All Businesses to Clean State
 * Creates blank employee slots for all businesses based on their slotsAllowed setting
 */
exports.restoreCleanDatabase = onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Only POST method allowed' });
    return;
  }

  const { adminKey } = req.body;

  // Admin authentication
  if (adminKey !== 'Azam198419880001#') {
    logger.warn("❌ Unauthorized restore attempt");
    res.status(403).json({ success: false, error: 'Unauthorized access' });
    return;
  }

  try {
    logger.info('🔄 Starting database restore to clean state');
    
    // Get all businesses
    const businessesRef = db.collection('businesses');
    const businessesSnap = await businessesRef.get();
    
    const results = [];
    
    for (const businessDoc of businessesSnap.docs) {
      const businessId = businessDoc.id;
      const businessData = businessDoc.data();
      const slotsAllowed = businessData.slotsAllowed || 10;
      
      logger.info(`🧹 Cleaning business: ${businessId} (${slotsAllowed} slots)`);
      
      // Delete all subcollections
      const collectionsToClean = ['staff', 'status', 'attendance_events', 'employees', 'timecards', 'timecard_data', 'employee_status'];
      let deletedCount = 0;

      for (const collectionName of collectionsToClean) {
        const collectionRef = businessDoc.ref.collection(collectionName);
        const snapshot = await collectionRef.get();
        
        for (const doc of snapshot.docs) {
          await doc.ref.delete();
          deletedCount++;
        }
      }

      // Create clean blank slots
      const staffBatch = db.batch();
      const statusBatch = db.batch();
      
      for (let slot = 1; slot <= slotsAllowed; slot++) {
        // Create blank staff record
        const staffRef = businessDoc.ref.collection('staff').doc(slot.toString());
        staffBatch.set(staffRef, {
          slot: slot,
          employeeId: slot,
          employeeName: `Employee ${slot}`,
          badgeNumber: slot.toString(),
          active: true,
          phone: null,
          email: null,
          position: null,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });

        // Create blank status record
        const statusRef = businessDoc.ref.collection('status').doc(slot.toString());
        statusBatch.set(statusRef, {
          employeeId: slot,
          attendanceStatus: 'unknown',
          lastClockTime: null,
          lastClockType: null,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }

      await staffBatch.commit();
      await statusBatch.commit();

      // Update business document
      await businessDoc.ref.update({
        lastRestorePoint: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });

      results.push({
        businessId,
        slotsCreated: slotsAllowed,
        documentsDeleted: deletedCount
      });
    }

    const summary = {
      businessesProcessed: results.length,
      totalSlotsCreated: results.reduce((sum, r) => sum + r.slotsCreated, 0),
      totalDocumentsDeleted: results.reduce((sum, r) => sum + r.documentsDeleted, 0),
      restoreTimestamp: new Date().toISOString()
    };

    logger.info("✅ Database restore completed successfully", summary);
    
    res.json({
      success: true,
      message: 'Database restored to clean state with blank slots',
      summary,
      businessResults: results
    });

  } catch (error) {
    logger.error("❌ Database restore failed", { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Database restore operation failed'
    });
  }
});

/**
 * Check what device IDs are actually being received by webhooks
 */
exports.inspectWebhookData = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    logger.info("📊 WEBHOOK INSPECTION", { 
      method: req.method, 
      headers: req.headers,
      contentType: req.get('content-type'),
      query: req.query,
      body: req.body,
      rawBody: req.rawBody ? req.rawBody.toString('utf8', 0, 200) : null
    });
    
    res.json({
      success: true,
      message: "Webhook data logged",
      timestamp: new Date().toISOString(),
      method: req.method,
      contentType: req.get('content-type'),
      hasRawBody: !!req.rawBody,
      bodySize: req.rawBody ? req.rawBody.length : 0
    });

  } catch (error) {
    logger.error("Webhook inspection error", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 📊 ASSESSMENT CACHE UPDATER
 * Triggers assessment calculation when attendance events change
 * Called automatically on clock-in/out or manually via HTTP request
 */
exports.updateAssessmentCache = onRequest({ invoker: 'public' }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { businessId, month, requiredHours } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: businessId',
        usage: '/updateAssessmentCache?businessId=biz_machine_2&month=2026-02&requiredHours=176'
      });
    }

    const targetMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM format
    const requiredHoursPerMonth = requiredHours ? parseInt(requiredHours) : 176;
    
    logger.info("📊 Updating assessment cache", { businessId, targetMonth, requiredHoursPerMonth });
    
    const result = await calculateAndCacheAssessment(businessId, targetMonth, requiredHoursPerMonth);
    
    res.json({
      success: true,
      message: 'Assessment cache updated successfully',
      businessId,
      month: targetMonth,
      requiredHours: requiredHoursPerMonth,
      ...result
    });

  } catch (error) {
    logger.error("❌ Assessment cache update failed", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Update assessment cache for a single employee (called after clock in/out)
 * Uses EXACT same calculation logic as timecard
 */
async function updateSingleEmployeeCache(businessId, employeeId, month = null) {
  try {
    const targetMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM format
    console.log(`🔄 Updating cache for employee ${employeeId} in ${businessId}, month: ${targetMonth}`);
    
    // Get employee info
    const staffDoc = await db.collection("businesses").doc(businessId).collection("staff").doc(employeeId).get();
    if (!staffDoc.exists) {
      console.log(`⚠️ Employee ${employeeId} not found in staff`);
      return;
    }
    
    const employee = staffDoc.data();
    const payRate = parseFloat(employee.payRate || employee.hourlyRate || 0);
    const slot = employee.slot || 0;
    
    // Get business settings (for break duration and schedule)
    const businessDoc = await db.collection("businesses").doc(businessId).get();
    const businessData = businessDoc.data();
    const breakMinutes = businessData?.breakDuration || 60;
    const schedule = businessData?.schedule || {};
    
    // Get default work times
    let defaultScheduledWorkHours = 9; // Default 9h shift (08:30-17:30)
    let defaultScheduledStartTime = '08:30';
    let defaultScheduledEndTime = '17:30';
    
    if (businessData?.workStartTime && businessData?.workEndTime) {
      defaultScheduledStartTime = businessData.workStartTime;
      defaultScheduledEndTime = businessData.workEndTime;
      const [startH, startM] = defaultScheduledStartTime.split(':').map(Number);
      const [endH, endM] = defaultScheduledEndTime.split(':').map(Number);
      defaultScheduledWorkHours = (endH + endM/60) - (startH + startM/60);
    }
    
    console.log(`⚙️  Business Settings: ${defaultScheduledStartTime}-${defaultScheduledEndTime} (${defaultScheduledWorkHours}h shift), Break: ${breakMinutes}min`);
    
    // Parse month for date range
    const [year, monthNum] = targetMonth.split('-');
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${daysInMonth}`;
    
    // ⚡ Get attendance events for this employee (TIMECARD LOGIC)
    const eventsByDate = {};
    const attendanceRef = db.collection("businesses").doc(businessId).collection("attendance_events");
    
    console.log(`🔍 Searching events for employee ${employeeId} in month ${targetMonth}`);
    
    // Query nested structure: attendance_events/{date}/{employeeId}/*
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      try {
        const dayEventsRef = attendanceRef.doc(dateStr).collection(employeeId);
        const dayEventsSnap = await dayEventsRef.get();
        
        if (dayEventsSnap.size > 0) {
          console.log(`   Found ${dayEventsSnap.size} events on ${dateStr}`);
        }
        
        dayEventsSnap.forEach(doc => {
          const event = doc.data();
          
          // Skip test events
          if (event.testMode) return;
          
          if (event.timestamp) {
            const timestamp = event.timestamp.toDate ? event.timestamp.toDate() : new Date(event.timestamp);
            
            // Skip pending unresolved punches
            if (event.status === 'pending' && !event.resolvedManually) return;
            
            // Determine event type
            let eventType = null;
            if (event.type) eventType = event.type;
            else if (event.attendanceStatus) {
              eventType = event.attendanceStatus === 'in' ? 'clock-in' : 'clock-out';
            }
            
            if (eventType) {
              if (!eventsByDate[dateStr]) {
                eventsByDate[dateStr] = [];
              }
              
              eventsByDate[dateStr].push({
                type: eventType,
                timestamp: timestamp,
                dateStr: dateStr
              });
              
              console.log(`      Added: ${eventType} at ${timestamp.toLocaleTimeString('en-US')}`);
            }
          }
        });
      } catch (dayError) {
        // Day might not exist - that's ok
      }
    }
    
    // Calculate payable hours (EXACT TIMECARD LOGIC)
    let totalPayableHours = 0;
    let workingDays = 0;
    
    console.log(`📊 Employee ${employeeId}: Found ${Object.keys(eventsByDate).length} days with events`);
    
    Object.keys(eventsByDate).forEach(dateStr => {
      const dayEvents = eventsByDate[dateStr].sort((a, b) => a.timestamp - b.timestamp);
      
      console.log(`   ${dateStr}: ${dayEvents.length} events - ${dayEvents.map(e => e.type).join(', ')}`);
      
      // Find first clock-in and last clock-out (flexible type matching like timecard)
      const firstClockIn = dayEvents.find(e => e.type.toLowerCase().includes('in'));
      const lastClockOut = dayEvents.filter(e => e.type.toLowerCase().includes('out')).pop();
      
      if (firstClockIn && lastClockOut) {
        const actualStart = firstClockIn.timestamp;
        const actualEnd = lastClockOut.timestamp;
        
        // Get scheduled times for this day
        const date = new Date(dateStr);
        const fullDayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const daySchedule = schedule[fullDayName];
        
        let scheduledStartTime = defaultScheduledStartTime;
        let scheduledEndTime = defaultScheduledEndTime;
        let scheduledWorkHours = defaultScheduledWorkHours;
        
        if (daySchedule && daySchedule.enabled && daySchedule.startTime && daySchedule.endTime) {
          scheduledStartTime = daySchedule.startTime;
          scheduledEndTime = daySchedule.endTime;
          // Calculate ACTUAL scheduled hours (WITHOUT lunch deduction for now)
          const [startH, startM] = scheduledStartTime.split(':').map(Number);
          const [endH, endM] = scheduledEndTime.split(':').map(Number);
          const shiftDuration = (endH + endM/60) - (startH + startM/60);
          // Don't subtract lunch here - we'll do it from actual hours worked
          scheduledWorkHours = shiftDuration;
        } else {
          // For default, calculate shift duration without lunch subtraction
          const [startH, startM] = defaultScheduledStartTime.split(':').map(Number);
          const [endH, endM] = defaultScheduledEndTime.split(':').map(Number);
          scheduledWorkHours = (endH + endM/60) - (startH + startM/60);
        }
        
        console.log(`      Schedule: ${scheduledStartTime}-${scheduledEndTime}, Shift: ${scheduledWorkHours}h, Break: ${breakMinutes}min`);
        
        // Create scheduled start/end times
        const [schedStartH, schedStartM] = scheduledStartTime.split(':').map(Number);
        const [schedEndH, schedEndM] = scheduledEndTime.split(':').map(Number);
        
        const schedStart = new Date(actualStart);
        schedStart.setHours(schedStartH, schedStartM, 0, 0);
        
        const schedEnd = new Date(actualStart);
        schedEnd.setHours(schedEndH, schedEndM, 0, 0);
        
        // Calculate payable start/end (cap at scheduled times)
        const payableStart = new Date(Math.max(actualStart.getTime(), schedStart.getTime()));
        const payableEnd = new Date(Math.min(actualEnd.getTime(), schedEnd.getTime()));
        
        // Calculate duration between payable times
        const payableDuration = Math.max(0, (payableEnd.getTime() - payableStart.getTime()) / (1000 * 60 * 60));
        
        console.log(`      Raw duration: ${payableDuration.toFixed(2)}h, Break: ${breakMinutes}min, Max shift: ${scheduledWorkHours}h`);
        
        // Subtract lunch break (match timecard: always subtract if > 0)
        let dayPayableHours = Math.max(0, payableDuration - (breakMinutes / 60));
        
        // Cap at scheduled work hours AFTER lunch has been subtracted
        const maxPayableHours = Math.max(0, scheduledWorkHours - (breakMinutes / 60));
        dayPayableHours = Math.min(dayPayableHours, maxPayableHours);
        
        totalPayableHours += dayPayableHours;
        workingDays++;
        
        console.log(`   → Payable: ${dayPayableHours.toFixed(2)}h (capped at ${maxPayableHours.toFixed(2)}h)`);
      } else {
        console.log(`   → Skipped (incomplete: clockIn=${!!firstClockIn}, clockOut=${!!lastClockOut})`);
      }
    });
    
    const currentHours = Math.round(totalPayableHours * 100) / 100;
    console.log(`✅ Employee ${employeeId}: Total ${currentHours}h over ${workingDays} days`);
    const requiredHours = 176; // Standard monthly hours
    const hoursShort = Math.max(0, requiredHours - currentHours);
    const currentIncomeDue = currentHours * payRate;
    const potentialIncome = requiredHours * payRate;
    
    // 📅 Calculate Past Due Hours (based on working days passed in the month)
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-indexed
    const currentDay = today.getDate();
    
    let pastDueHours = 0;
    
    // Only calculate past due if we're in the target month
    if (year == currentYear && monthNum == currentMonth) {
      // Count working days (Mon-Fri) from start of month until TODAY (not including today if it's incomplete)
      let workingDaysPassed = 0;
      
      for (let day = 1; day < currentDay; day++) { // Note: < currentDay (not <=) to exclude today
        const checkDate = new Date(year, monthNum - 1, day);
        const dayOfWeek = checkDate.getDay(); // 0=Sunday, 6=Saturday
        
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday-Friday
          workingDaysPassed++;
        }
      }
      
      const requiredHoursSoFar = workingDaysPassed * defaultScheduledWorkHours;
      pastDueHours = Math.max(0, requiredHoursSoFar - currentHours);
      
      console.log(`📅 Past Due Calculation: ${workingDaysPassed} working days passed, should have ${requiredHoursSoFar.toFixed(1)}h, actual ${currentHours}h → Past Due: ${pastDueHours.toFixed(1)}h`);
    }
    
    // Determine status
    let status = 'On Track';
    if (hoursShort > 40) status = 'Critical';
    else if (hoursShort > 0) status = 'Behind';
    
    // Update cache in Firestore
    const cacheRef = db.collection("businesses").doc(businessId).collection("assessment_cache").doc(targetMonth);
    
    // Get existing cache or create new
    const cacheDoc = await cacheRef.get();
    let cacheData = cacheDoc.exists ? cacheDoc.data() : {
      month: targetMonth,
      summary: {
        totalEmployees: 0,
        totalHoursWorked: 0,
        totalHoursShort: 0,
        totalAmountDue: 0
      },
      employees: []
    };
    
    // Update or add this employee's data
    const employeeIndex = cacheData.employees.findIndex(e => e.employeeId === employeeId);
    const employeeData = {
      employeeId: employeeId,
      employeeIndex: slot,
      employeeName: employee.employeeName || employee.name || `Slot ${slot}`,
      currentHours: currentHours,
      requiredHours: requiredHours,
      hoursShort: hoursShort,
      pastDueHours: Math.round(pastDueHours * 100) / 100,
      workingDays: workingDays,
      payRate: payRate,
      currentIncomeDue: Math.round(currentIncomeDue * 100) / 100,
      potentialIncome: Math.round(potentialIncome * 100) / 100,
      status: status,
      lastUpdated: new Date().toISOString()
    };
    
    if (employeeIndex >= 0) {
      cacheData.employees[employeeIndex] = employeeData;
    } else {
      cacheData.employees.push(employeeData);
    }
    
    // Sort by slot
    cacheData.employees.sort((a, b) => a.employeeIndex - b.employeeIndex);
    
    // Recalculate summary
    cacheData.summary = {
      totalEmployees: cacheData.employees.length,
      totalHoursWorked: cacheData.employees.reduce((sum, e) => sum + e.currentHours, 0),
      totalHoursShort: cacheData.employees.reduce((sum, e) => sum + e.hoursShort, 0),
      totalAmountDue: cacheData.employees.reduce((sum, e) => sum + e.currentIncomeDue, 0)
    };
    cacheData.lastUpdated = new Date().toISOString();
    
    await cacheRef.set(cacheData);
    
    console.log(`✅ Updated cache for employee ${employeeId}: ${currentHours}h (${workingDays} days)`);
    
    return { employeeId, currentHours, workingDays };
    
  } catch (error) {
    console.error(`❌ Failed to update cache for employee ${employeeId}:`, error);
    throw error;
  }
}

/**
 * Calculate and cache assessment data for a business and month
 * This now processes each employee individually using timecard logic
 */
async function calculateAndCacheAssessment(businessId, month, requiredHoursPerMonth = 176) {
  try {
    console.log('📊 Starting assessment calculation for:', { businessId, month, requiredHoursPerMonth });
    
    // 1. Get all staff members
    const staffRef = db.collection("businesses").doc(businessId).collection("staff");
    const staffSnap = await staffRef.get();
    
    console.log(`👥 Found ${staffSnap.size} staff members`);
    
    if (staffSnap.empty) {
      console.log('⚠️ No staff members found');
      return { totalEmployees: 0, message: 'No staff members found' };
    }
    
    // 2. Update cache for each employee individually (reusing timecard logic)
    const updatePromises = [];
    staffSnap.forEach(doc => {
      const employeeId = doc.id;
      updatePromises.push(updateSingleEmployeeCache(businessId, employeeId, month));
    });
    
    await Promise.all(updatePromises);
    
    console.log(`✅ Assessment cache updated for ${staffSnap.size} employees`);
    
    return {
      totalEmployees: staffSnap.size,
      message: `Successfully updated cache for ${staffSnap.size} employees`
    };
    
  } catch (error) {
    console.error('❌ Assessment calculation failed:', error);
    throw error;
  }
}
    
