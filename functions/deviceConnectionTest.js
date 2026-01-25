/**
 * Cloud Function to Test Device Connectivity
 * 
 * This function should be implemented to test actual device connectivity
 * instead of the current simulation in the frontend.
 * 
 * Usage: Call this function from the admin dashboard when testing device connection
 * 
 * @param {Object} data - Request data
 * @param {string} data.ipAddress - Device IP address
 * @param {string} data.username - Device username (optional)
 * @param {string} data.password - Device password (optional)
 * @param {string} data.deviceType - Type of device (Face Recognition, Fingerprint, etc.)
 * 
 * @returns {Object} Result object with connection status
 */

const functions = require('firebase-functions');
const axios = require('axios');

exports.testDeviceConnection = functions.https.onCall(async (data, context) => {
  // Verify admin authentication
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can test device connections'
    );
  }

  const { ipAddress, username, password, deviceType } = data;

  if (!ipAddress) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'IP address is required'
    );
  }

  try {
    const startTime = Date.now();

    // Attempt to connect to the device
    // This depends on the device API protocol (ZKTeco, Hikvision, etc.)
    
    // Example for ZKTeco devices (adjust based on your device)
    const deviceUrl = `http://${ipAddress}`;
    
    // Try different endpoints based on device type
    let endpoint = '/cgi-bin/AccessUser.cgi';
    if (deviceType === 'Face Recognition') {
      endpoint = '/cgi-bin/recordFinder.cgi';
    }

    const config = {
      timeout: 5000, // 5 second timeout
      validateStatus: (status) => status < 500 // Accept any status < 500
    };

    // Add authentication if provided
    if (username && password) {
      config.auth = {
        username: username,
        password: password
      };
    }

    const response = await axios.get(`${deviceUrl}${endpoint}`, config);
    
    const responseTime = Date.now() - startTime;

    // Check if response indicates device is reachable
    if (response.status === 200 || response.status === 401) {
      // 401 means device is reachable but requires auth
      return {
        success: true,
        responseTime: responseTime,
        message: response.status === 401 
          ? 'Device reachable but requires authentication'
          : 'Device is reachable and responding',
        deviceInfo: {
          statusCode: response.status,
          headers: response.headers
        }
      };
    } else {
      return {
        success: false,
        error: `Unexpected status code: ${response.status}`,
        responseTime: responseTime
      };
    }

  } catch (error) {
    console.error('Device connection test error:', error);

    // Determine error type
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'Connection refused - device may be offline or IP incorrect'
      };
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Connection timeout - device not responding'
      };
    } else if (error.code === 'ENOTFOUND') {
      return {
        success: false,
        error: 'Host not found - check IP address'
      };
    } else if (error.response && error.response.status === 401) {
      return {
        success: true,
        message: 'Device reachable but requires authentication',
        authRequired: true
      };
    } else {
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }
});

/**
 * Alternative: Simple ping test using ICMP (requires different approach)
 */
exports.pingDevice = functions.https.onCall(async (data, context) => {
  // Verify admin authentication
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can ping devices'
    );
  }

  const { ipAddress } = data;

  if (!ipAddress) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'IP address is required'
    );
  }

  try {
    const ping = require('ping');
    const startTime = Date.now();
    
    const res = await ping.promise.probe(ipAddress, {
      timeout: 5,
      extra: ['-c', '3'] // Send 3 packets
    });
    
    const responseTime = Date.now() - startTime;

    return {
      success: res.alive,
      responseTime: res.time || responseTime,
      packetLoss: res.packetLoss,
      message: res.alive 
        ? 'Device is online and reachable'
        : 'Device is not responding to ping'
    };

  } catch (error) {
    console.error('Ping error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * To enable this function:
 * 1. Add to functions/index.js:
 *    const deviceTest = require('./deviceConnectionTest');
 *    exports.testDeviceConnection = deviceTest.testDeviceConnection;
 *    exports.pingDevice = deviceTest.pingDevice;
 * 
 * 2. Install dependencies:
 *    npm install axios ping --prefix functions
 * 
 * 3. Update frontend (dashboard.js) simulateDeviceConnection to call:
 *    const testDeviceConnection = httpsCallable(functions, 'testDeviceConnection');
 *    const result = await testDeviceConnection({ ipAddress, username, password, deviceType });
 */
