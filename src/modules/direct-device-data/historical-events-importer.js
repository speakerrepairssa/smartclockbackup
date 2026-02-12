/**
 * 🕰️ HISTORICAL EVENTS IMPORTER
 * Imports past attendance events from Hikvision devices into Firestore
 * Connects device history with current employee slots
 */

class HistoricalEventsImporter {
  constructor() {
    this.firebaseConfig = {
      apiKey: "AIzaSyAmKmv9cmWEhTGpuxWxVu3vOKvpJLVUXx0",
      authDomain: "aiclock-82608.firebaseapp.com", 
      projectId: "aiclock-82608",
      storageBucket: "aiclock-82608.firebasestorage.app",
      messagingSenderId: "434208200088",
      appId: "1:434208200088:web:1ef0ac8a89a3e2cdd94a50"
    };
    this.db = null;
    this.currentEmployees = new Map(); // slot -> employee mapping
  }

  /**
   * 🔥 INITIALIZE FIREBASE
   */
  async initializeFirebase() {
    if (this.db) return;

    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
    const { getFirestore, collection, doc, setDoc, getDocs, query, where, orderBy } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    
    const app = initializeApp(this.firebaseConfig);
    this.db = getFirestore(app);
    this.firestoreModules = { collection, doc, setDoc, getDocs, query, where, orderBy };
    
    console.log("🔥 Firebase initialized");
  }

