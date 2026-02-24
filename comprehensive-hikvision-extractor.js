/**
 * 🔍 COMPREHENSIVE HIKVISION ATTENDANCE EVENT EXTRACTOR
 * Advanced extraction system for attendance/access control events
 * Handles multiple device types, firmware versions, and authentication methods
 */

const axios = require('axios');
const https = require('https');
const xml2js = require('xml2js');

class ComprehensiveHikvisionExtractor {
  constructor(config) {
    this.device = {
      ip: config.ip,
      port: config.port || 80,
      username: config.username || 'admin',
      password: config.password,
      protocol: config.protocol || 'http'
    };
    
    this.session = null;
    this.authenticated = false;
    this.deviceInfo = null;
    
    // Create axios instance with custom settings
    this.client = axios.create({
      timeout: 30000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      maxRedirects: 5
    });
  }

  /**
   * 🔐 COMPREHENSIVE AUTHENTICATION
   * Supports multiple authentication methods found in different devices
   */
  async authenticate() {
    console.log(`🔐 Authenticating with ${this.device.ip}...`);
    
    const authMethods = [
      () => this.tryBasicAuth(),
      () => this.tryDigestAuth(),
      () => this.tryWebFormAuth(),
      () => this.trySessionCookieAuth()
    ];
    
    for (const method of authMethods) {
      try {
        const result = await method();
        if (result.success) {
          this.authenticated = true;
          console.log(`✅ Authentication successful: ${result.method}`);
          return result;
        }
      } catch (error) {
        console.log(`⚠️ Auth method failed: ${error.message}`);
      }
    }
    
    throw new Error('All authentication methods failed');
  }

  /**
   * 🔑 BASIC HTTP AUTHENTICATION
   */
  async tryBasicAuth() {
    const auth = Buffer.from(`${this.device.username}:${this.device.password}`).toString('base64');
    
    try {
      const response = await this.client.get(`${this.device.protocol}://${this.device.ip}/ISAPI/System/deviceInfo`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/xml'
        }
      });
      
