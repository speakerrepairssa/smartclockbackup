/**
 * 🔄 DEVICE EVENT MIRRORING AND SYNC FUNCTIONS
 * Add this to the end of functions/index.js
 */

/**
 * 🔄 STORE RAW DEVICE EVENT
 * Creates device-specific collections for real-time mirroring
 * Structure: device_{deviceId}_events/{date}/{employeeId}/{eventId}
 */
async function storeRawDeviceEvent(businessId, deviceId, eventData) {
  try {
    const { timestamp, employeeId, verifyNo } = eventData;
    const eventDate = new Date(timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
    const slotNumber = verifyNo || employeeId;
    
    logger.info("🔄 Storing raw device event", { 
      businessId, 
      deviceId, 
      eventDate, 
      slotNumber,
      eventData: eventData 
    });

    // Store in device-specific collection
    const deviceEventsRef = db.collection('businesses')
      .doc(businessId)
      .collection(`device_${deviceId}_events`)
      .doc(eventDate)
      .collection(slotNumber.toString())
      .doc();

    await deviceEventsRef.set({
      ...eventData,
      eventId: deviceEventsRef.id,
      storedAt: new Date().toISOString()
    });

    logger.info("✅ Raw device event stored", { 
      businessId, 
      deviceId, 
      eventDate, 
      slotNumber,
      eventId: deviceEventsRef.id 
    });

  } catch (error) {
    logger.error("❌ Failed to store raw device event", { 
      businessId, 
      deviceId, 
      error: error.message,
      eventData 
    });
  }
}

/**
 * 🔍 TRIGGER SYNC CHECK  
 * Compares device events vs processed events and heals missing data
 */
async function triggerSyncCheck(businessId, deviceId) {
  try {
    logger.info("🔍 Starting sync check", { businessId, deviceId });

    // Get today and yesterday for comparison
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Check today and yesterday for any missing events
    await performSyncCheck(businessId, deviceId, today);
    await performSyncCheck(businessId, deviceId, yesterday);

    logger.info("✅ Sync check completed", { businessId, deviceId });

  } catch (error) {
    logger.error("❌ Sync check failed", { 
      businessId, 
      deviceId, 
      error: error.message 
    });
  }
}

/**
 * 🔧 PERFORM SYNC CHECK FOR SPECIFIC DATE
 */
async function performSyncCheck(businessId, deviceId, dateStr) {
  try {
    logger.info("🔧 Performing sync check for date", { businessId, deviceId, dateStr });

    // Get all raw device events for this date
    const deviceEventsRef = db.collection('businesses')
      .doc(businessId)
      .collection(`device_${deviceId}_events`)
      .doc(dateStr);

    const deviceEventsDocs = await deviceEventsRef.listCollections();
    
    for (const employeeCollection of deviceEventsDocs) {
      const employeeId = employeeCollection.id;
      
      // Get device events for this employee
      const deviceEventsSnap = await employeeCollection.get();
      const deviceEvents = [];
      
      deviceEventsSnap.forEach(doc => {
        deviceEvents.push({ id: doc.id, ...doc.data() });
      });

      // Get processed events for comparison
      const processedEventsRef = db.collection('businesses')
        .doc(businessId)
        .collection('attendance_events')
        .doc(dateStr)
        .collection(employeeId);

      const processedEventsSnap = await processedEventsRef.get();
      const processedEvents = [];
      
      processedEventsSnap.forEach(doc => {
        processedEvents.push({ id: doc.id, ...doc.data() });
      });

      // Compare events - find missing ones
      const missingEvents = deviceEvents.filter(deviceEvent => {
        return !processedEvents.some(processedEvent => 
          Math.abs(new Date(deviceEvent.timestamp) - new Date(processedEvent.timestamp)) < 5000 && // Within 5 seconds
          deviceEvent.attendanceStatus === processedEvent.attendanceStatus
        );
      });

      // Process missing events
      if (missingEvents.length > 0) {
        logger.warn("🚨 MISSING EVENTS DETECTED - Auto-healing", {
          businessId,
          deviceId,
          dateStr,
          employeeId,
          missingCount: missingEvents.length
        });

        for (const missingEvent of missingEvents) {
          logger.info("🔧 Processing missing event", { missingEvent });
          
          // Re-process the missing event
          await processAttendanceEvent(businessId, {
            employeeId: missingEvent.employeeId,
            employeeName: missingEvent.employeeName,
            attendanceStatus: missingEvent.attendanceStatus,
            timestamp: missingEvent.timestamp,
            deviceId: missingEvent.deviceId,
            verifyNo: missingEvent.verifyNo,
            serialNo: missingEvent.serialNo,
            source: 'sync-recovery'
          });

          // Mark device event as healed
          await deviceEventsRef
            .collection(employeeId)
            .doc(missingEvent.eventId || missingEvent.id)
            .update({
              healed: true,
              healedAt: new Date().toISOString()
            });
        }
      } else {
        logger.info("✅ All events synced", { 
          businessId, 
          deviceId, 
          dateStr, 
          employeeId,
          deviceEventsCount: deviceEvents.length,
          processedEventsCount: processedEvents.length
        });
      }
    }

  } catch (error) {
    logger.error("❌ Sync check failed for date", { 
      businessId, 
      deviceId, 
      dateStr, 
      error: error.message 
    });
  }
}

/**
 * � IMPORT HISTORICAL EVENTS FROM DEVICE
 * Extracts historical attendance events from Hikvision device and imports to Firestore
 */
async function importHistoricalEvents(businessId, deviceId, deviceInfo) {
  try {
    logger.info("📋 Starting historical event import", { businessId, deviceId, deviceInfo });

    // Load current employees for mapping
    const currentEmployees = await loadCurrentBusinessEmployees(businessId);
    
    // Extract historical events from device
    const historicalEvents = await extractHistoricalEventsFromDevice(deviceInfo);
    
    if (historicalEvents.length === 0) {
      logger.info("📋 No historical events found", { businessId, deviceId });
      return { success: true, imported: 0, message: 'No historical events found' };
    }

    logger.info("📋 Found historical events", { 
      businessId, 
      deviceId, 
      eventCount: historicalEvents.length 
    });

    // Map events to current employee slots and import
    let importedCount = 0;
    const importResults = [];

    for (const event of historicalEvents) {
      try {
        const mappedEvent = await mapEventToCurrentEmployee(event, currentEmployees, businessId);
        
        if (mappedEvent) {
          // Store as raw device event first
          await storeRawDeviceEvent(businessId, deviceId, mappedEvent);
          
          // Process as attendance event
          await processAttendanceEvent(businessId, {
            ...mappedEvent,
            source: 'historical-import'
          });
          
          importedCount++;
          importResults.push({ 
            originalEvent: event, 
            mappedEvent: mappedEvent, 
            status: 'imported' 
          });
        } else {
          importResults.push({ 
            originalEvent: event, 
            status: 'skipped-no-mapping' 
          });
        }
      } catch (eventError) {
        logger.error("❌ Failed to import individual event", { 
          event, 
          error: eventError.message 
        });
        importResults.push({ 
          originalEvent: event, 
          status: 'error', 
          error: eventError.message 
        });
      }
    }

    logger.info("✅ Historical import completed", {
      businessId,
      deviceId,
      totalEvents: historicalEvents.length,
      importedCount,
      skippedCount: historicalEvents.length - importedCount
    });

    return {
      success: true,
      imported: importedCount,
      total: historicalEvents.length,
      results: importResults
    };

  } catch (error) {
    logger.error("❌ Historical import failed", { 
      businessId, 
      deviceId, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * 👥 LOAD CURRENT BUSINESS EMPLOYEES
 */
async function loadCurrentBusinessEmployees(businessId) {
  try {
    const employeesRef = db.collection('businesses').doc(businessId).collection('employees');
    const employeesSnap = await employeesRef.get();
    
    const employees = {};
    employeesSnap.forEach(doc => {
      const data = doc.data();
      employees[doc.id] = data;
      
      // Also map by name for lookup
      if (data.name && data.name.trim()) {
        employees[data.name.toLowerCase().trim()] = data;
      }
    });

    return employees;
  } catch (error) {
    logger.error("❌ Failed to load current employees", { businessId, error: error.message });
    return {};
  }
}

/**
 * 🔍 EXTRACT HISTORICAL EVENTS FROM DEVICE  
 */
async function extractHistoricalEventsFromDevice(deviceInfo) {
  try {
    const { ip, username, password } = deviceInfo;
    
    if (!ip || !username || !password) {
      throw new Error('Device info incomplete - need ip, username, password');
    }

    logger.info("🔍 Connecting to device for historical events", { ip });

    // Get attendance logs from device (last 30 days)
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const response = await fetch(`http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
      },
      body: JSON.stringify({
        AcsEventCond: {
          searchID: 'historical_import_' + Date.now(),
          searchResultPosition: 0,
          maxResults: 5000,
          major: 5,
          minor: 75,
          startTime: startTime,
          endTime: endTime
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Device API responded with status ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.AcsEvent || !data.AcsEvent.InfoList) {
      logger.info("🔍 No historical events in device response", { ip });
      return [];
    }

    const events = data.AcsEvent.InfoList.map(event => ({
      timestamp: event.time,
      employeeId: event.employeeNoString || event.employeeNo,
      employeeName: event.name || '',
      attendanceStatus: event.attendanceStatus === 'checkin' ? 'clock_in' : 'clock_out',
      deviceId: deviceInfo.deviceId || ip,
      verifyNo: event.employeeNoString || event.employeeNo,
      serialNo: event.serialNo,
      cardNo: event.cardNo,
      source: 'historical-import',
      rawEvent: event
    }));

    logger.info("🔍 Extracted historical events from device", { 
      ip, 
      eventCount: events.length 
    });

    return events;

  } catch (error) {
    logger.error("❌ Failed to extract historical events from device", { 
      deviceInfo, 
      error: error.message 
    });
    return [];
  }
}

/**
 * 🗺️ MAP EVENT TO CURRENT EMPLOYEE
 */
async function mapEventToCurrentEmployee(historicalEvent, currentEmployees, businessId) {
  try {
    const { employeeName, employeeId, verifyNo } = historicalEvent;
    
    // Try to find matching employee by:
    // 1. Employee ID/verifyNo
    // 2. Employee name (case-insensitive)
    
    let matchedEmployee = null;
    let matchedSlot = null;

    // Try by employee ID/verifyNo first
    if (verifyNo && currentEmployees[verifyNo]) {
      matchedEmployee = currentEmployees[verifyNo];
      matchedSlot = verifyNo;
    } else if (employeeId && currentEmployees[employeeId]) {
      matchedEmployee = currentEmployees[employeeId];
      matchedSlot = employeeId;
    }

    // Try by name if no ID match
    if (!matchedEmployee && employeeName && employeeName.trim()) {
      const nameKey = employeeName.toLowerCase().trim();
      if (currentEmployees[nameKey]) {
        matchedEmployee = currentEmployees[nameKey];
        // Find the slot ID for this employee
        for (const [slotId, emp] of Object.entries(currentEmployees)) {
          if (emp.name && emp.name.toLowerCase().trim() === nameKey) {
            matchedSlot = slotId;
            break;
          }
        }
      }
    }

    if (matchedEmployee && matchedSlot) {
      logger.info("🗺️ Mapped historical event to current employee", {
        originalName: employeeName,
        originalId: employeeId,
        mappedSlot: matchedSlot,
        mappedName: matchedEmployee.name
      });

      return {
        ...historicalEvent,
        employeeId: matchedSlot,
        employeeName: matchedEmployee.name,
        mappedFrom: {
          originalName: employeeName,
          originalId: employeeId
        }
      };
    }

    logger.warn("🗺️ Could not map historical event to current employee", {
      businessId,
      originalName: employeeName,
      originalId: employeeId,
      availableEmployees: Object.keys(currentEmployees).filter(k => !k.includes('.')).slice(0, 5) // Show first 5 slot IDs
    });

    return null;

  } catch (error) {
    logger.error("❌ Failed to map historical event", { 
      historicalEvent, 
      error: error.message 
    });
    return null;
  }
}

/**
 * 🔧 MANUAL SYNC TRIGGER
 * HTTP endpoint to manually trigger sync check for specific business/device
 * URL: /manualDeviceSync?businessId=xxx&deviceId=xxx&date=2026-01-28
 * URL: /manualDeviceSync?businessId=xxx&deviceId=xxx&action=importHistorical&ip=192.168.1.100&username=admin&password=12345
 */
exports.manualDeviceSync = onRequest(async (req, res) => {
  try {
    const { businessId, deviceId, date, action, ip, username, password } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    logger.info("Manual device sync triggered", { businessId, deviceId, date, action });

    const results = [];

    // HISTORICAL IMPORT MODE
    if (action === 'importHistorical') {
      if (!deviceId || !ip || !username || !password) {
        return res.status(400).json({ 
          error: 'For historical import: deviceId, ip, username, password are required' 
        });
      }

      const deviceInfo = {
        deviceId,
        ip,
        username,
        password
      };

      const importResult = await importHistoricalEvents(businessId, deviceId, deviceInfo);
      
      return res.json({
        success: true,
        action: 'importHistorical',
        result: importResult
      });
    }

    // REGULAR SYNC MODE
    if (deviceId && date) {
      // Sync specific device and date
      await performSyncCheck(businessId, deviceId, date);
      results.push({ businessId, deviceId, date, status: 'synced' });
    } else if (deviceId) {
      // Sync specific device for today and yesterday
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      await performSyncCheck(businessId, deviceId, today);
      await performSyncCheck(businessId, deviceId, yesterday);
      
      results.push({ businessId, deviceId, dates: [today, yesterday], status: 'synced' });
    } else {
      // Sync all devices for this business
      const devicesRef = db.collection('businesses').doc(businessId).collection('devices');
      const devicesSnap = await devicesRef.get();
      
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      for (const deviceDoc of devicesSnap.docs) {
        const deviceId = deviceDoc.id;
        await performSyncCheck(businessId, deviceId, today);
        await performSyncCheck(businessId, deviceId, yesterday);
        results.push({ businessId, deviceId, dates: [today, yesterday], status: 'synced' });
      }
    }

    res.json({
      success: true,
      message: 'Device sync completed',
      results
    });

  } catch (error) {
    logger.error("Manual device sync failed", error);
    res.status(500).json({ error: error.message });
  }
});