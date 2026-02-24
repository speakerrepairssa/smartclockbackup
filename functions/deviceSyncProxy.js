const { onRequest } = require("firebase-functions/v2/https");
const axios = require('axios');

exports.deviceSyncProxy = onRequest({ cors: true }, async (req, res) => {
  try {
    const { ip, username, password, month, year } = req.query;
    
    if (!ip || !username || !password) {
      res.status(400).json({
        success: false,
        message: 'Missing parameters: ip, username, password required'
      });
      return;
    }
    
    // Call VPS relay (server-to-server, no mixed content issue)
    const vpsUrl = `http://69.62.109.168:7660/device-sync-month?ip=${encodeURIComponent(ip)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&month=${month || new Date().getMonth() + 1}&year=${year || new Date().getFullYear()}`;
    
    console.log('Proxying to VPS:', vpsUrl);
    
    const response = await axios.get(vpsUrl, {
      timeout: 60000 // 60 second timeout
    });
    
    res.json(response.data);
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
