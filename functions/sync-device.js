const functions = require('firebase-functions');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * Firebase Cloud Function - Hikvision Device Sync Proxy
 * Provides HTTPS endpoint for syncing device events
 */
exports.syncDevice = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB'
  })
  .https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const { ip, username, password, month, year } = req.query;

      if (!ip || !username || !password) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameters: ip, username, password'
        });
        return;
      }

      const currentDate = new Date();
      const targetMonth = month || (currentDate.getMonth() + 1);
      const targetYear = year || currentDate.getFullYear();

      // Calculate date range for the month
      const startDate = new Date(targetYear, targetMonth - 1, 1);
      const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

      const startTime = startDate.toISOString().split('.')[0].replace('T', ' ');
      const endTime = endDate.toISOString().split('.')[0].replace('T', ' ');

      console.log(`📅 Syncing events for ${targetMonth}/${targetYear}`);
      console.log(`📱 Device: ${ip}`);
      console.log(`📆 Range: ${startTime} to ${endTime}`);

      // Build curl command with Digest authentication
      const searchUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
      const requestBody = JSON.stringify({
        AcsEventCond: {
          searchID: "1",
          searchResultPosition: 0,
          maxResults: 1000,
          major: 5,
          minor: 75,
          startTime: startTime,
          endTime: endTime
        }
      });

      const curlCommand = `curl -s --digest -u "${username}:${password}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '${requestBody}' \
        "${searchUrl}"`;

      console.log('🔄 Executing curl command...');
      const { stdout, stderr } = await execAsync(curlCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 60000 // 1 minute timeout
      });

      if (stderr) {
        console.warn('⚠️ Curl stderr:', stderr);
      }

      // Parse response
      const data = JSON.parse(stdout);

      let events = [];
      if (data.AcsEvent && data.AcsEvent.InfoList) {
        const infoList = Array.isArray(data.AcsEvent.InfoList) 
          ? data.AcsEvent.InfoList 
          : [data.AcsEvent.InfoList];

        events = infoList.map(event => ({
          employeeNo: event.employeeNoString,
          name: event.name || 'Unknown',
          time: event.time,
          cardNo: event.cardNo,
          cardType: event.cardType,
          serialNo: event.serialNo,
          userType: event.userType,
          currentVerifyMode: event.currentVerifyMode,
          attendanceStatus: event.attendanceStatus,
          type: event.type
        }));
      }

      console.log(`✅ Retrieved ${events.length} events`);

      res.json({
        success: true,
        events: events,
        count: events.length,
        month: parseInt(targetMonth),
        year: parseInt(targetYear),
        dateRange: {
          start: startTime,
          end: endTime
        }
      });

    } catch (error) {
      console.error('❌ Sync error:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        details: error.stack
      });
    }
  });
