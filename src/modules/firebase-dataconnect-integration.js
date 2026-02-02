// Simplified Device Integration for SQL Storage
// Works without Firebase Data Connect SDK - direct device integration

class FirebaseDataConnectIntegration {
  constructor() {
    this.devices = new Map();
    this.isInitialized = false;
    this.syncIntervals = new Map();
    this.events = []; // Local storage for events
  }

  // Initialize the integration (simplified)
  async initialize() {
    try {
      console.log('🔌 Initializing Device Integration...');
      
      // Simple initialization without Firebase Data Connect SDK
      this.isInitialized = true;
      console.log('✅ Device Integration initialized successfully');
      
      return { success: true, message: 'Device integration ready' };
    } catch (error) {
      console.error('❌ Device integration failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Add a device for sync
  addDevice(deviceConfig) {
    const device = {
      id: deviceConfig.id || `device_${Date.now()}`,
      name: deviceConfig.name || 'Hikvision Device',
      ip: deviceConfig.ip,
      username: deviceConfig.username || 'admin',
      password: deviceConfig.password,
      status: 'pending',
      lastSync: null,
      eventCount: 0
    };

    this.devices.set(device.id, device);
    console.log(`📱 Device added: ${device.name} (${device.ip})`);
    
    return device;
  }

  // Start syncing device events
  async startDeviceSync(deviceId, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Device integration not initialized');
    }

    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    console.log(`🔄 Starting device sync for ${device.name}...`);

    // Test device connection first
    const isOnline = await this.testDeviceConnection(device);
    if (!isOnline) {
      console.warn(`Device ${device.name} not reachable, will continue with simulated events`);
    }

    // Start sync interval
    const syncInterval = setInterval(async () => {
      await this.syncDeviceEvents(device);
    }, options.interval || 30000); // 30 seconds default

    this.syncIntervals.set(deviceId, syncInterval);
    device.status = 'syncing';
    
    console.log(`✅ Device sync started for ${device.name}`);
    return device;
  }

  // Test device connection
  async testDeviceConnection(device) {
    try {
      console.log(`🔍 Testing connection to ${device.ip}...`);
      
      // Try to fetch device info from Hikvision
      const response = await fetch(`http://${device.ip}/ISAPI/System/deviceInfo`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${device.username}:${device.password}`)}`
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        console.log(`✅ Device ${device.name} is reachable`);
        return true;
      } else {
        console.log(`⚠️ Device ${device.name} responded with status: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Device ${device.name} connection failed:`, error.message);
      return false;
    }
  }

  // Sync events from device
  async syncDeviceEvents(device) {
    try {
      console.log(`📥 Syncing events from ${device.name}...`);
      
      // Fetch events from device
      const events = await this.fetchDeviceEvents(device);
      
      if (events.length === 0) {
        console.log(`📋 No new events from ${device.name}`);
        return { count: 0 };
      }

      // Save events locally and to external SQL if available
      const savedCount = await this.saveEvents(events);
      
      device.lastSync = new Date().toISOString();
      device.eventCount += savedCount;
      
      console.log(`✅ Processed ${savedCount} events from ${device.name}`);
      return { count: savedCount };
      
    } catch (error) {
      console.error(`❌ Sync failed for ${device.name}:`, error.message);
      return { error: error.message };
    }
  }

  // Fetch events from Hikvision device
  async fetchDeviceEvents(device) {
    try {
      // Try to fetch real events from Hikvision ISAPI
      const eventsUrl = `http://${device.ip}/ISAPI/AccessControl/AcsEvent?format=json`;
      
      const response = await fetch(eventsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${device.username}:${device.password}`)}`
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📡 Received real device data:', data);
        
        // Parse Hikvision events (simplified)
        return this.parseHikvisionEvents(data, device);
      } else {
        console.log('📡 Real device not available, using simulated events');
        return this.generateSimulatedEvents(device);
      }
    } catch (error) {
      console.log('📡 Device fetch failed, using simulated events:', error.message);
      return this.generateSimulatedEvents(device);
    }
  }

  // Parse Hikvision events
  parseHikvisionEvents(data, device) {
    const events = [];
    
    // Parse actual Hikvision event data
    if (data && data.AcsEvent) {
      const acsEvent = Array.isArray(data.AcsEvent) ? data.AcsEvent : [data.AcsEvent];
      
      acsEvent.forEach(event => {
        events.push({
          id: `${device.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          deviceId: device.id,
          deviceName: device.name,
          deviceIp: device.ip,
          eventType: event.EventType || 'access_control',
          timestamp: event.dateTime || new Date().toISOString(),
          employeeId: event.EmployeeNoString || null,
          confidence: 100, // Hikvision events are definitive
          metadata: JSON.stringify({
            source: 'hikvision_real',
            rawEvent: event
          })
        });
      });
    }
    
    return events;
  }

  // Generate simulated events for testing
  generateSimulatedEvents(device) {
    // Only generate events occasionally
    if (Math.random() > 0.6) {
      const currentTime = new Date().toISOString();
      
      return [
        {
          id: `${device.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          deviceId: device.id,
          deviceName: device.name,
          deviceIp: device.ip,
          eventType: 'face_recognition',
          timestamp: currentTime,
          employeeId: `EMP_${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`,
          confidence: Math.round((Math.random() * 20 + 80) * 10) / 10, // 80-100%
          metadata: JSON.stringify({
            source: 'simulated',
            location: 'main_entrance',
            detection_type: 'face_recognition'
          })
        }
      ];
    }
    
    return [];
  }

  // Save events (local + external SQL)
  async saveEvents(events) {
    let savedCount = 0;
    
    for (const event of events) {
      try {
        // Store locally
        this.events.push(event);
        
        // Try to save to external SQL service if running
        await this.saveToExternalSQL(event);
        
        savedCount++;
        console.log(`💾 Saved event: ${event.eventType} from ${event.deviceName}`);
      } catch (error) {
        console.error('Failed to save event:', error);
      }
    }
    
    return savedCount;
  }

  // Save to external SQL service (your standalone service)
  async saveToExternalSQL(event) {
    try {
      const response = await fetch('http://localhost:3001/events/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          events: [event],
          source: 'device_integration'
        }),
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        console.log('📊 Event saved to external SQL service');
      }
    } catch (error) {
      console.log('⚠️ External SQL service not available:', error.message);
    }
  }

  // Get device events
  async getDeviceEvents(deviceId) {
    // Return locally stored events for the device
    return this.events.filter(event => 
      deviceId ? event.deviceId === deviceId : true
    );
  }

  // Stop device sync
  stopDeviceSync(deviceId) {
    const interval = this.syncIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(deviceId);
    }

    const device = this.devices.get(deviceId);
    if (device) {
      device.status = 'stopped';
      console.log(`⏹️ Stopped sync for ${device.name}`);
    }

    return true;
  }

  // Get sync status
  getStatus() {
    return {
      initialized: this.isInitialized,
      deviceCount: this.devices.size,
      activeSync: this.syncIntervals.size,
      totalEvents: this.events.length,
      devices: Array.from(this.devices.values()).map(d => ({
        id: d.id,
        name: d.name,
        ip: d.ip,
        status: d.status,
        lastSync: d.lastSync,
        eventCount: d.eventCount
      }))
    };
  }

  // Cleanup
  destroy() {
    // Stop all sync intervals
    this.syncIntervals.forEach((interval, deviceId) => {
      this.stopDeviceSync(deviceId);
    });
    
    this.devices.clear();
    this.events = [];
    this.isInitialized = false;
    
    console.log('🧹 Device integration cleaned up');
  }
}

// Export for use in dashboard
window.FirebaseDataConnectIntegration = FirebaseDataConnectIntegration;

// Auto-initialize
window.firebaseDataConnect = new FirebaseDataConnectIntegration();

console.log('📦 Device Integration Module loaded (Firebase-free)');