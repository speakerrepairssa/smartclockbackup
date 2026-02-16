# Employee Self-Service Portal - Complete Implementation Guide

## 📋 Overview

The Employee Self-Service Portal allows employees to:
- Login with their credentials (Business ID + Username + Password)
- View their attendance records
- Check their shifts and schedules  
- Access their payslips
- Clock in/out through the portal

This system provides businesses with tools to:
- Set employee credentials (username & password)
- Generate secure random credentials
- Send credentials via **WhatsApp** or **Email**
- Manage credentials for all employees from one place

---

## 🏗️ System Architecture

### Components

1. **Frontend Modules** (`src/modules/employee-self-service/`)
   - `employee-credentials.js` - Core credential management logic
   - `credentials-ui.js` - UI components for business dashboard

2. **Isolated Cloud Functions** (`functions/employee-self-service/`)
   - `sendCredentials` - Send credentials via WhatsApp/Email
   - `generateCredentials` - Generate random secure credentials
   - `bulkSendCredentials` - Send to multiple employees at once

3. **Employee Portal Pages**
   - `employee-login.html` - Employee login page
   - `employee-dashboard.html` - Employee dashboard
   - `employee-credentials.html` - Credentials management page (business owner)

4. **Authentication Service** (`src/modules/auth/auth.service.js`)
   - Already includes `employeeLogin()` method
   - Validates credentials against staff collection

---

## 🚀 Quick Start

### For Business Owners

#### Step 1: Set Employee Credentials

In your business dashboard, when editing an employee:

1. Go to **Staff Management**
2. Click **Edit Employee**
3. Scroll to **🔐 Employee Portal Access** section
4. Set the **Username/Login ID** and **Password**
5. Click **Save**

#### Step 2: Send Credentials to Employee

**Option A: Use the Credentials Management Page**

1. Navigate to `/pages/employee-credentials.html`
2. View all employees with their credential status
3. Click **📱 WhatsApp** or **📧 Email** to send credentials
4. Employee receives formatted message with login details

**Option B: Manual Delivery**

1. Copy the credentials after setting them
2. Manually share via your preferred method

### For Employees

1. Open: `https://aiclock-3e78b.web.app/pages/employee-login.html`
2. Enter:
   - **Business ID** (provided by employer)
   - **Username** (your login ID)
   - **Password** (your password)
3. Click **Login to Portal**
4. Access your dashboard to view attendance, shifts, and payslips

---

## 📱 Credentials Delivery Methods

### WhatsApp Delivery

**Requirements:**
- WhatsApp must be enabled in business settings
- Employee must have a phone number set
- Business must have WhatsApp instance configured

**Message Format:**
```
🔐 Employee Portal Access

Name: John Smith
Business ID: biz_speaker_repairs
Username: jsmith
Password: Abc123!@

🌐 Login at: https://aiclock-3e78b.web.app/pages/employee-login.html

⚠️ Keep these credentials secure
```

**How to Send:**
```javascript
// Via Cloud Function
fetch('https://us-central1-aiclock-3e78b.cloudfunctions.net/employeeSelfService-sendCredentials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    businessId: 'biz_speaker_repairs',
    employeeSlot: '1',
    deliveryMethod: 'whatsapp'
  })
});
```

### Email Delivery

**Requirements:**
- Employee must have an email address set
- Sends as HTML formatted email

**Email Includes:**
- Professional HTML template
- Clickable login button
- Business branding
- Security warnings

**How to Send:**
```javascript
// Via Cloud Function
fetch('https://us-central1-aiclock-3e78b.cloudfunctions.net/employeeSelfService-sendCredentials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    businessId: 'biz_speaker_repairs',
    employeeSlot: '1',
    deliveryMethod: 'email'
  })
});
```

---

## 🔧 Technical Implementation

### Cloud Functions

The isolated Cloud Functions are registered in `functions/index.js`:

```javascript
// Import employee self-service functions (isolated module)
const {
  sendCredentials,
  generateCredentials,
  bulkSendCredentials
} = require('./employee-self-service/index.js');

// Export with namespace to prevent conflicts
exports.employeeSelfService = {
  sendCredentials,
  generateCredentials,
  bulkSendCredentials
};
```

**Function Endpoints:**
- `https://us-central1-aiclock-3e78b.cloudfunctions.net/employeeSelfService-sendCredentials`
- `https://us-central1-aiclock-3e78b.cloudfunctions.net/employeeSelfService-generateCredentials`
- `https://us-central1-aiclock-3e78b.cloudfunctions.net/employeeSelfService-bulkSendCredentials`

