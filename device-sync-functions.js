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
 * 🔧 MANUAL SYNC TRIGGER
 * HTTP endpoint to manually trigger sync check for specific business/device
 * URL: /manualDeviceSync?businessId=xxx&deviceId=xxx&date=2026-01-28
 */
exports.manualDeviceSync = onRequest(async (req, res) => {
  try {
    const { businessId, deviceId, date } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    logger.info("Manual device sync triggered", { businessId, deviceId, date });

    const results = [];

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