      if (response.status === 200) {
        this.session = { auth: `Basic ${auth}`, type: 'basic' };
        return { success: true, method: 'Basic Auth' };
      }
    } catch (error) {
      if (error.response?.status === 401) {
        return { success: false, method: 'Basic Auth', reason: 'Invalid credentials' };
      }
      throw error;
    }
    
    return { success: false, method: 'Basic Auth' };
  }

  /**
   * 🔐 DIGEST AUTHENTICATION
   */
  async tryDigestAuth() {
    try {
      // First request to get challenge
      const firstResponse = await this.client.get(`${this.device.protocol}://${this.device.ip}/ISAPI/System/deviceInfo`);
    } catch (error) {
      if (error.response?.status === 401) {
        const wwwAuth = error.response.headers['www-authenticate'];
        if (wwwAuth && wwwAuth.includes('Digest')) {
          // Parse digest challenge and create response
          const digestResponse = this.createDigestResponse(wwwAuth, 'GET', '/ISAPI/System/deviceInfo');
          
          const response = await this.client.get(`${this.device.protocol}://${this.device.ip}/ISAPI/System/deviceInfo`, {
            headers: {
              'Authorization': digestResponse
            }
          });
          
          if (response.status === 200) {
            this.session = { auth: digestResponse, type: 'digest' };
            return { success: true, method: 'Digest Auth' };
          }
        }
      }
    }
    
    return { success: false, method: 'Digest Auth' };
  }

  /**
   * 🌐 WEB FORM AUTHENTICATION (Common in older devices)
   */
  async tryWebFormAuth() {
    try {
      // Try common login endpoints
      const loginEndpoints = [
        '/doc/page/login.asp',
        '/login.asp',
        '/Login.asp',
        '/web/login',
        '/cgi-bin/login.cgi'
      ];
      
      for (const endpoint of loginEndpoints) {
        try {
          const response = await this.client.post(`${this.device.protocol}://${this.device.ip}${endpoint}`, {
            username: this.device.username,
            password: this.device.password
          }, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
          
          if (response.status === 200 && response.headers['set-cookie']) {
            this.session = { 
              cookies: response.headers['set-cookie'], 
              type: 'web-form' 
            };
            return { success: true, method: `Web Form Auth (${endpoint})` };
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      // Continue to next method
    }
    
    return { success: false, method: 'Web Form Auth' };
  }

  /**
   * 🍪 SESSION COOKIE AUTHENTICATION
   */
  async trySessionCookieAuth() {
    // Based on your terminal command pattern
    try {
      const response = await this.client.post(`${this.device.protocol}://${this.device.ip}/doc/page/login.asp`, 
        `username=${this.device.username}&password=${this.device.password}`, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
      
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        this.session = { cookies, type: 'session-cookie' };
        
        // Verify authentication by accessing a protected page
        const testResponse = await this.makeAuthenticatedRequest('/doc/index.html');
        if (testResponse.status === 200) {
          return { success: true, method: 'Session Cookie Auth' };
        }
      }
    } catch (error) {
      // Continue
    }
    
    return { success: false, method: 'Session Cookie Auth' };
  }

  /**
   * 📡 MAKE AUTHENTICATED REQUEST
   */
  async makeAuthenticatedRequest(path, options = {}) {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    let headers = options.headers || {};
    
    if (this.session.type === 'basic' || this.session.type === 'digest') {
      headers['Authorization'] = this.session.auth;
    } else if (this.session.type === 'web-form' || this.session.type === 'session-cookie') {
      headers['Cookie'] = Array.isArray(this.session.cookies) 
        ? this.session.cookies.join('; ')
        : this.session.cookies;
    }
    
    return this.client.request({
      url: `${this.device.protocol}://${this.device.ip}${path}`,
      method: options.method || 'GET',
      headers,
      data: options.data,
      ...options
    });
  }

  /**
   * 🔍 COMPREHENSIVE EVENT EXTRACTION
   * Tests multiple methods to extract attendance events
   */
  async extractAttendanceEvents(dateRange = {}) {
    console.log('🔍 Starting comprehensive attendance event extraction...');
    
    const methods = [
      () => this.tryISAPIEvents(dateRange),
      () => this.tryLegacyCGIEvents(dateRange),
      () => this.tryWebInterfaceEvents(dateRange),
      () => this.tryLogFileExport(dateRange),
      () => this.tryHTTPNotificationSetup(),
      () => this.reverseEngineerWebInterface()
    ];
    
    const results = {
      totalEvents: 0,
      events: [],
      successfulMethods: [],
      failedMethods: [],
      deviceInfo: await this.getDeviceInfo()
    };
    
    for (const method of methods) {
      try {
        const result = await method();
        if (result.events && result.events.length > 0) {
          results.events = results.events.concat(result.events);
          results.totalEvents += result.events.length;
          results.successfulMethods.push(result.method);
          console.log(`✅ ${result.method}: Found ${result.events.length} events`);
        } else {
          results.failedMethods.push({ method: result.method, reason: 'No events found' });
        }
      } catch (error) {
        results.failedMethods.push({ method: method.name, error: error.message });
        console.log(`❌ ${method.name}: ${error.message}`);
      }
    }
    
    return results;
  }

  /**
   * 🏢 ISAPI STANDARD EVENTS
   */
  async tryISAPIEvents(dateRange) {
    // ✅ CORRECT Hikvision API format with AcsEventCond parameters
    const startTime = dateRange?.start || '2020-01-01T00:00:00';
    const endTime = dateRange?.end || '2026-12-31T23:59:59';
    
    const endpoints = [
      // CORRECT format with AcsEventCond prefix
      `/ISAPI/AccessControl/AcsEvent?format=json&AcsEventCond.searchID=1&AcsEventCond.searchResultPosition=0&AcsEventCond.maxResults=100&AcsEventCond.major=5&AcsEventCond.minor=75&AcsEventCond.startTime=${startTime}&AcsEventCond.endTime=${endTime}`,
      // Fallback: simple format (works on some devices)
      '/ISAPI/AccessControl/AcsEvent?format=json',
      '/ISAPI/AccessControl/AcsEvent',
      '/ISAPI/System/Log/Search',
      '/ISAPI/ContentMgmt/search',
      '/ISAPI/AccessControl/UserInfo/Search',
      '/ISAPI/AccessControl/CardHolder/Search'
    ];
    
    const events = [];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying ISAPI endpoint: ${endpoint}`);
        
        let response;
        if (endpoint.includes('Search') || endpoint.includes('AcsEvent')) {
          // POST request with XML payload
          const xmlPayload = this.buildEventSearchXML(dateRange);
          response = await this.makeAuthenticatedRequest(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/xml',
              'Accept': 'application/xml'
            },
            data: xmlPayload
          });
        } else {
          // GET request
          response = await this.makeAuthenticatedRequest(endpoint);
        }
        
        if (response.status === 200) {
          const parsedEvents = await this.parseISAPIEvents(response.data);
          events.push(...parsedEvents);
          
          if (parsedEvents.length > 0) {
            console.log(`✅ ISAPI ${endpoint}: Found ${parsedEvents.length} events`);
          }
        }
      } catch (error) {
        console.log(`⚠️ ISAPI ${endpoint}: ${error.message}`);
      }
    }
    
    return { method: 'ISAPI Events', events };
  }

  /**
   * 🕸️ LEGACY CGI EVENTS
   */
  async tryLegacyCGIEvents(dateRange) {
    const cgiEndpoints = [
      '/cgi-bin/eventManager.cgi',
      '/cgi-bin/AccessLog.cgi',
      '/cgi-bin/AccessUser.cgi',
      '/cgi-bin/logs.cgi',
      '/SDK/events',
      '/api/v1/events',
      '/export/data'
    ];
    
    const events = [];
    
    for (const endpoint of cgiEndpoints) {
      try {
        console.log(`🔍 Trying CGI endpoint: ${endpoint}`);
        
        const response = await this.makeAuthenticatedRequest(endpoint + '?' + 
          new URLSearchParams({
            action: 'get',
            type: 'attendance',
            format: 'json',
            start: dateRange.startDate || '2026-01-01',
            end: dateRange.endDate || new Date().toISOString().split('T')[0]
          }));
        
        if (response.status === 200) {
          const parsedEvents = this.parseCGIEvents(response.data);
          events.push(...parsedEvents);
          
          if (parsedEvents.length > 0) {
            console.log(`✅ CGI ${endpoint}: Found ${parsedEvents.length} events`);
          }
        }
      } catch (error) {
        console.log(`⚠️ CGI ${endpoint}: ${error.message}`);
      }
    }
    
    return { method: 'Legacy CGI Events', events };
  }

  /**
   * 🌐 WEB INTERFACE REVERSE ENGINEERING
   */
  async reverseEngineerWebInterface() {
    console.log('🌐 Reverse engineering web interface...');
    
    try {
      // Access the main page
      const mainPage = await this.makeAuthenticatedRequest('/doc/index.html');
      
      // Look for JavaScript files that handle event data
      const jsFiles = this.extractJavaScriptFiles(mainPage.data);
      
      // Analyze each JS file for API endpoints
      const endpoints = [];
      for (const jsFile of jsFiles) {
        try {
          const jsContent = await this.makeAuthenticatedRequest(jsFile);
          const apiEndpoints = this.extractAPIEndpoints(jsContent.data);
          endpoints.push(...apiEndpoints);
        } catch (error) {
          continue;
        }
      }
      
      // Try discovered endpoints
      const events = [];
      for (const endpoint of endpoints) {
        try {
          const response = await this.makeAuthenticatedRequest(endpoint);
          if (response.status === 200) {
            const parsedEvents = this.parseGenericEvents(response.data);
            events.push(...parsedEvents);
          }
        } catch (error) {
          continue;
        }
      }
      
      return { method: 'Web Interface Reverse Engineering', events };
    } catch (error) {
      throw new Error(`Web interface analysis failed: ${error.message}`);
    }
  }

  /**
   * 🔔 HTTP NOTIFICATION SETUP
   * Sets up real-time event notifications
   */
  async tryHTTPNotificationSetup() {
    console.log('🔔 Setting up HTTP notification...');
    
    const notificationEndpoints = [
      '/ISAPI/Event/notification/httpHosts',
      '/ISAPI/Event/triggers',
      '/cgi-bin/eventManager.cgi?action=set'
    ];
    
    // This would set up notifications to be sent to your server
    // For now, return empty as it's for future events
    return { method: 'HTTP Notification Setup', events: [] };
  }

  /**
   * 📊 PARSE ISAPI EVENTS
   */
  async parseISAPIEvents(data) {
    const events = [];
    
    try {
      // Try XML parsing first
      if (typeof data === 'string' && data.includes('<')) {
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(data);
        
        // Navigate the XML structure to find events
        const eventNodes = this.findEventNodes(result);
        for (const event of eventNodes) {
          const parsedEvent = this.parseEventNode(event);
          if (parsedEvent) events.push(parsedEvent);
        }
      } 
      // Try JSON parsing
      else if (typeof data === 'string') {
        try {
          const jsonData = JSON.parse(data);
          const jsonEvents = this.parseJSONEvents(jsonData);
          events.push(...jsonEvents);
        } catch (jsonError) {
          // Try as plain text log format
          const textEvents = this.parseTextEvents(data);
          events.push(...textEvents);
        }
      }
    } catch (error) {
      console.log(`⚠️ Error parsing ISAPI events: ${error.message}`);
    }
    
    return events;
  }

  /**
   * 🏗️ BUILD EVENT SEARCH XML
   */
  buildEventSearchXML(dateRange) {
    const startDate = dateRange.startDate || '2026-01-01';
    const endDate = dateRange.endDate || new Date().toISOString().split('T')[0];
    
    return `<?xml version="1.0" encoding="UTF-8"?>
    <AcsEventCond>
        <searchID>1</searchID>
        <maxResults>2000</maxResults>
        <searchResultPosition>0</searchResultPosition>
        <major>5</major>
        <minor>75</minor>
        <startTime>${startDate}T00:00:00</startTime>
        <endTime>${endDate}T23:59:59</endTime>
    </AcsEventCond>`;
  }

  /**
   * 🔧 UTILITY METHODS
   */
  createDigestResponse(wwwAuth, method, uri) {
    // Simplified digest auth implementation
    // In production, use a proper digest auth library
    const realm = wwwAuth.match(/realm="([^"]+)"/)?.[1];
    const nonce = wwwAuth.match(/nonce="([^"]+)"/)?.[1];
    const qop = wwwAuth.match(/qop="([^"]+)"/)?.[1];
    
    // This is a simplified version - implement full digest auth
    return `Digest username="${this.device.username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}`;
  }

  findEventNodes(xmlObj) {
    const nodes = [];
    
    function traverse(obj) {
      if (typeof obj === 'object' && obj !== null) {
        // Look for common event node names
        const eventKeys = ['InfoList', 'AcsEvent', 'Event', 'LogItem', 'AttendanceRecord'];
        for (const key of eventKeys) {
          if (obj[key]) {
            if (Array.isArray(obj[key])) {
              nodes.push(...obj[key]);
            } else {
              nodes.push(obj[key]);
            }
          }
        }
        
        // Recursively search
        for (const value of Object.values(obj)) {
          traverse(value);
        }
      }
    }
    
    traverse(xmlObj);
    return nodes;
  }

  parseEventNode(node) {
    try {
      return {
        employeeId: node.employeeNoString?.[0] || node.employeeId?.[0] || node.cardNo?.[0],
        timestamp: node.time?.[0] || node.dateTime?.[0] || node.eventTime?.[0],
        eventType: node.type?.[0] || node.eventType?.[0],
        employeeName: node.name?.[0] || node.employeeName?.[0],
        deviceId: this.device.ip,
        source: 'isapi-xml',
        rawData: node
      };
    } catch (error) {
      return null;
    }
  }

  parseJSONEvents(jsonData) {
    const events = [];
    // Implement JSON event parsing based on your device's format
    return events;
  }

  parseTextEvents(textData) {
    const events = [];
    // Implement text log parsing
    return events;
  }

  parseCGIEvents(data) {
    const events = [];
    // Implement CGI response parsing
    return events;
  }

  parseGenericEvents(data) {
    const events = [];
    // Implement generic event parsing
    return events;
  }

  extractJavaScriptFiles(html) {
    const jsFiles = [];
    const regex = /<script[^>]+src=["']([^"']+)["'][^>]*>/g;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      jsFiles.push(match[1]);
    }
    
    return jsFiles;
  }

  extractAPIEndpoints(jsContent) {
    const endpoints = [];
    
    // Look for common patterns
    const patterns = [
      /['"`]\/[^'"`]*(?:event|attendance|access|log)[^'"`]*['"`]/g,
      /url\s*[:=]\s*['"`]([^'"`]+)['"`]/g,
      /endpoint\s*[:=]\s*['"`]([^'"`]+)['"`]/g
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(jsContent)) !== null) {
        const endpoint = match[1] || match[0].replace(/['"`]/g, '');
        if (endpoint.startsWith('/')) {
          endpoints.push(endpoint);
        }
      }
    }
    
    return [...new Set(endpoints)]; // Remove duplicates
  }

  async getDeviceInfo() {
    try {
      const response = await this.makeAuthenticatedRequest('/ISAPI/System/deviceInfo');
      if (response.status === 200) {
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);
        return result.DeviceInfo;
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * 🎯 MAIN EXTRACTION METHOD
   */
  async extract(options = {}) {
    try {
      console.log(`🎯 Starting extraction from ${this.device.ip}...`);
      
      // Authenticate
      await this.authenticate();
      
      // Extract events
      const results = await this.extractAttendanceEvents(options.dateRange);
      
      console.log(`📊 Extraction complete:`);
      console.log(`   Total events found: ${results.totalEvents}`);
      console.log(`   Successful methods: ${results.successfulMethods.length}`);
      console.log(`   Failed methods: ${results.failedMethods.length}`);
      
      return results;
      
    } catch (error) {
      console.error(`❌ Extraction failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ComprehensiveHikvisionExtractor;

// Example usage:
if (require.main === module) {
  const extractor = new ComprehensiveHikvisionExtractor({
    ip: '192.168.0.114',
    username: 'admin', 
    password: 'Azam198419880001'
  });
  
  extractor.extract({
    dateRange: {
      startDate: '2026-01-01',
      endDate: '2026-02-10'
    }
  }).then(results => {
    console.log('Results:', JSON.stringify(results, null, 2));
  }).catch(error => {
    console.error('Error:', error.message);
  });
}