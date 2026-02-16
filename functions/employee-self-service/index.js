/**
 * EMPLOYEE SELF-SERVICE - ISOLATED CLOUD FUNCTIONS
 * 
 * This is a complete isolation of employee credential management functions
 * to prevent interference with existing attendance/business functions.
 * 
 * Functions:
 * - sendCredentials: Send employee credentials via WhatsApp or Email
 * - generateCredentials: Generate random credentials for an employee
 * - bulkSendCredentials: Send credentials to multiple employees at once
 */

const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Firestore instance (initialized in main index.js)
const db = getFirestore();

/**
 * Generate a secure random password
 */
function generateSecurePassword(length = 8) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  let password = '';
  
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Generate username from employee name
 */
function generateUsername(employeeName, badgeNumber) {
  if (!employeeName && !badgeNumber) {
    return `emp${Date.now()}`;
  }
  
  if (badgeNumber) {
    return `emp${badgeNumber}`;
  }
  
  // Create username from name
  const nameParts = employeeName.toLowerCase().split(' ');
  return nameParts[0] + (nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) : '');
}

/**
 * Format credentials message for WhatsApp/Email
 */
function formatCredentialsMessage(credentials, businessId) {
  return {
    subject: '🔐 Your Employee Portal Access',
    text: `Hello ${credentials.employeeName},

Your employee portal access credentials have been set up:

🏢 Business ID: ${businessId}
👤 Username: ${credentials.username}
🔑 Password: ${credentials.password}

🌐 Login here: https://aiclock-3e78b.web.app/pages/employee-login.html

⚠️ Important: Keep these credentials secure. You can view your attendance, shifts, and payslips through the portal.

For support, contact your manager.`,
    
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .card { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #667eea; margin: 0; }
    .credentials { background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
    .credential-item { margin: 10px 0; }
    .credential-label { font-weight: bold; color: #555; }
    .credential-value { font-family: monospace; background: white; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
    .warning { background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>🔐 Employee Portal Access</h1>
      </div>
      
      <p>Hello <strong>${credentials.employeeName}</strong>,</p>
      
      <p>Your employee portal access has been configured. You can now login to view your attendance records, shifts, and payslips.</p>
      
      <div class="credentials">
        <div class="credential-item">
          <span class="credential-label">🏢 Business ID:</span>
          <span class="credential-value">${businessId}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">👤 Username:</span>
          <span class="credential-value">${credentials.username}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">🔑 Password:</span>
          <span class="credential-value">${credentials.password}</span>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="https://aiclock-3e78b.web.app/pages/employee-login.html" class="button">
          Login to Portal
        </a>
      </div>
      
      <div class="warning">
        <strong>⚠️ Important:</strong> Keep these credentials secure. Do not share them with anyone.
      </div>
      
      <div class="footer">
        <p>If you have any questions, please contact your manager.</p>
        <p style="font-size: 0.85em; color: #999;">This is an automated message from SmartClock AI</p>
      </div>
    </div>
  </div>
</body>
</html>`
  };
}

/**
 * Send credentials via WhatsApp
 */
async function sendViaWhatsApp(businessId, phoneNumber, message) {
  try {
    logger.info("📱 Sending credentials via WhatsApp", { businessId, phoneNumber });
    
    // Get business WhatsApp settings
    const whatsappSettingsRef = db.collection('businesses').doc(businessId).collection('settings').doc('whatsapp');
    const whatsappSettings = await whatsappSettingsRef.get();
    
    if (!whatsappSettings.exists || !whatsappSettings.data().enabled) {
      throw new Error("WhatsApp is not enabled for this business. Please enable it in WhatsApp Settings.");
    }

    const settings = whatsappSettings.data();
    
    // Call WhatsApp Cloud Function
    const https = require('https');
    
    const postData = JSON.stringify({
      businessId: businessId,
      phoneNumber: phoneNumber,
      message: message,
      instanceId: settings.instanceId,
      accessToken: settings.accessToken
    });

    const options = {
      hostname: 'sendwhatsappmessage-4q7htrps4q-uc.a.run.app',
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({ success: true, data: JSON.parse(data) });
          } else {
            reject(new Error(`WhatsApp API returned ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });

  } catch (error) {
    logger.error("❌ WhatsApp sending failed", { error: error.message });
    throw error;
  }
}

/**
 * Send credentials via Email
 */
async function sendViaEmail(businessId, emailAddress, subject, htmlContent, textContent) {
  try {
    logger.info("📧 Sending credentials via Email", { businessId, emailAddress });
    
    // Get business email settings (if configured)
    const emailSettingsRef = db.collection('businesses').doc(businessId).collection('settings').doc('email');
    const emailSettings = await emailSettingsRef.get();
    
    // For now, we'll use a simple approach - store the email in a queue collection
    // and let an external email service pick it up, or integrate with SendGrid/Mailgun
    
    const emailQueueRef = db.collection('businesses').doc(businessId).collection('email_queue');
    await emailQueueRef.add({
      to: emailAddress,
      subject: subject,
      html: htmlContent,
      text: textContent,
      status: 'pending',
      type: 'employee_credentials',
      createdAt: FieldValue.serverTimestamp()
    });

    logger.info("✅ Email queued successfully");
    
    return {
      success: true,
      message: "Email queued for delivery. Note: Email delivery requires email service configuration."
    };

  } catch (error) {
    logger.error("❌ Email queueing failed", { error: error.message });
    throw error;
  }
}

/**
 * CLOUD FUNCTION: Send employee credentials
 */
exports.sendCredentials = onRequest({ cors: true }, async (req, res) => {
  try {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'Method not allowed' });
      return;
    }

    const { businessId, employeeSlot, deliveryMethod, credentials } = req.body;

    logger.info("📨 Send credentials request", { 
      businessId, 
      employeeSlot, 
      deliveryMethod 
    });

    // Validate required fields
    if (!businessId || !employeeSlot || !deliveryMethod) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: businessId, employeeSlot, deliveryMethod' 
      });
      return;
    }

    // Get employee data if credentials not provided
    let employeeCredentials = credentials;
    if (!employeeCredentials) {
      const employeeRef = db.collection('businesses').doc(businessId).collection('staff').doc(employeeSlot);
      const employeeSnap = await employeeRef.get();
      
      if (!employeeSnap.exists()) {
        res.status(404).json({ success: false, error: 'Employee not found' });
        return;
      }

      const employeeData = employeeSnap.data();
      employeeCredentials = {
        username: employeeData.username,
        password: employeeData.password,
        employeeName: employeeData.employeeName,
        phoneNumber: employeeData.phone,
        email: employeeData.email
      };
    }

    // Validate credentials exist
    if (!employeeCredentials.username || !employeeCredentials.password) {
      res.status(400).json({ 
        success: false, 
        error: 'Employee credentials not set. Please set username and password first.' 
      });
      return;
    }

    // Format message
    const message = formatCredentialsMessage(employeeCredentials, businessId);

    // Send based on delivery method
    let result;
    if (deliveryMethod === 'whatsapp') {
      if (!employeeCredentials.phoneNumber) {
        res.status(400).json({ 
          success: false, 
          error: 'Employee phone number not set. Cannot send via WhatsApp.' 
        });
        return;
      }
      result = await sendViaWhatsApp(businessId, employeeCredentials.phoneNumber, message.text);
    } 
    else if (deliveryMethod === 'email') {
      if (!employeeCredentials.email) {
        res.status(400).json({ 
          success: false, 
          error: 'Employee email not set. Cannot send via Email.' 
        });
        return;
      }
      result = await sendViaEmail(businessId, employeeCredentials.email, message.subject, message.html, message.text);
    }
    else {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid delivery method. Use "whatsapp" or "email".' 
      });
      return;
    }

    // Log the delivery
    const deliveryLogRef = db.collection('businesses').doc(businessId).collection('credential_deliveries');
    await deliveryLogRef.add({
      employeeSlot,
      employeeName: employeeCredentials.employeeName,
      deliveryMethod,
      status: 'sent',
      sentAt: FieldValue.serverTimestamp(),
      recipient: deliveryMethod === 'whatsapp' ? employeeCredentials.phoneNumber : employeeCredentials.email
    });

    logger.info("✅ Credentials sent successfully", { 
      businessId, 
      employeeSlot, 
      deliveryMethod 
    });

    res.status(200).json({
      success: true,
      message: `Credentials sent via ${deliveryMethod}`,
      deliveryMethod,
      result
    });

  } catch (error) {
    logger.error("❌ Error sending credentials", { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * CLOUD FUNCTION: Generate and set credentials for an employee
 */
exports.generateCredentials = onRequest({ cors: true }, async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const { businessId, employeeSlot } = req.body;

    if (!businessId || !employeeSlot) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: businessId, employeeSlot' 
      });
      return;
    }

    // Get employee
    const employeeRef = db.collection('businesses').doc(businessId).collection('staff').doc(employeeSlot);
    const employeeSnap = await employeeRef.get();
    
    if (!employeeSnap.exists()) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const employeeData = employeeSnap.data();

    // Generate credentials
    const username = employeeData.username || generateUsername(employeeData.employeeName, employeeData.badgeNumber);
    const password = generateSecurePassword();

    // Update employee
    await employeeRef.update({
      username,
      password,
      selfServiceEnabled: true,
      credentialsGeneratedAt: FieldValue.serverTimestamp()
    });

    logger.info("✅ Credentials generated", { businessId, employeeSlot });

    res.status(200).json({
      success: true,
      credentials: {
        username,
        password,
        employeeName: employeeData.employeeName
      }
    });

  } catch (error) {
    logger.error("❌ Error generating credentials", { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * CLOUD FUNCTION: Bulk send credentials to multiple employees
 */
exports.bulkSendCredentials = onRequest({ cors: true }, async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const { businessId, employeeSlots, deliveryMethod } = req.body;

    if (!businessId || !employeeSlots || !Array.isArray(employeeSlots)) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing or invalid fields: businessId, employeeSlots (array)' 
      });
      return;
    }

    logger.info("📨 Bulk send credentials", { 
      businessId, 
      count: employeeSlots.length, 
      deliveryMethod 
    });

    const results = {
      total: employeeSlots.length,
      successful: 0,
      failed: 0,
      details: []
    };

    // Process each employee
    for (const slot of employeeSlots) {
      try {
        const employeeRef = db.collection('businesses').doc(businessId).collection('staff').doc(slot);
        const employeeSnap = await employeeRef.get();
        
        if (!employeeSnap.exists()) {
          results.failed++;
          results.details.push({ slot, status: 'failed', error: 'Employee not found' });
          continue;
        }

        const employeeData = employeeSnap.data();
        const credentials = {
          username: employeeData.username,
          password: employeeData.password,
          employeeName: employeeData.employeeName,
          phoneNumber: employeeData.phone,
          email: employeeData.email
        };

        if (!credentials.username || !credentials.password) {
          results.failed++;
          results.details.push({ slot, status: 'failed', error: 'Credentials not set' });
          continue;
        }

        const message = formatCredentialsMessage(credentials, businessId);

        // Send based on method
        if (deliveryMethod === 'whatsapp' && credentials.phoneNumber) {
          await sendViaWhatsApp(businessId, credentials.phoneNumber, message.text);
          results.successful++;
          results.details.push({ slot, status: 'sent', method: 'whatsapp' });
        } else if (deliveryMethod === 'email' && credentials.email) {
          await sendViaEmail(businessId, credentials.email, message.subject, message.html, message.text);
          results.successful++;
          results.details.push({ slot, status: 'sent', method: 'email' });
        } else {
          results.failed++;
          results.details.push({ slot, status: 'failed', error: 'Missing contact info' });
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        results.failed++;
        results.details.push({ slot, status: 'failed', error: error.message });
      }
    }

    logger.info("✅ Bulk send completed", results);

    res.status(200).json({
      success: true,
      results
    });

  } catch (error) {
    logger.error("❌ Bulk send error", { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
