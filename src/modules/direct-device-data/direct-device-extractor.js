/**
 * 🔍 DIRECT DEVICE DATA EXTRACTOR
 * Standalone module for extracting employee data and events directly from Hikvision devices
 * Does not interfere with main attendance system - purely for testing and data discovery
 */

class DirectDeviceExtractor {
  constructor() {
    this.devices = new Map();
    this.extractionResults = new Map();
    this.supportedEndpoints = [
      // Card holder endpoints
      { name: 'CardHolder', url: '/ISAPI/AccessControl/CardHolder', method: 'GET' },
      { name: 'CardHolderSearch', url: '/ISAPI/AccessControl/CardHolder/Search', method: 'POST', xml: true },
      { name: 'CardHolderCap', url: '/ISAPI/AccessControl/CardHolder/capabilities', method: 'GET' },
      
      // User info endpoints
      { name: 'UserInfo', url: '/ISAPI/AccessControl/UserInfo', method: 'GET' },
      { name: 'UserInfoSearch', url: '/ISAPI/AccessControl/UserInfo/Search', method: 'POST', xml: true },
      { name: 'UserInfoCap', url: '/ISAPI/AccessControl/UserInfo/capabilities', method: 'GET' },
      
      // Event endpoints
      { name: 'AcsEvent', url: '/ISAPI/AccessControl/AcsEvent', method: 'POST', xml: true },
      { name: 'EventsLog', url: '/ISAPI/System/Log/Search', method: 'POST', xml: true },
      { name: 'DeviceLog', url: '/ISAPI/System/deviceLog', method: 'GET' },
      
      // Personnel endpoints
      { name: 'Personnel', url: '/ISAPI/Intelligent/PersonnelInformation', method: 'GET' },
      { name: 'PersonDatabase', url: '/ISAPI/AccessControl/PersonDatabase', method: 'GET' },
      
      // Device info
      { name: 'DeviceInfo', url: '/ISAPI/System/deviceInfo', method: 'GET' },
      { name: 'DeviceStatus', url: '/ISAPI/System/status', method: 'GET' },
      { name: 'Capabilities', url: '/ISAPI/System/capabilities', method: 'GET' },
      
      // Alternative formats
      { name: 'EventsJSON', url: '/ISAPI/AccessControl/AcsEvent?format=json', method: 'GET' },
      { name: 'EventsXML', url: '/ISAPI/AccessControl/AcsEvent?format=xml', method: 'GET' },
      
      // Legacy endpoints
      { name: 'LegacyEvents', url: '/SDK/events', method: 'GET' },
      { name: 'APIEvents', url: '/api/v1/events', method: 'GET' },
      { name: 'DataExport', url: '/export/data', method: 'GET' }
    ];
  }

  /**
   * 🔗 REGISTER DEVICE
   * Add a device for testing
   */
  registerDevice(deviceId, config) {
    this.devices.set(deviceId, {
      id: deviceId,
      ip: config.ip,
      username: config.username || 'admin',
      password: config.password,
      port: config.port || 443,
      protocol: config.protocol || 'https',
      businessId: config.businessId,
      registeredAt: new Date().toISOString()
    });
    
    console.log(`🔗 Device registered: ${deviceId} (${config.ip})`);
    return this.devices.get(deviceId);
  }

  /**
   * 🔍 EXTRACT ALL DATA
   * Comprehensive data extraction from device
   */
  async extractAllData(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not registered`);
    }

    console.log(`🔍 Starting comprehensive extraction from ${device.ip}...`);
    
    const results = {
      deviceId,
      deviceIp: device.ip,
      timestamp: new Date().toISOString(),
      extraction: {
        employees: [],
        events: [],
        deviceInfo: null,
        capabilities: null
      },
      endpointResults: [],
      summary: {
        totalEndpoints: this.supportedEndpoints.length,
        successfulEndpoints: 0,
        employeesFound: 0,
        eventsFound: 0
      }
    };

    // Test each endpoint
    for (const endpoint of this.supportedEndpoints) {
      const result = await this.testEndpoint(device, endpoint);
      results.endpointResults.push(result);
      
      if (result.success) {
        results.summary.successfulEndpoints++;
        
        // Parse data based on endpoint type
        this.parseEndpointData(result, results.extraction);
      }
    }

    // Update summary
    results.summary.employeesFound = results.extraction.employees.length;
    results.summary.eventsFound = results.extraction.events.length;
    
    // Store results
    this.extractionResults.set(deviceId, results);
    
    console.log(`✅ Extraction complete: ${results.summary.successfulEndpoints}/${results.summary.totalEndpoints} endpoints successful`);
    console.log(`📋 Found: ${results.summary.employeesFound} employees, ${results.summary.eventsFound} events`);
    
    return results;
  }

  /**
   * 🧪 TEST ENDPOINT
   * Test individual endpoint
   */
  async testEndpoint(device, endpoint) {
    const result = {
      endpoint: endpoint.name,
      url: `${device.protocol}://${device.ip}${endpoint.url}`,
      method: endpoint.method,
      success: false,
      status: null,
      data: null,
      error: null,
      responseTime: 0
    };

