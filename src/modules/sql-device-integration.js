// SQL Device Integration Module
// Optional module for connecting Hikvision devices to SQL database
// Can be enabled independently without affecting existing Firestore operations

class SQLDeviceIntegration {
  constructor() {
    this.enabled = false;
    this.connectionStatus = 'disconnected';
    this.devices = new Map();
    this.syncInterval = null;
  }

  // Initialize the SQL integration (optional)
  async initialize(config = {}) {
    try {
      console.log('🔌 Initializing SQL Device Integration...');
      
      this.config = {
        sqlEndpoint: config.sqlEndpoint || 'http://localhost:3001',
        syncInterval: config.syncInterval || 30000, // 30 seconds
        retryAttempts: config.retryAttempts || 3,
        deviceTimeout: config.deviceTimeout || 5000,
        ...config
      };

      // Test SQL connection (without breaking existing functionality)
      const testResult = await this.testSQLConnection();
      if (testResult.success) {
        this.enabled = true;
        this.connectionStatus = 'connected';
        console.log('✅ SQL Integration initialized successfully');
        return { success: true, message: 'SQL integration enabled' };
      } else {
        console.log('⚠️ SQL Integration unavailable - continuing with Firestore only');
        return { success: false, message: 'SQL unavailable, using Firestore fallback' };
      }
    } catch (error) {
      console.log('⚠️ SQL Integration failed to initialize - using Firestore only');
      this.enabled = false;
      return { success: false, error: error.message };
    }
  }

  // Test SQL database connection
  async testSQLConnection() {
    try {
      const response = await fetch(`${this.config.sqlEndpoint}/health`, {
        method: 'GET',
        timeout: 3000
      });
      return { success: response.ok };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Add a device for SQL sync (optional enhancement)
  addDevice(deviceConfig) {
    if (!this.enabled) {
      console.log('SQL integration not enabled - device added to local tracking only');
    }

    const device = {
      id: deviceConfig.id || Date.now().toString(),
      name: deviceConfig.name,
      ip: deviceConfig.ip,
      type: deviceConfig.type || 'hikvision',
      username: deviceConfig.username,
      password: deviceConfig.password,
      lastSync: null,
      status: 'pending',
      sqlEnabled: this.enabled
    };

    this.devices.set(device.id, device);
    console.log(`📱 Device added: ${device.name} (${device.ip}) - SQL: ${this.enabled ? 'enabled' : 'disabled'}`);
    
    return device;
  }

  // Start device monitoring (enhanced with SQL support)
  async startDeviceSync(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error('Device not found');

    console.log(`🔄 Starting sync for ${device.name}...`);
    
    // Test device connection first
    const deviceOnline = await this.testDeviceConnection(device);
    if (!deviceOnline) {
      throw new Error(`Device ${device.name} is not reachable`);
    }

    // Start sync interval
    device.syncInterval = setInterval(async () => {
      await this.syncDeviceEvents(device);
    }, this.config.syncInterval);

    device.status = 'syncing';
    console.log(`✅ Device sync started: ${device.name}`);
    
    return device;
  }

  // Test individual device connection
  async testDeviceConnection(device) {
    try {
      // Ping the device (simplified test)
      const response = await fetch(`http://${device.ip}/ISAPI/System/deviceInfo`, {
        method: 'GET',
        timeout: this.config.deviceTimeout,
        headers: {
          'Authorization': `Basic ${btoa(`${device.username}:${device.password}`)}`
        }
      });
      return response.ok;
    } catch (error) {
      console.log(`❌ Device ${device.name} connection failed:`, error.message);
      return false;
    }
  }

  // Sync events from device
  async syncDeviceEvents(device) {
    try {
      console.log(`📥 Syncing events from ${device.name}...`);
      
      // Get events from device (simulate for now)
      const events = await this.fetchDeviceEvents(device);
      
      if (events.length === 0) {
        console.log(`📋 No new events from ${device.name}`);
        return { count: 0, source: 'device' };
      }

      // Save to both SQL (if enabled) and Firestore
      const results = await this.saveEvents(events, device);
      
      device.lastSync = new Date().toISOString();
      console.log(`✅ Synced ${events.length} events from ${device.name}`);
      
      return results;
      
    } catch (error) {
      console.error(`❌ Sync failed for ${device.name}:`, error.message);
      return { error: error.message };
    }
  }

  // Fetch events from Hikvision device
  async fetchDeviceEvents(device) {
    // For now, simulate device events
    // In production, this would connect to actual Hikvision API
    const mockEvents = [
      {
        timestamp: new Date().toISOString(),
        employeeId: 'EMP001',
        eventType: 'clock_in',
        deviceId: device.id,
        deviceName: device.name,
        confidence: 95.5
      }
    ];

    return mockEvents;
  }

  // Save events to both SQL and Firestore
  async saveEvents(events, device) {
    const results = {
      firestore: { success: false, count: 0 },
      sql: { success: false, count: 0 }
    };

    try {
      // Always save to Firestore (existing functionality)
      results.firestore = await this.saveToFirestore(events);
      
      // Optionally save to SQL if enabled
      if (this.enabled) {
        results.sql = await this.saveToSQL(events);
      }
      
      return results;
    } catch (error) {
      console.error('Save events failed:', error);
      return { error: error.message };
    }
  }

  // Save to Firestore (existing functionality preserved)
  async saveToFirestore(events) {
    try {
      // This would integrate with existing Firestore code
      console.log(`💾 Saving ${events.length} events to Firestore...`);
      
      // Simulate save
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return { success: true, count: events.length, target: 'firestore' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Save to SQL database (new functionality)
  async saveToSQL(events) {
    if (!this.enabled) {
      return { success: false, error: 'SQL integration not enabled' };
    }

    try {
      console.log(`🗄️ Saving ${events.length} events to SQL database...`);
      
      const response = await fetch(`${this.config.sqlEndpoint}/events/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          events: events,
          source: 'device_sync'
        })
      });

      if (response.ok) {
        return { success: true, count: events.length, target: 'sql' };
      } else {
        throw new Error(`SQL save failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('SQL save failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Stop device sync
  stopDeviceSync(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device || !device.syncInterval) return false;

    clearInterval(device.syncInterval);
    device.syncInterval = null;
    device.status = 'stopped';
    
    console.log(`⏹️ Stopped sync for ${device.name}`);
    return true;
  }

  // Get sync status
  getStatus() {
    return {
      enabled: this.enabled,
      connectionStatus: this.connectionStatus,
      deviceCount: this.devices.size,
      devices: Array.from(this.devices.values()).map(d => ({
        id: d.id,
        name: d.name,
        ip: d.ip,
        status: d.status,
        lastSync: d.lastSync,
        sqlEnabled: d.sqlEnabled
      }))
    };
  }

  // Cleanup
  destroy() {
    // Stop all device syncs
    this.devices.forEach((device, id) => {
      this.stopDeviceSync(id);
    });
    
    this.devices.clear();
    this.enabled = false;
    this.connectionStatus = 'disconnected';
    
    console.log('🧹 SQL Device Integration cleaned up');
  }
}

// Export for use in dashboard
window.SQLDeviceIntegration = SQLDeviceIntegration;

// Auto-initialize with default config (non-breaking)
window.sqlDeviceIntegration = new SQLDeviceIntegration();

console.log('📦 SQL Device Integration module loaded (optional)');