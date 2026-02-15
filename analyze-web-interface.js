/**
 * 🕵️ WEB INTERFACE ANALYZER
 * Analyzes Hikvision web interface to discover hidden API endpoints
 * and extract attendance data from JavaScript/AJAX calls
 */

const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');

class WebInterfaceAnalyzer {
  constructor(config) {
    this.device = {
      ip: config.ip,
      username: config.username,
      password: config.password
    };
    this.discoveredEndpoints = [];
    this.networkRequests = [];
  }

  /**
   * 🔍 MAIN ANALYSIS FUNCTION
   */
  async analyze() {
    console.log('🕵️ Starting web interface analysis...');
    
    const results = {
      deviceInfo: await this.getBasicDeviceInfo(),
      endpoints: [],
      networkTraffic: [],
      extractedData: [],
      recommendations: []
    };
    
    try {
      // Method 1: Browser automation with network monitoring
      const browserResults = await this.analyzeBrowserInterface();
      results.networkTraffic = browserResults.networkRequests;
      results.extractedData.push(...browserResults.extractedData);
      
      // Method 2: Static analysis of web files
      const staticResults = await this.analyzeStaticFiles();
      results.endpoints.push(...staticResults.endpoints);
      
      // Method 3: Test discovered endpoints
      const testedEndpoints = await this.testDiscoveredEndpoints(results.endpoints);
      results.endpoints = testedEndpoints;
      
      // Generate recommendations
      results.recommendations = this.generateRecommendations(results);
      
      // Save results
      await this.saveResults(results);
      
      return results;
      
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * 🌐 BROWSER AUTOMATION ANALYSIS
   */
  async analyzeBrowserInterface() {
    console.log('🌐 Analyzing browser interface...');
    
    const browser = await puppeteer.launch({ 
      headless: false,
      devtools: true,
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
    
    const page = await browser.newPage();
    const networkRequests = [];
    const extractedData = [];
    
    // Monitor all network requests
    page.on('response', async (response) => {
      const url = response.url();
      const request = response.request();
      
      networkRequests.push({
        url,
        method: request.method(),
        headers: request.headers(),
        status: response.status(),
        timestamp: new Date().toISOString()
      });
      
      // Log attendance-related requests
      if (url.includes('attendance') || url.includes('event') || url.includes('log') || url.includes('access')) {
        console.log(`📡 Found relevant request: ${request.method()} ${url}`);
        
        try {
          const responseBody = await response.text();
          console.log(`📄 Response (first 200 chars): ${responseBody.substring(0, 200)}...`);
          
          // Try to extract data from response
          const data = this.extractDataFromResponse(responseBody);
          if (data.length > 0) {
            extractedData.push(...data);
          }
        } catch (error) {
          console.log('⚠️ Could not read response body');
        }
      }
    });
    
    try {
      // Step 1: Login
      console.log('🔐 Logging in...');
      await page.goto(`http://${this.device.ip}/doc/page/login.asp`, { waitUntil: 'networkidle2' });
      await page.waitForTimeout(2000);
      
      // Fill login form
      await page.type('input[name="username"]', this.device.username);
      await page.type('input[name="password"]', this.device.password);
      await page.click('input[type="submit"], button[type="submit"], #loginBtn');
      
      // Wait for login to complete
      await page.waitForTimeout(3000);
      
      // Step 2: Navigate to main interface
      console.log('🏠 Navigating to main interface...');
      await page.goto(`http://${this.device.ip}/doc/index.html`, { waitUntil: 'networkidle2' });
      await page.waitForTimeout(2000);
      
      // Step 3: Try to access event search
      console.log('🔍 Accessing event search...');
      try {
        await page.goto(`http://${this.device.ip}/doc/index.html#!/eventSearch`, { waitUntil: 'networkidle2' });
        await page.waitForTimeout(3000);
      } catch (error) {
        console.log('⚠️ Could not access eventSearch directly');
      }
      
      // Step 4: Look for navigation elements
      const navElements = await page.$$eval('a, button, .menu-item, .nav-item', elements => 
        elements.map(el => ({
          text: el.textContent?.trim(),
          href: el.href,
          onclick: el.onclick?.toString(),
          className: el.className
        })).filter(el => 
          el.text?.toLowerCase().includes('event') ||
          el.text?.toLowerCase().includes('attendance') ||
          el.text?.toLowerCase().includes('log') ||
          el.text?.toLowerCase().includes('access')
        )
      );
      
      console.log('🎯 Found navigation elements:', navElements);
      
      // Step 5: Click on relevant navigation items
      for (const navEl of navElements) {
        try {
          if (navEl.href) {
            console.log(`🖱️ Navigating to: ${navEl.href}`);
            await page.goto(navEl.href, { waitUntil: 'networkidle2' });
            await page.waitForTimeout(2000);
          }
        } catch (error) {
          console.log(`⚠️ Failed to navigate to ${navEl.href}`);
        }
      }
      
      // Step 6: Execute JavaScript to find data
      console.log('🔍 Executing JavaScript analysis...');
      const jsAnalysis = await page.evaluate(() => {
        const results = {
          globalVars: [],
          eventFunctions: [],
          ajaxCalls: [],
          dataElements: []
        };
        
        // Find global variables that might contain event data
        Object.keys(window).forEach(key => {
          const value = window[key];
          if (typeof value === 'object' && value !== null) {
            try {
              const str = JSON.stringify(value).toLowerCase();
              if (str.includes('event') || str.includes('attendance') || str.includes('qaasiem') || str.includes('az8')) {
                results.globalVars.push({ key, value });
              }
            } catch (e) {
              // Skip non-serializable objects
            }
          }
        });
        
        // Find functions related to events
        Object.keys(window).forEach(key => {
          if (typeof window[key] === 'function') {
            const funcStr = window[key].toString();
            if (funcStr.includes('event') || funcStr.includes('attendance') || funcStr.includes('ajax')) {
              results.eventFunctions.push({ key, func: funcStr.substring(0, 200) });
            }
          }
        });
        
        // Look for elements containing employee data
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
          const text = el.textContent;
          if (text && (text.includes('qaasiem') || text.includes('az8') || text.includes('luq'))) {
            results.dataElements.push({
              tag: el.tagName,
              className: el.className,
              id: el.id,
              text: text.trim()
            });
          }
        });
        
        return results;
      });
      
      console.log('📊 JavaScript analysis results:', jsAnalysis);
      extractedData.push({ type: 'js-analysis', data: jsAnalysis });
      
      // Step 7: Try common AJAX endpoints
      const commonEndpoints = [
        '/attendance/getRecords',
        '/api/events',
        '/cgi-bin/attendance.cgi',
        '/goform/FormAttendanceLog',
        '/doc/page/attendance_log.asp'
      ];
      
      for (const endpoint of commonEndpoints) {
        try {
          console.log(`🔍 Testing endpoint: ${endpoint}`);
          await page.evaluate((url) => {
            return fetch(url).then(r => r.text()).catch(e => null);
          }, `http://${this.device.ip}${endpoint}`);
        } catch (error) {
          // Continue testing
        }
      }
      
    } catch (error) {
      console.error('❌ Browser analysis error:', error.message);
    } finally {
      await browser.close();
    }
    
    return { networkRequests, extractedData };
  }

  /**
   * 📁 STATIC FILE ANALYSIS
   */
  async analyzeStaticFiles() {
    console.log('📁 Analyzing static files...');
    
    const endpoints = [];
    const commonFiles = [
      '/doc/index.html',
      '/doc/page/main.asp',
      '/js/main.js',
      '/js/attendance.js',
      '/js/events.js',
      '/scripts/main.js'
    ];
    
    for (const file of commonFiles) {
      try {
        const response = await axios.get(`http://${this.device.ip}${file}`, {
          timeout: 10000,
          auth: {
            username: this.device.username,
            password: this.device.password
          }
        });
        
        if (response.status === 200) {
          console.log(`📄 Analyzing file: ${file}`);
          const discoveredEndpoints = this.extractEndpointsFromContent(response.data);
          endpoints.push(...discoveredEndpoints);
        }
      } catch (error) {
        console.log(`⚠️ Could not access ${file}: ${error.message}`);
      }
    }
    
    return { endpoints: [...new Set(endpoints)] }; // Remove duplicates
  }

  /**
   * 🔍 EXTRACT ENDPOINTS FROM CONTENT
   */
  extractEndpointsFromContent(content) {
    const endpoints = [];
    
    // Regular expressions to find endpoints
    const patterns = [
      // URLs in quotes
      /['"]([^'"]*(?:attendance|event|log|access|cgi-bin)[^'"]*)['"]/gi,
      // AJAX URLs
      /url\s*[:=]\s*['"]([^'"]+)['"]/gi,
      // Form actions
      /action\s*=\s*['"]([^'"]+)['"]/gi,
      // Fetch/XMLHttpRequest URLs
      /(?:fetch|XMLHttpRequest|xhr).*?['"]([^'"]+)['"]/gi
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const endpoint = match[1];
        if (endpoint && endpoint.startsWith('/') && !endpoint.includes('http')) {
          endpoints.push(endpoint);
        }
      }
    });
    
    return endpoints;
  }