  /**
   * 👥 LOAD CURRENT EMPLOYEES
   * Get current employee mapping from Firestore
   */
  async loadCurrentEmployees(businessId) {
    await this.initializeFirebase();
    
    console.log(`👥 Loading current employees for ${businessId}...`);
    
    const { collection, getDocs } = this.firestoreModules;
    const staffRef = collection(this.db, "businesses", businessId, "staff");
    const snapshot = await getDocs(staffRef);
    
    this.currentEmployees.clear();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.active || data.isActive) {
        const slot = doc.id;
        this.currentEmployees.set(slot, {
          slotNumber: slot,
          employeeName: data.employeeName,
          badgeNumber: data.badgeNumber,
          deviceId: data.deviceId
        });
      }
    });
    
    console.log(`✅ Loaded ${this.currentEmployees.size} active employees`);
    return this.currentEmployees;
  }

  /**
   * 📅 EXTRACT HISTORICAL EVENTS
   * Get historical events from Hikvision device
   */
  async extractHistoricalEvents(deviceConfig, dateRange) {
    console.log(`📅 Extracting historical events from ${deviceConfig.ip}...`);
    console.log(`📊 Date range: ${dateRange.startDate} to ${dateRange.endDate}`);
    
    const auth = btoa(`${deviceConfig.username}:${deviceConfig.password}`);
    
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
      <AcsEventCond>
        <searchID>1</searchID>
        <maxResults>2000</maxResults>
        <searchResultPosition>0</searchResultPosition>
        <major>5</major>
        <minor>75</minor>
        <startTime>${dateRange.startDate}T00:00:00</startTime>
        <endTime>${dateRange.endDate}T23:59:59</endTime>
      </AcsEventCond>`;
    
    const endpoints = [
      {
        name: 'AcsEvent_HTTPS',
        url: `https://${deviceConfig.ip}/ISAPI/AccessControl/AcsEvent`,
        method: 'POST'
      },
      {
        name: 'AcsEvent_HTTP', 
        url: `http://${deviceConfig.ip}/ISAPI/AccessControl/AcsEvent`,
        method: 'POST'
      },
      {
        name: 'EventsLog',
        url: `https://${deviceConfig.ip}/ISAPI/System/Log/Search`,
        method: 'POST'
      }
    ];
    
    let extractedEvents = [];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying ${endpoint.name}...`);
        
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/xml',
            'Accept': 'application/xml, text/xml'
          },
          body: xmlPayload
        });
        
        if (response.ok) {
          const xmlData = await response.text();
          console.log(`✅ ${endpoint.name} responded with ${xmlData.length} characters`);
          
          const events = this.parseHikvisionEvents(xmlData, deviceConfig);
          if (events.length > 0) {
            extractedEvents = events;
            console.log(`📊 Extracted ${events.length} events from ${endpoint.name}`);
            break;
          }
        } else {
          console.log(`❌ ${endpoint.name} failed: ${response.status}`);
        }
        
      } catch (error) {
        console.log(`⚠️ ${endpoint.name} error: ${error.message}`);
      }
    }
    
    return extractedEvents;
  }

  /**
   * 🔍 PARSE HIKVISION EVENTS
   * Convert XML events to structured data
   */
  parseHikvisionEvents(xmlData, deviceConfig) {
    console.log('🔍 Parsing Hikvision XML events...');
    
    const events = [];
    
    try {
      // Look for InfoList entries (individual events)
      const infoListMatches = [...xmlData.matchAll(/<InfoList>(.*?)<\/InfoList>/gs)];
      
      for (const match of infoListMatches) {
        const eventXml = match[1];
        
        const event = {
          employeeNo: this.extractXMLValue(eventXml, 'employeeNoString') || 
                     this.extractXMLValue(eventXml, 'cardNo') ||
                     this.extractXMLValue(eventXml, 'cardReaderNo'),
          name: this.extractXMLValue(eventXml, 'name'),
          time: this.extractXMLValue(eventXml, 'time'),
          eventType: this.extractXMLValue(eventXml, 'major'),
          minorType: this.extractXMLValue(eventXml, 'minor'),
          deviceId: deviceConfig.deviceId,
          deviceIp: deviceConfig.ip,
          source: 'historical_import',
          rawXml: eventXml.substring(0, 500) // Keep sample for debugging
        };
        
        // Skip if no employee identifier
        if (!event.employeeNo || !event.time) {
          continue;
        }
        
        // Parse and validate timestamp
        try {
          const timestamp = new Date(event.time);
          if (isNaN(timestamp.getTime())) {
            console.warn('Invalid timestamp:', event.time);
            continue;
          }
          event.timestamp = timestamp.toISOString();
        } catch (e) {
          console.warn('Failed to parse timestamp:', event.time);
          continue;
        }
        
        // Determine attendance status
        event.attendanceStatus = this.determineAttendanceStatus(event.eventType, event.minorType);
        event.type = event.attendanceStatus === 'in' ? 'clock-in' : 'clock-out';
        
        events.push(event);
      }
      
      // Sort by timestamp
      events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      console.log(`✅ Parsed ${events.length} valid events`);
      
    } catch (error) {
      console.error('Error parsing XML:', error);
    }
    
    return events;
  }

  /**
   * 🎯 DETERMINE ATTENDANCE STATUS
   * Map Hikvision event codes to attendance status
   */
  determineAttendanceStatus(major, minor) {
    // Common Hikvision event codes
    const clockInCodes = ['1', '75', 'checkIn', 'entry'];
    const clockOutCodes = ['2', '76', 'checkOut', 'exit']; 
    
    const majorStr = String(major).toLowerCase();
    const minorStr = String(minor).toLowerCase();
    
    if (clockInCodes.some(code => majorStr.includes(code) || minorStr.includes(code))) {
      return 'in';
    } else if (clockOutCodes.some(code => majorStr.includes(code) || minorStr.includes(code))) {
      return 'out';
    }
    
    // Default behavior - alternate based on time patterns could be added here
    return 'in'; // Conservative default
  }

  /**
   * 🧮 MAP EVENTS TO EMPLOYEES
   * Match device events with current employee slots
   */
  mapEventsToSlots(events) {
    console.log('🧮 Mapping events to employee slots...');
    
    const mappedEvents = [];
    const unmappedEvents = [];
    
    for (const event of events) {
      let mappedSlot = null;
      
      // Strategy 1: Direct badge/device ID match
      for (const [slot, emp] of this.currentEmployees) {
        if (emp.badgeNumber === event.employeeNo || 
            emp.deviceId === event.employeeNo) {
          mappedSlot = slot;
          break;
        }
      }
      
      // Strategy 2: Name match
      if (!mappedSlot && event.name) {
        for (const [slot, emp] of this.currentEmployees) {
          if (emp.employeeName && 
              emp.employeeName.toLowerCase().includes(event.name.toLowerCase())) {
            mappedSlot = slot;
            break;
          }
        }
      }
      
      if (mappedSlot) {
        const employee = this.currentEmployees.get(mappedSlot);
        mappedEvents.push({
          ...event,
          slotNumber: mappedSlot,
          employeeName: employee.employeeName,
          badgeNumber: employee.badgeNumber,
          mapped: true
        });
      } else {
        unmappedEvents.push(event);
      }
    }
    
    console.log(`✅ Mapped: ${mappedEvents.length} events`);
    console.log(`⚠️ Unmapped: ${unmappedEvents.length} events`);
    
    if (unmappedEvents.length > 0) {
      console.log('🔍 Unmapped events preview:', unmappedEvents.slice(0, 3));
    }
    
    return { mappedEvents, unmappedEvents };
  }

  /**
   * 💾 IMPORT TO FIRESTORE
   * Save mapped events to Firestore collections
   */
  async importToFirestore(businessId, mappedEvents, options = {}) {
    console.log(`💾 Importing ${mappedEvents.length} events to Firestore...`);
    
    const { collection, doc, setDoc } = this.firestoreModules;
    const importStats = {
      imported: 0,
      skipped: 0,
      errors: 0
    };
    
    for (const event of mappedEvents) {
      try {
        const eventDate = new Date(event.timestamp);
        const dateStr = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = eventDate.toISOString();
        
        // Generate unique event ID
        const eventId = `${event.slotNumber}_${eventDate.getTime()}_${event.type}`;
        
        // Prepare event document
        const eventDoc = {
          employeeId: event.slotNumber,
          employeeName: event.employeeName,
          slotNumber: parseInt(event.slotNumber),
          badgeNumber: event.badgeNumber,
          time: eventDate.toTimeString().split(' ')[0], // HH:MM:SS
          timestamp: timeStr,
          type: event.type,
          attendanceStatus: event.attendanceStatus,
          deviceId: event.deviceId,
          deviceIp: event.deviceIp,
          source: 'historical_import',
          importedAt: new Date().toISOString(),
          originalEmployeeNo: event.employeeNo,
          originalName: event.name
        };
        
        // Save to attendance_events collection
        const eventRef = doc(this.db, "businesses", businessId, "attendance_events", eventId);
        
        if (!options.dryRun) {
          await setDoc(eventRef, eventDoc);
        }
        
        importStats.imported++;
        
        // Also update employee status if it's the most recent event
        if (options.updateStatus !== false) {
          await this.updateEmployeeStatus(businessId, event.slotNumber, event, options.dryRun);
        }
        
      } catch (error) {
        console.error(`Error importing event for slot ${event.slotNumber}:`, error);
        importStats.errors++;
      }
    }
    
    console.log('📊 Import completed:', importStats);
    return importStats;
  }

  /**
   * 📊 UPDATE EMPLOYEE STATUS
   * Update status collection with latest event
   */
  async updateEmployeeStatus(businessId, slotNumber, event, dryRun = false) {
    if (dryRun) return;
    
    const { collection, doc, setDoc } = this.firestoreModules;
    
    try {
      const statusRef = doc(this.db, "businesses", businessId, "status", slotNumber);
      const statusUpdate = {
        employeeId: slotNumber,
        employeeName: event.employeeName,
        badgeNumber: event.badgeNumber,
        attendanceStatus: event.attendanceStatus,
        lastClockStatus: event.attendanceStatus,
        lastClockTime: event.timestamp,
        lastEventType: event.type,
        deviceId: event.deviceId,
        slotNumber: parseInt(slotNumber),
        active: true,
        isActive: true,
        updatedAt: new Date().toISOString(),
        lastHistoricalUpdate: new Date().toISOString()
      };
      
      await setDoc(statusRef, statusUpdate, { merge: true });
      
    } catch (error) {
      console.error(`Error updating status for slot ${slotNumber}:`, error);
    }
  }

  /**
   * 🔧 EXTRACT XML VALUE
   * Helper to extract values from XML
   */
  extractXMLValue(xmlString, tagName) {
    const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i');
    const match = xmlString.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * 🚀 COMPLETE IMPORT PROCESS
   * Full historical import workflow
   */
  async performCompleteImport(config) {
    console.log('🚀 Starting complete historical import...');
    console.log('📋 Config:', config);
    
    const results = {
      success: false,
      businessId: config.businessId,
      deviceConfig: config.deviceConfig,
      dateRange: config.dateRange,
      extractedEvents: 0,
      mappedEvents: 0,
      importedEvents: 0,
      unmappedEvents: 0,
      errors: []
    };
    
    try {
      // Step 1: Load current employees
      await this.loadCurrentEmployees(config.businessId);
      
      // Step 2: Extract historical events
      const extractedEvents = await this.extractHistoricalEvents(
        config.deviceConfig, 
        config.dateRange
      );
      results.extractedEvents = extractedEvents.length;
      
      if (extractedEvents.length === 0) {
        throw new Error('No historical events found on device');
      }
      
      // Step 3: Map events to current employees
      const { mappedEvents, unmappedEvents } = this.mapEventsToSlots(extractedEvents);
      results.mappedEvents = mappedEvents.length;
      results.unmappedEvents = unmappedEvents.length;
      
      if (mappedEvents.length === 0) {
        throw new Error('No events could be mapped to current employees');
      }
      
      // Step 4: Import to Firestore
      const importStats = await this.importToFirestore(
        config.businessId, 
        mappedEvents, 
        config.options || {}
      );
      results.importedEvents = importStats.imported;
      
      results.success = true;
      console.log('✅ Complete import successful!');
      
    } catch (error) {
      console.error('❌ Import failed:', error);
      results.errors.push(error.message);
      results.success = false;
    }
    
    return results;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HistoricalEventsImporter;
} else {
  window.HistoricalEventsImporter = HistoricalEventsImporter;
}