/**
 * Device Control API Endpoints
 * Handles remote device management requests from admin panel
 */

import { https } from 'firebase-functions';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Device control handler
export const deviceControl = https.onRequest(async (req, res) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    res.status(200).send('');
    return;
  }

  // Set CORS headers
  res.set(corsHeaders);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { action, deviceId, ip, username, password } = req.body;

    if (!action || !deviceId || !ip || !username || !password) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    let result;
    switch (action) {
      case 'restart':
        result = await restartDevice(ip, username, password);
        break;
      case 'status':
        result = await getDeviceStatus(ip, username, password);
        break;
      case 'events':
        result = await getDeviceEvents(ip, username, password);
        break;
      default:
        res.status(400).json({ error: 'Invalid action' });
        return;
    }

    res.json(result);
  } catch (error) {
    console.error('Device control error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Device status checker
export const deviceStatus = https.onRequest(async (req, res) => {
  res.set(corsHeaders);

  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { deviceId, ip, username, password } = req.body;
    const result = await getDeviceStatus(ip, username, password);
    res.json(result);
  } catch (error) {
    console.error('Device status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Device events fetcher
export const deviceEvents = https.onRequest(async (req, res) => {
  res.set(corsHeaders);

  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { deviceId, ip, username, password, limit = 10 } = req.body;
    const result = await getDeviceEvents(ip, username, password, limit);
    res.json(result);
  } catch (error) {
    console.error('Device events error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restart device using cURL
async function restartDevice(ip, username, password) {
  console.log(`🔄 Restarting device at ${ip}`);
  
  const curlCommand = `curl --digest -u "${username}:${password}" -X PUT "http://${ip}/ISAPI/System/reboot" -H "Content-Type: application/xml" -d '<?xml version="1.0" encoding="UTF-8"?><reboot>restart</reboot>' --connect-timeout 10`;
  
  try {
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr && !stderr.includes('Warning')) {
      throw new Error(stderr);
    }

    // Check if response contains "OK"
    if (stdout.includes('<statusString>OK</statusString>')) {
      console.log(`✅ Device ${ip} restart successful`);
      return { success: true, message: 'Restart command sent successfully' };
    } else {
      console.log(`❌ Device ${ip} restart failed:`, stdout);
      return { success: false, message: 'Device rejected restart command' };
    }
  } catch (error) {
    console.error(`❌ Device ${ip} restart error:`, error);
    return { success: false, message: `Connection failed: ${error.message}` };
  }
}

// Get device status and info
async function getDeviceStatus(ip, username, password) {
  console.log(`🔍 Checking status of device at ${ip}`);
  
  const curlCommand = `curl --digest -u "${username}:${password}" "http://${ip}/ISAPI/System/deviceInfo" --connect-timeout 5 -s`;
  
  try {
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr && !stderr.includes('Warning')) {
      throw new Error(stderr);
    }

    // Parse basic device info from XML
    const firmwareMatch = stdout.match(/<firmwareVersion>(.*?)<\/firmwareVersion>/);
    const deviceNameMatch = stdout.match(/<deviceName>(.*?)<\/deviceName>/);
    
    if (stdout.includes('<deviceName>') || stdout.includes('<DeviceInfo>')) {
      return {
        success: true,
        firmware: firmwareMatch ? firmwareMatch[1] : 'Unknown',
        deviceName: deviceNameMatch ? deviceNameMatch[1] : 'Unknown',
        status: 'Online'
      };
    } else {
      return { success: false, message: 'Device not responding' };
    }
  } catch (error) {
    console.error(`❌ Device ${ip} status error:`, error);
    return { success: false, message: `Connection failed: ${error.message}` };
  }
}

// Get recent device events
async function getDeviceEvents(ip, username, password, limit = 10) {
  console.log(`📊 Getting events from device at ${ip}`);
  
  // Get events from the last 24 hours
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const curlCommand = `curl --digest -u "${username}:${password}" "http://${ip}/ISAPI/AccessControl/AcsEvent?format=json&startTime=${startTime}&endTime=${endTime}" --connect-timeout 10 -s`;
  
  try {
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr && !stderr.includes('Warning')) {
      throw new Error(stderr);
    }

    // Try to parse JSON response
    try {
      const jsonResponse = JSON.parse(stdout);
      
      if (jsonResponse.statusCode && jsonResponse.statusCode !== 1) {
        // Try alternative API endpoint
        return await getEventsAlternative(ip, username, password, limit);
      }
      
      const events = jsonResponse.AcsEventList?.AcsEvent || [];
      return Array.isArray(events) ? events.slice(0, limit) : [events].slice(0, limit);
      
    } catch (parseError) {
      // If JSON parsing fails, try XML parsing or alternative endpoint
      if (stdout.includes('Invalid Operation') || stdout.includes('methodNotAllowed')) {
        return await getEventsAlternative(ip, username, password, limit);
      }
      
      console.error('Parse error:', parseError);
      return [];
    }
  } catch (error) {
    console.error(`❌ Device ${ip} events error:`, error);
    return [];
  }
}

// Alternative method to get events (using event stream)
async function getEventsAlternative(ip, username, password, limit) {
  console.log(`📊 Trying alternative event method for ${ip}`);
  
  const curlCommand = `timeout 5 curl --digest -u "${username}:${password}" "http://${ip}/ISAPI/Event/notification/alertStream" --connect-timeout 3 -s`;
  
  try {
    const { stdout } = await execAsync(curlCommand);
    
    // Parse multipart response for recent event
    const events = [];
    const eventMatches = stdout.match(/{[^}]*"AccessControllerEvent"[^}]*}/g);
    
    if (eventMatches) {
      eventMatches.forEach(match => {
        try {
          const event = JSON.parse(match);
          if (event.AccessControllerEvent) {
            events.push({
              dateTime: event.dateTime,
              eventDescription: event.eventDescription || 'Access Control Event',
              name: event.AccessControllerEvent.name || 'Unknown'
            });
          }
        } catch (e) {
          // Skip malformed events
        }
      });
    }
    
    return events.slice(0, limit);
  } catch (error) {
    console.warn(`Alternative events method failed for ${ip}:`, error.message);
    return [];
  }
}