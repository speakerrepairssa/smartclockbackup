# Employee Self-Service - Quick Integration Guide

## 🎯 Quick Add to Business Dashboard

### Option 1: Add Link to Credentials Page

In `business-dashboard.html`, add a navigation link:

```html
<!-- In your navigation menu -->
<a href="/pages/employee-credentials.html" class="nav-link">
  <span>🔐</span>
  <span>Employee Credentials</span>
</a>
```

### Option 2: Embed Credentials Panel Directly

In `business-dashboard.html`, add this section:

```html
<!-- Add this section where you want the credentials panel -->
<section id="employee-credentials-section" style="display: none;">
  <div id="credentials-panel-container"></div>
</section>
```

Then in your JavaScript:

```javascript
import { EmployeeCredentialsUI } from '../modules/employee-self-service/credentials-ui.js';

// Initialize when showing credentials section
let credentialsUI = null;

function showCredentialsSection() {
  document.getElementById('employee-credentials-section').style.display = 'block';
  
  if (!credentialsUI) {
    credentialsUI = new EmployeeCredentialsUI(businessId);
    document.getElementById('credentials-panel-container').innerHTML = 
      credentialsUI.renderCredentialsPanel();
  }
  
  credentialsUI.loadEmployees();
}
```

### Option 3: Add to Employee Edit Modal

In the employee edit form, add a "Send Credentials" button:

```html
<!-- In employee edit modal, after saving credentials -->
<div class="form-actions">
  <button type="button" onclick="sendEmployeeCredentials('${slotNumber}', 'whatsapp')" 
          class="btn-whatsapp">
    📱 Send via WhatsApp
  </button>
  <button type="button" onclick="sendEmployeeCredentials('${slotNumber}', 'email')" 
          class="btn-email">
    📧 Send via Email
  </button>
</div>
```

And add the function:

```javascript
async function sendEmployeeCredentials(employeeSlot, method) {
  try {
    const response = await fetch('https://us-central1-aiclock-3e78b.cloudfunctions.net/employeeSelfService-sendCredentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: businessId,
        employeeSlot: employeeSlot,
        deliveryMethod: method
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert(`✅ Credentials sent via ${method}!`);
    } else {
      alert(`❌ Failed: ${result.error}`);
    }
  } catch (error) {
    alert(`❌ Error: ${error.message}`);
  }
}
```

---

## 📦 Deploy Cloud Functions

```bash
cd functions
npm install
firebase deploy --only functions:employeeSelfService
```

This deploys:
- `employeeSelfService-sendCredentials`
- `employeeSelfService-generateCredentials`
- `employeeSelfService-bulkSendCredentials`

---

## ✅ What's Already Setup

✅ Employee login page exists at `/pages/employee-login.html`
✅ Auth service has `employeeLogin()` method
✅ Staff collection has `username` and `password` fields
✅ Business dashboard allows setting credentials in employee edit form

---

## 🆕 What Was Added

### New Files Created:

1. **`src/modules/employee-self-service/employee-credentials.js`**
   - Core credential management logic
   - Generate passwords, set credentials, send via WhatsApp/Email

2. **`src/modules/employee-self-service/credentials-ui.js`**
   - UI components for credentials management
   - List employees, show status, send buttons

3. **`src/pages/employee-credentials.html`**
   - Standalone credentials management page
   - Full UI for managing all employee credentials

4. **`functions/employee-self-service/index.js`**
   - Isolated Cloud Functions
   - sendCredentials, generateCredentials, bulkSendCredentials

5. **`src/modules/employee-self-service/README.md`**
   - Complete documentation
   - API reference, troubleshooting, examples

6. **`functions/employee-self-service/package.json`**
   - Module dependencies
   - Deployment scripts

---

## 🔄 Modified Files:

**`functions/index.js`** - Added export:
```javascript
// Import employee self-service functions (isolated module)
const {
  sendCredentials,
  generateCredentials,
  bulkSendCredentials
} = require('./employee-self-service/index.js');

// Export with namespace
exports.employeeSelfService = {
  sendCredentials,
  generateCredentials,
  bulkSendCredentials
};
```

---

## 🚀 Next Steps

1. **Test the standalone page:**
   ```
   https://aiclock-3e78b.web.app/pages/employee-credentials.html
   ```

2. **Deploy Cloud Functions:**
   ```bash
   firebase deploy --only functions:employeeSelfService
   ```

3. **Test sending credentials:**
   - Open credentials page
   - Click "Generate" for an employee
   - Click "WhatsApp" or "Email" to send

4. **Test employee login:**
   - Go to employee-login.html
   - Use generated credentials
   - Should access employee portal

5. **Integrate into your workflow:**
   - Add link in business dashboard
   - Or embed UI component
   - Or add buttons to employee edit modal

---

## 🎨 Customization

### Change WhatsApp Message Template

Edit `functions/employee-self-service/index.js`:

```javascript
function formatCredentialsMessage(credentials, businessId) {
  return {
    text: `Your custom message here...
    
Username: ${credentials.username}
Password: ${credentials.password}
...`
  };
}
```

### Change Email Template

Edit the HTML in `formatCredentialsMessage()`:

```javascript
html: `
<html>
  <body>
    <!-- Your custom HTML template -->
  </body>
</html>`
```

### Add Custom Styling

Edit `credentials-ui.js` styles:

```javascript
renderCredentialsPanel() {
  return `
    <style>
      /* Your custom CSS here */
      .credentials-management-panel {
        /* Custom styles */
      }
    </style>
    ...
  `;
}
```

---

## 📱 Mobile Optimization

The UI is already mobile-responsive with:
- Flexible layouts
- Touch-friendly buttons (min 48px)
- Responsive font sizes
- Scrollable tables

---

## 🔐 Security Checklist

Before production:

- [ ] Hash passwords using bcrypt
- [ ] Add rate limiting to login endpoint
- [ ] Enable HTTPS only
- [ ] Add credential expiry
- [ ] Implement password reset flow
- [ ] Add two-factor authentication (optional)
- [ ] Set up email service (SendGrid/Mailgun)
- [ ] Test WhatsApp delivery thoroughly
- [ ] Add audit logging
- [ ] Review CORS settings

---

## 💡 Pro Tips

1. **Bulk Setup:** Generate credentials for all employees at once:
   ```javascript
   const employees = await credentialsUI.loadEmployees();
   for (const emp of employees.filter(e => !e.hasPassword)) {
     await credentialsUI.generateAndShow(emp.slot);
   }
   ```

2. **Auto-send on creation:** Modify employee creation to auto-generate and send credentials

3. **QR Codes:** Add QR code generation for easy credential sharing

4. **Print Cards:** Generate printable credential cards for employees

---

That's it! The system is ready to use. 🎉