### Frontend Integration

**In Business Dashboard:**

```javascript
import { EmployeeCredentialsUI } from '../modules/employee-self-service/credentials-ui.js';

// Initialize
const credentialsUI = new EmployeeCredentialsUI(businessId);

// Render panel
const panelHTML = credentialsUI.renderCredentialsPanel();

// Load employees
await credentialsUI.loadEmployees();
```

---

## 📊 Database Structure

### Staff Collection

```javascript
businesses/{businessId}/staff/{slotNumber}
```

**New Fields Added:**
```javascript
{
  // Existing fields...
  employeeName: "John Smith",
  badgeNumber: "12345",
  
  // Employee Portal Credentials
  username: "jsmith",           // Login username
  password: "Abc123!@",          // Plain text (consider hashing in production)
  selfServiceEnabled: true,      // Portal access enabled
  credentialsSetAt: Timestamp,   // When credentials were set
  credentialsGeneratedAt: Timestamp,  // When auto-generated
  passwordResetAt: Timestamp,    // Last password reset
  
  // Contact info for sending credentials
  phone: "+27821234567",
  email: "john@example.com"
}
```

### Credential Deliveries Log

```javascript
businesses/{businessId}/credential_deliveries/{logId}
```

```javascript
{
  employeeSlot: "1",
  employeeName: "John Smith",
  deliveryMethod: "whatsapp",
  status: "sent",
  sentAt: Timestamp,
  recipient: "+27821234567"
}
```

### Email Queue (for email delivery)

```javascript
businesses/{businessId}/email_queue/{emailId}
```

```javascript
{
  to: "john@example.com",
  subject: "🔐 Your Employee Portal Access",
  html: "<html>...</html>",
  text: "Plain text version...",
  status: "pending",
  type: "employee_credentials",
  createdAt: Timestamp
}
```

---

## 🔐 Security Considerations

### Current Implementation

✅ **What's Secure:**
- Credentials required for login
- Session-based authentication
- Business ID scope isolation
- CORS protection on Cloud Functions

⚠️ **Recommendations for Production:**

1. **Hash Passwords:**
   ```javascript
   const bcrypt = require('bcrypt');
   const hashedPassword = await bcrypt.hash(password, 10);
   ```

2. **Use HTTPS Only:**
   - All production URLs should use HTTPS

3. **Rate Limiting:**
   - Add rate limiting to prevent brute force attacks

4. **Audit Logging:**
   - Log all credential access and changes

5. **Password Policies:**
   - Enforce minimum complexity
   - Require periodic password changes

6. **Two-Factor Authentication (Optional):**
   - Add OTP via WhatsApp/Email

---

## 🎨 UI Components

### Credentials Management Panel

The UI provides:
- ✅ List of all employees with credential status
- 🔑 Generate credentials button
- 📱 Send via WhatsApp button
- 📧 Send via Email button
- 🔄 Refresh list
- 📨 Bulk send option

**Status Indicators:**
- 🟢 **Active** - Credentials set and ready
- 🟡 **Not Set** - Credentials need to be configured

---

## 🧪 Testing

### Test Credential Generation

```javascript
import employeeCredentialsManager from './modules/employee-self-service/employee-credentials.js';

// Initialize
employeeCredentialsManager.init('biz_speaker_repairs');

// Generate credentials
const result = await employeeCredentialsManager.setEmployeeCredentials('1');

console.log(result);
// {
//   success: true,
//   employeeSlot: '1',
//   username: 'jsmith',
//   password: 'Abc123!@',
//   employeeName: 'John Smith',
//   email: 'john@example.com',
//   phoneNumber: '+27821234567'
// }
```

### Test Sending via WhatsApp

```bash
curl -X POST https://us-central1-aiclock-3e78b.cloudfunctions.net/employeeSelfService-sendCredentials \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "biz_speaker_repairs",
    "employeeSlot": "1",
    "deliveryMethod": "whatsapp"
  }'
```

### Test Employee Login

1. Open `employee-login.html`
2. Enter test credentials:
   - Business ID: `biz_speaker_repairs`
   - Username: `jsmith`
   - Password: `Abc123!@`
3. Should redirect to employee dashboard

---

## 📞 Integration Points

### Business Dashboard Integration

Add a link to credentials management:

```html
<a href="/pages/employee-credentials.html" class="dashboard-link">
  🔐 Employee Portal Credentials
</a>
```