    try {
      const startTime = Date.now();
      
      // Prepare request
      const auth = btoa(`${device.username}:${device.password}`);
      const config = {
        method: endpoint.method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': endpoint.xml ? 'application/xml' : 'application/json',
          'Accept': 'application/xml, application/json, text/plain'
        },
        mode: 'cors'
      };

      // Add XML body for POST requests
      if (endpoint.method === 'POST' && endpoint.xml) {
        config.body = this.generateXMLPayload(endpoint.name);
      }

      // Make request
      const response = await fetch(result.url, config);
      result.status = response.status;
      result.responseTime = Date.now() - startTime;

      if (response.ok) {
        result.data = await response.text();
        result.success = true;
        console.log(`✅ ${endpoint.name}: ${response.status} (${result.responseTime}ms)`);
      } else {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
        console.log(`❌ ${endpoint.name}: ${result.error}`);
      }

    } catch (error) {
      result.error = error.message;
      result.responseTime = Date.now() - startTime;
      console.log(`⚠️ ${endpoint.name}: ${error.message}`);
    }

    return result;
  }

  /**
   * 📄 GENERATE XML PAYLOAD
   * Generate appropriate XML for different endpoints
   */
  generateXMLPayload(endpointName) {
    const xmlPayloads = {
      'CardHolderSearch': `<?xml version="1.0" encoding="UTF-8"?>
        <CardHolderSearchCond>
          <searchID>1</searchID>
          <maxResults>100</maxResults>
          <searchResultPosition>0</searchResultPosition>
        </CardHolderSearchCond>`,
      
      'UserInfoSearch': `<?xml version="1.0" encoding="UTF-8"?>
        <UserInfoSearchCond>
          <searchID>1</searchID>
          <maxResults>100</maxResults>
          <searchResultPosition>0</searchResultPosition>
        </UserInfoSearchCond>`,
      
      'AcsEvent': `<?xml version="1.0" encoding="UTF-8"?>
        <AcsEventCond>
          <searchID>1</searchID>
          <maxResults>1000</maxResults>
          <searchResultPosition>0</searchResultPosition>
          <major>5</major>
          <minor>75</minor>
          <startTime>2026-02-01T00:00:00</startTime>
          <endTime>2026-02-10T23:59:59</endTime>
        </AcsEventCond>`,
      
      'EventsLog': `<?xml version="1.0" encoding="UTF-8"?>
        <LogSearchCond>
          <searchID>1</searchID>
          <maxResults>1000</maxResults>
          <searchResultPosition>0</searchResultPosition>
          <startTime>2026-02-01T00:00:00</startTime>
          <endTime>2026-02-10T23:59:59</endTime>
        </LogSearchCond>`
    };

    return xmlPayloads[endpointName] || '';
  }

  /**
   * 🔍 PARSE ENDPOINT DATA
   * Extract meaningful data from responses
   */
  parseEndpointData(result, extraction) {
    if (!result.success || !result.data) return;

    const data = result.data;

    // Parse device info
    if (result.endpoint === 'DeviceInfo' && data.includes('DeviceInfo')) {
      extraction.deviceInfo = this.parseDeviceInfo(data);
    }

    // Parse employee data
    if (data.includes('CardHolder') || data.includes('UserInfo') || data.includes('employeeNo')) {
      const employees = this.parseEmployees(data);
      extraction.employees.push(...employees);
    }

    // Parse events
    if (data.includes('AcsEvent') || data.includes('LogInfo') || data.includes('Event')) {
      const events = this.parseEvents(data);
      extraction.events.push(...events);
    }

    // Parse capabilities
    if (result.endpoint.includes('Cap') || data.includes('Capabilities')) {
      extraction.capabilities = data;
    }
  }

  /**
   * 👥 PARSE EMPLOYEES
   * Extract employee information from XML/JSON
   */
  parseEmployees(data) {
    const employees = [];

    // Try different patterns
    const patterns = [
      // Standard patterns
      /<employeeNo>(\d+)<\/employeeNo>/g,
      /<name>([^<]+)<\/name>/g,
      /<cardNo>(\d+)<\/cardNo>/g,
      
      // Alternative patterns
      /"employeeId":"([^"]+)"/g,
      /"employeeName":"([^"]+)"/g,
      /"cardNumber":"([^"]+)"/g
    ];

    try {
      // Extract employee numbers
      const employeeNos = [...data.matchAll(/<employeeNo>(\d+)<\/employeeNo>/g)].map(m => m[1]);
      const names = [...data.matchAll(/<name>([^<]+)<\/name>/g)].map(m => m[1]);
      const cardNos = [...data.matchAll(/<cardNo>(\d+)<\/cardNo>/g)].map(m => m[1]);

      // Combine data
      for (let i = 0; i < Math.max(employeeNos.length, names.length); i++) {
        employees.push({
          employeeNo: employeeNos[i] || null,
          name: names[i] || null,
          cardNo: cardNos[i] || null,
          source: 'device_extraction'
        });
      }

    } catch (error) {
      console.warn('Error parsing employees:', error.message);
    }

    return employees.filter(emp => emp.employeeNo || emp.name);
  }

  /**
   * 📅 PARSE EVENTS
   * Extract attendance events
   */
  parseEvents(data) {
    const events = [];

    try {
      // Event patterns
      const eventMatches = [...data.matchAll(/<InfoList>(.*?)<\/InfoList>/gs)];
      
      for (const match of eventMatches) {
        const eventData = match[1];
        
        const event = {
          employeeNo: this.extractXMLValue(eventData, 'employeeNoString'),
          name: this.extractXMLValue(eventData, 'name'),
          time: this.extractXMLValue(eventData, 'time'),
          eventType: this.extractXMLValue(eventData, 'major'),
          source: 'device_extraction'
        };

        if (event.employeeNo || event.name) {
          events.push(event);
        }
      }

    } catch (error) {
      console.warn('Error parsing events:', error.message);
    }

    return events;
  }

  /**
   * 🔧 PARSE DEVICE INFO
   * Extract device information
   */
  parseDeviceInfo(data) {
    return {
      deviceName: this.extractXMLValue(data, 'deviceName'),
      deviceID: this.extractXMLValue(data, 'deviceID'),
      model: this.extractXMLValue(data, 'model'),
      serialNumber: this.extractXMLValue(data, 'serialNumber'),
      firmwareVersion: this.extractXMLValue(data, 'firmwareVersion'),
      macAddress: this.extractXMLValue(data, 'macAddress')
    };
  }

  /**
   * 🔧 EXTRACT XML VALUE
   * Helper to extract value from XML tags
   */
  extractXMLValue(xmlString, tagName) {
    const regex = new RegExp(`<${tagName}>([^<]+)<\/${tagName}>`, 'i');
    const match = xmlString.match(regex);
    return match ? match[1] : null;
  }

  /**
   * 📊 GET EXTRACTION RESULTS
   * Retrieve results for a device
   */
  getResults(deviceId) {
    return this.extractionResults.get(deviceId);
  }

  /**
   * 📋 LIST ALL DEVICES
   * Get all registered devices
   */
  listDevices() {
    return Array.from(this.devices.values());
  }

  /**
   * 🎯 QUICK EMPLOYEE TEST
   * Quick test to find employees on device
   */
  async quickEmployeeTest(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not registered`);
    }

    console.log(`🎯 Quick employee test for ${device.ip}...`);

    const employeeEndpoints = [
      { name: 'CardHolderSearch', url: '/ISAPI/AccessControl/CardHolder/Search', method: 'POST', xml: true },
      { name: 'UserInfoSearch', url: '/ISAPI/AccessControl/UserInfo/Search', method: 'POST', xml: true },
      { name: 'Personnel', url: '/ISAPI/Intelligent/PersonnelInformation', method: 'GET' }
    ];

    const results = [];
    
    for (const endpoint of employeeEndpoints) {
      const result = await this.testEndpoint(device, endpoint);
      if (result.success) {
        const employees = this.parseEmployees(result.data);
        results.push({
          endpoint: endpoint.name,
          employees,
          count: employees.length
        });
      }
    }

    return {
      deviceId,
      totalEmployees: results.reduce((sum, r) => sum + r.count, 0),
      results
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DirectDeviceExtractor;
} else {
  window.DirectDeviceExtractor = DirectDeviceExtractor;
}