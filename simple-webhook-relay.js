const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = 7661;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.text({ type: 'application/xml' }));
app.use(bodyParser.raw({ type: 'multipart/form-data' }));

// Firebase Cloud Function URL
const FIREBASE_WEBHOOK_URL = 'https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook';

console.log('🚀 ===============================================');
console.log('   AiClock Simple Webhook Relay - CLEAN VERSION');
console.log('   Port: ' + PORT);
console.log('   Firebase URL: ' + FIREBASE_WEBHOOK_URL);
console.log('   Mode: WEBHOOK ONLY (no auto-sync)');
console.log('===============================================');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Simple Webhook Relay',
    timestamp: new Date().toISOString(),
    mode: 'webhook-only'
  });
});

// Main webhook endpoint - receives from Hikvision device
app.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook received from device');
    console.log('Headers:', req.headers);
    console.log('Body type:', typeof req.body);
    console.log('Body:', req.body);
    
    let parsedData = null;
    
    // Handle XML from Hikvision device
    if (typeof req.body === 'string' && req.body.includes('<?xml')) {
      console.log('🔍 Parsing XML webhook from Hikvision device');
      console.log('Raw XML:', req.body);
      
      // Simple XML parsing for Hikvision webhook
      const employeeMatch = req.body.match(/<employeeNoString[^>]*>([^<]*)<\/employeeNoString>/);
      const nameMatch = req.body.match(/<name[^>]*>([^<]*)<\/name>/);
      const statusMatch = req.body.match(/<attendanceStatus[^>]*>([^<]*)<\/attendanceStatus>/);
      const timeMatch = req.body.match(/<dateTime[^>]*>([^<]*)<\/dateTime>/);
      
      console.log('Parsed matches:');
      console.log('- Employee:', employeeMatch ? employeeMatch[1] : 'NOT FOUND');
      console.log('- Name:', nameMatch ? nameMatch[1] : 'NOT FOUND');  
      console.log('- Status:', statusMatch ? statusMatch[1] : 'NOT FOUND');
      console.log('- Time:', timeMatch ? timeMatch[1] : 'NOT FOUND');
      
      if (employeeMatch && statusMatch) {
        const attendanceStatus = statusMatch[1];
        let action = 'unknown';
        
        console.log('Raw attendanceStatus:', `"${attendanceStatus}"`);
        console.log('Lowercase attendanceStatus:', `"${attendanceStatus.toLowerCase()}"`);
        
        // Map Hikvision status to action (ORIGINAL FORMAT)
        if (attendanceStatus === '1' || attendanceStatus.toLowerCase() === 'checkin') {
          action = 'in';  // ✅ Original working format
          console.log('✅ Mapped to: in');
        } else if (attendanceStatus === '2' || attendanceStatus.toLowerCase() === 'checkout') {
          action = 'out'; // ✅ Original working format  
          console.log('✅ Mapped to: out');
        } else {
          console.log('❌ Unknown attendance status:', attendanceStatus);
        }
        
        parsedData = {
          deviceId: 'admin', // Use the working device ID
          employeeId: employeeMatch[1],
          employeeName: nameMatch ? nameMatch[1] : null,
          action: action, // ✅ Original format: 'in' or 'out'
          timestamp: timeMatch ? timeMatch[1] : new Date().toISOString(),
          source: 'webhook',
          originalXml: req.body
        };
        
        console.log('✅ Parsed XML data:', parsedData);
      } else {
        console.log('❌ Could not parse XML - missing required fields');
        console.log('Employee match:', employeeMatch);
        console.log('Status match:', statusMatch);
        res.status(400).json({ error: 'Invalid XML format' });
        return;
      }
    } 
    // Handle JSON data
    else if (typeof req.body === 'object') {
      console.log('🔍 Processing JSON webhook');
      const action = req.body.action || req.body.eventType || 'unknown';
      parsedData = {
        deviceId: req.body.deviceId || 'admin',
        employeeId: req.body.employeeId,
        employeeName: req.body.employeeName,
        attendanceStatus: action === 'clock-in' || action === 'checkin' ? 'in' : 'out',
        eventType: action === 'clock-in' || action === 'checkin' ? 'checkin' : 'checkout',
        action: action,
        timestamp: req.body.timestamp || new Date().toISOString(),
        source: 'webhook'
      };
    }
    
    if (!parsedData) {
      console.log('❌ Could not parse webhook data');
      res.status(400).json({ error: 'Could not parse webhook data' });
      return;
    }
    
    // Forward to Firebase (ONLY)
    console.log('🔄 Forwarding to Firebase:');
    console.log('- URL:', FIREBASE_WEBHOOK_URL);
    console.log('- Data:', JSON.stringify(parsedData, null, 2));
    
    try {
      const firebaseResponse = await axios.post(FIREBASE_WEBHOOK_URL, parsedData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      console.log('✅ Firebase response:', firebaseResponse.data);
      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        firebaseResponse: firebaseResponse.data
      });
      
    } catch (firebaseError) {
      console.error('❌ Firebase error:', firebaseError.response?.data || firebaseError.message);
      res.status(500).json({
        error: 'Firebase forward failed',
        details: firebaseError.response?.data || firebaseError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Simple Webhook Relay running on port ${PORT}`);
  console.log('📡 Ready to receive Hikvision webhooks and forward to Firebase');
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});