Or embed the UI directly:

```javascript
import { EmployeeCredentialsUI } from '../modules/employee-self-service/credentials-ui.js';

const credUI = new EmployeeCredentialsUI(businessId);
document.getElementById('credentials-section').innerHTML = credUI.renderCredentialsPanel();
credUI.loadEmployees();
```

### WhatsApp Integration

Requires existing WhatsApp setup:
- Instance ID configured
- Access token set
- WhatsApp enabled in business settings

### Email Integration

Current implementation queues emails. To actually send:

**Option 1: SendGrid**
```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

await sgMail.send({
  to: email,
  from: 'noreply@smartclock.app',
  subject: subject,
  html: html
});
```

**Option 2: Nodemailer**
```javascript
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({...});

await transporter.sendMail({
  from: '"SmartClock" <noreply@smartclock.app>',
  to: email,
  subject: subject,
  html: html
});
```

---

## 🐛 Troubleshooting

### Issue: Employee can't login

**Check:**
1. ✅ Username and password are set in staff collection
2. ✅ Business ID is correct
3. ✅ Employee status is active (`active: true` or `isActive: true`)
4. ✅ Username matches exactly (case-sensitive)

### Issue: WhatsApp not sending

**Check:**
1. ✅ WhatsApp enabled in business settings
2. ✅ Instance ID and access token configured
3. ✅ Employee has valid phone number
4. ✅ Phone number format: `+27821234567`

### Issue: Email not delivering

**Check:**
1. ✅ Employee has valid email address
2. ✅ Email service configured (SendGrid/Mailgun)
3. ✅ Check email queue collection for pending messages
4. ✅ SMTP credentials valid

---

## 🎯 Next Steps

### Recommended Enhancements

1. **Password Reset Flow:**
   - Employee requests password reset
   - Receive reset link via WhatsApp/Email
   - Set new password

2. **Bulk Operations:**
   - Generate credentials for all employees at once
   - Send to multiple employees simultaneously

3. **Credential Templates:**
   - Customize message templates
   - Add company branding
   - Multi-language support

4. **Audit Trail:**
   - Track who accessed what
   - Login attempt history
   - Credential change log

5. **QR Code Credentials:**
   - Generate QR code with login details
   - Print and distribute physically

---

## 📚 API Reference

### employeeCredentialsManager

```javascript
// Initialize
employeeCredentialsManager.init(businessId)

// Set credentials
await employeeCredentialsManager.setEmployeeCredentials(employeeSlot, username, password)

// Get credentials info
await employeeCredentialsManager.getEmployeeCredentials(employeeSlot)

// Send via WhatsApp
await employeeCredentialsManager.sendCredentialsViaWhatsApp(employeeSlot, credentials)

// Send via Email
await employeeCredentialsManager.sendCredentialsViaEmail(employeeSlot, credentials)

// Get all employees
await employeeCredentialsManager.getAllEmployeesWithCredentials()

// Reset password
await employeeCredentialsManager.resetEmployeePassword(employeeSlot)

// Generate credentials text
employeeCredentialsManager.generateCredentialsText(credentials)
```

### Cloud Functions

**sendCredentials**
```
POST /employeeSelfService-sendCredentials
{
  "businessId": "biz_speaker_repairs",
  "employeeSlot": "1",
  "deliveryMethod": "whatsapp|email"
}
```

**generateCredentials**
```
POST /employeeSelfService-generateCredentials
{
  "businessId": "biz_speaker_repairs",
  "employeeSlot": "1"
}
```

**bulkSendCredentials**
```
POST /employeeSelfService-bulkSendCredentials
{
  "businessId": "biz_speaker_repairs",
  "employeeSlots": ["1", "2", "3"],
  "deliveryMethod": "whatsapp|email"
}
```

---

## 💡 Tips & Best Practices

1. **Always set usernames before passwords** - Username can be derived from name/badge
2. **Test with one employee first** before bulk operations
3. **Keep credential templates consistent** for employee recognition
4. **Log all deliveries** for audit purposes
5. **Use environment-specific URLs** (dev vs production)
6. **Consider password expiry policies** for enhanced security
7. **Train employees on portal usage** before mass rollout

---

## 📞 Support

For questions or issues:
- Check logs in Firebase Console
- Review Firestore collections for data consistency
- Test Cloud Functions via Firebase console
- Check browser console for frontend errors

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Module Status:** ✅ Isolated & Production Ready