  /**
   * 🧪 TEST DISCOVERED ENDPOINTS
   */
  async testDiscoveredEndpoints(endpoints) {
    console.log('🧪 Testing discovered endpoints...');
    
    const testedEndpoints = [];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Testing: ${endpoint}`);
        
        const response = await axios.get(`http://${this.device.ip}${endpoint}`, {
          timeout: 15000,
          auth: {
            username: this.device.username,
            password: this.device.password
          },
          validateStatus: () => true // Accept all status codes
        });
        
        const result = {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers['content-type'],
          dataLength: response.data?.length || 0,
          working: response.status < 400,
          containsAttendanceData: this.checkForAttendanceData(response.data)
        };
        
        if (result.containsAttendanceData) {
          console.log(`✅ Found attendance data in: ${endpoint}`);
          result.sampleData = response.data.substring(0, 500);
        }
        
        testedEndpoints.push(result);
        
      } catch (error) {
        testedEndpoints.push({
          endpoint,
          status: 'error',
          error: error.message,
          working: false,
          containsAttendanceData: false
        });
      }
    }
    
    return testedEndpoints;
  }

  /**
   * 📊 CHECK FOR ATTENDANCE DATA
   */
  checkForAttendanceData(data) {
    if (!data || typeof data !== 'string') return false;
    
    const indicators = [
      'qaasiem', 'az8', 'luq', // Your specific employee names
      'attendance', 'event', 'checkin', 'checkout',
      'employeeNo', 'cardNo', 'time', 'datetime',
      'InfoList', 'AcsEvent', 'AccessLog'
    ];
    
    const lowerData = data.toLowerCase();
    return indicators.some(indicator => lowerData.includes(indicator.toLowerCase()));
  }

  /**
   * 🔧 EXTRACT DATA FROM RESPONSE
   */
  extractDataFromResponse(responseBody) {
    const data = [];
    
    try {
      // Try JSON parsing
      const jsonData = JSON.parse(responseBody);
      if (this.isAttendanceData(jsonData)) {
        data.push({ type: 'json', data: jsonData });
      }
    } catch (e) {
      // Try XML parsing
      if (responseBody.includes('<') && this.checkForAttendanceData(responseBody)) {
        data.push({ type: 'xml', data: responseBody });
      }
      
      // Try HTML parsing
      if (responseBody.includes('<html') && this.checkForAttendanceData(responseBody)) {
        data.push({ type: 'html', data: responseBody });
      }
    }
    
    return data;
  }

  /**
   * 📈 GENERATE RECOMMENDATIONS
   */
  generateRecommendations(results) {
    const recommendations = [];
    
    // Check if we found working endpoints
    const workingEndpoints = results.endpoints.filter(e => e.working && e.containsAttendanceData);
    
    if (workingEndpoints.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: 'USE_DISCOVERED_ENDPOINTS',
        details: `Found ${workingEndpoints.length} working endpoints with attendance data`,
        endpoints: workingEndpoints.map(e => e.endpoint)
      });
    }
    
    // Check network traffic for AJAX calls
    const attendanceRequests = results.networkTraffic.filter(r => 
      r.url.toLowerCase().includes('attendance') || 
      r.url.toLowerCase().includes('event')
    );
    
    if (attendanceRequests.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: 'REPLICATE_AJAX_CALLS',
        details: 'Found AJAX requests that likely return attendance data',
        requests: attendanceRequests
      });
    }
    
    // Check for JavaScript data
    const jsData = results.extractedData.find(d => d.type === 'js-analysis');
    if (jsData && (jsData.data.globalVars.length > 0 || jsData.data.dataElements.length > 0)) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'WEB_SCRAPING',
        details: 'Found JavaScript variables or DOM elements containing attendance data'
      });
    }
    
    // Default recommendation
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'DEEP_WEB_SCRAPING',
        details: 'No direct API found, recommend full web interface scraping',
        suggestion: 'Use Puppeteer to automate the web interface and extract data from DOM'
      });
    }
    
    return recommendations;
  }

  /**
   * 💾 SAVE RESULTS
   */
  async saveResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analysis-results-${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`📄 Results saved to: ${filename}`);
    
    // Also create a summary report
    const summary = this.createSummaryReport(results);
    const summaryFilename = `analysis-summary-${timestamp}.md`;
    fs.writeFileSync(summaryFilename, summary);
    console.log(`📋 Summary saved to: ${summaryFilename}`);
  }

  /**
   * 📋 CREATE SUMMARY REPORT
   */
  createSummaryReport(results) {
    return `# Hikvision Device Analysis Report

## Device Information
- IP: ${this.device.ip}
- Analysis Time: ${new Date().toISOString()}

## Discovered Endpoints
${results.endpoints.map(e => `- ${e.endpoint} (Status: ${e.status}) ${e.containsAttendanceData ? '✅ HAS DATA' : ''}`).join('\n')}

## Network Requests Found
${results.networkTraffic.length} total requests monitored
${results.networkTraffic.filter(r => r.url.includes('attendance') || r.url.includes('event')).length} attendance-related requests

## Recommendations
${results.recommendations.map((r, i) => `${i+1}. **${r.priority}**: ${r.action}\n   ${r.details}`).join('\n\n')}

## Next Steps
1. Implement the highest priority recommendation
2. Test the discovered endpoints with proper authentication
3. Parse the data format found in working endpoints
`;
  }

  /**
   * 🔍 GET BASIC DEVICE INFO
   */
  async getBasicDeviceInfo() {
    try {
      const response = await axios.get(`http://${this.device.ip}/doc/index.html`, {
        timeout: 10000,
        auth: {
          username: this.device.username,
          password: this.device.password
        }
      });
      
      return {
        accessible: true,
        hasWebInterface: response.status === 200,
        contentType: response.headers['content-type'],
        server: response.headers.server
      };
    } catch (error) {
      return {
        accessible: false,
        error: error.message
      };
    }
  }

  /**
   * 🧪 IS ATTENDANCE DATA
   */
  isAttendanceData(data) {
    if (typeof data !== 'object') return false;
    
    const str = JSON.stringify(data).toLowerCase();
    return str.includes('attendance') || str.includes('event') || 
           str.includes('qaasiem') || str.includes('az8') || str.includes('luq');
  }
}

// Export for use in other modules
module.exports = WebInterfaceAnalyzer;

// CLI usage
if (require.main === module) {
  const analyzer = new WebInterfaceAnalyzer({
    ip: '192.168.0.114',
    username: 'admin',
    password: 'Azam198419880001'
  });
  
  analyzer.analyze()
    .then(results => {
      console.log('\n🎉 Analysis complete!');
      console.log(`📊 Found ${results.endpoints.length} endpoints`);
      console.log(`📡 Monitored ${results.networkTraffic.length} network requests`);
      console.log(`💡 Generated ${results.recommendations.length} recommendations`);
      
      // Show top recommendations
      results.recommendations.forEach((rec, i) => {
        console.log(`\n${i+1}. ${rec.priority}: ${rec.action}`);
        console.log(`   ${rec.details}`);
      });
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error.message);
    });
}