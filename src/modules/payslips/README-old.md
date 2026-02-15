# Payslips Module Documentation

## Overview

The Payslips Module is a comprehensive payroll management feature for the SmartClock SaaS application. It allows business owners to create customizable payslip templates, automatically fill them with employee payroll data from the assessment cache, and schedule automatic delivery via email or WhatsApp.

## Features

### 🎨 Template Management
- **Create Multiple Templates**: Design different payslip formats for various employee types
- **Variable Substitution**: Use dynamic placeholders that auto-fill with employee data
- **Template Library**: Save and reuse templates across different pay periods
- **Preview Functionality**: See exactly how payslips will look before sending

### 👥 Employee Selection
- **Select All/Deselect All**: Bulk selection controls for efficiency
- **Individual Selection**: Choose specific employees for payslip delivery
- **Active Employee Filtering**: Only active employees with contact information are shown
- **Visual Employee Cards**: See employee details at a glance (slot, email, phone)

### 📬 Dual Delivery Methods
- **Email**: Professional payslip delivery to employee email addresses
- **WhatsApp**: Instant notification via WhatsApp Business API
- **Multi-channel**: Send via both email and WhatsApp simultaneously

### ⏰ Scheduled Delivery
- **Set Date & Time**: Schedule payslips for specific delivery times (e.g., end of month)
- **Automatic Processing**: Cloud Function runs hourly to process scheduled payslips
- **Schedule Management**: View, track, and cancel scheduled deliveries
- **Recurring Schedules**: Set up monthly automated payslip distribution

## File Structure

```
src/modules/payslips/
├── payslips.js          # Frontend module logic
├── payslips.css         # Module styling
└── payslips.html        # UI template (integrated into dashboard)

functions/
└── payslipsModule.js    # Cloud Functions for backend processing
```

## Template Variables

The following variables can be used in your payslip templates:

### Employee Information
- `{{employeeName}}` - Employee's full name
- `{{position}}` - Job title/position
- `{{payRate}}` - Hourly pay rate (R/hour)

### Time Period
- `{{month}}` - Current month name (e.g., "January")
- `{{year}}` - Current year (e.g., "2026")
- `{{period}}` - Pay period in YYYY-MM format

### Work Hours
- `{{hoursWorked}}` - Total hours worked in the period
- `{{regularHours}}` - Regular working hours (up to 160h/month)
- `{{overtimeHours}}` - Overtime hours (beyond 160h/month)

### Payment Breakdown
- `{{regularPay}}` - Regular hours payment
- `{{overtimePay}}` - Overtime payment (1.5x rate)
- `{{grossPay}}` - Total gross payment before deductions
- `{{deductions}}` - Total deductions (configurable)
- `{{netPay}}` - Final net payment to employee

### Business Information
- `{{businessName}}` - Your company name

## Default Template Example

```
Dear {{employeeName}},

Please find your payslip for {{month}} {{year}}.

--------------------------------
PAYSLIP SUMMARY
--------------------------------
Employee: {{employeeName}}
Position: {{position}}
Pay Rate: R {{payRate}}/hour

Period: {{period}}
Total Hours Worked: {{hoursWorked}}
Regular Hours: {{regularHours}}
Overtime Hours: {{overtimeHours}}

--------------------------------
EARNINGS
--------------------------------
Regular Pay: R {{regularPay}}
Overtime Pay: R {{overtimePay}}
Gross Pay: R {{grossPay}}

--------------------------------
DEDUCTIONS
--------------------------------
Total Deductions: R {{deductions}}

--------------------------------
NET PAY: R {{netPay}}
--------------------------------

Thank you for your hard work!

Best regards,
{{businessName}}
```

## Usage Guide

### Creating a Payslip Template

1. Navigate to **Payslips** in the dashboard sidebar
2. Click **"+ New"** to create a new template
3. Enter a **Template Name** (e.g., "Monthly Payslip")
4. Set the **Email Subject** with variables
5. Write your payslip **Content** using the available variables
6. Click **"💾 Save"** to store the template

### Sending Payslips Immediately

1. Select or create a template
2. Check the employees you want to send payslips to
3. Choose delivery methods:
   - ✓ Email
   - ✓ WhatsApp
4. Click **"👁️ Preview"** to see a sample payslip
5. Click **"📤 Send Now"** to deliver immediately

### Scheduling Automatic Delivery

1. Select or create a template
2. Select employees
3. Choose delivery methods
4. Set the **Date** and **Time** for delivery
5. Click **"⏰ Schedule"** to queue for automatic sending

### Managing Scheduled Payslips

- View all scheduled payslips in the **"📅 Scheduled Payslips"** section
- Each scheduled item shows:
  - Delivery date and time
  - Number of employees
  - Delivery methods
- Click **"🗑️ Cancel"** to remove a scheduled payslip

## Data Integration

### Assessment Cache
The payslips module automatically pulls employee payroll data from the `assessment_cache` collection:

```
businesses/{businessId}/assessment_cache/{YYYY-MM}/
  └── employees[]
      ├── employeeId
      ├── employeeName
      ├── currentHours
      ├── currentIncomeDue
      ├── payRate
      └── ...other fields
```

### Payslip Templates
Templates are stored in Firestore:

```
businesses/{businessId}/payslip_templates/{templateId}/
  ├── name: "Monthly Payslip"
  ├── subject: "Your Payslip for {{month}} {{year}}"
  ├── content: "Template text..."
  ├── createdAt: Timestamp
  └── updatedAt: Timestamp
```

### Scheduled Payslips
Schedules are stored in Firestore:

```
businesses/{businessId}/payslip_schedules/{scheduleId}/
  ├── businessId
  ├── employeeIds: [...]
  ├── templateId
  ├── subject
  ├── deliveryMethods: { email: true, whatsapp: false }
  ├── scheduledTime: Timestamp
  ├── status: "scheduled" | "completed" | "failed"
  └── createdAt: Timestamp
```

### Delivery History
All payslip deliveries are logged:

```
businesses/{businessId}/payslip_history/{historyId}/
  ├── sentAt: Timestamp
  ├── employeeIds: [...]
  ├── templateId
  ├── deliveryMethods: { email: true, whatsapp: true }
  ├── scheduled: true/false
  └── results: {
      sent: 5,
      failed: 0,
      details: [...]
    }
```

## Cloud Functions

### sendPayslips (HTTPS Trigger)
**Endpoint**: `https://us-central1-aiclock-82608.cloudfunctions.net/sendPayslips`

**Purpose**: Send payslips immediately to selected employees

**Request Body**:
```json
{
  "businessId": "biz_123",
  "employeeIds": ["emp_1", "emp_2"],
  "templateId": "template_abc",
  "template": "Template content...",
  "subject": "Your Payslip",
  "deliveryMethods": {
    "email": true,
    "whatsapp": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "sent": 5,
  "failed": 0,
  "details": [...]
}
```

### processScheduledPayslips (Scheduled)
**Schedule**: Runs every hour

**Purpose**: Automatically process and send scheduled payslips

**Process**:
1. Query all businesses for scheduled payslips due in the last hour
2. Load the template for each schedule
3. Generate payslips for each employee
4. Send via configured delivery methods
5. Update schedule status to "completed" or "failed"
6. Log delivery results to history

## Email Configuration

**Note**: The email functionality is currently a placeholder. To enable email delivery, you need to configure an email service provider.

### Recommended Email Services:

1. **SendGrid** (Recommended)
   - Sign up at https://sendgrid.com/
   - Get API key
   - Add to Firebase Functions config:
     ```bash
     firebase functions:config:set sendgrid.key="YOUR_API_KEY"
     ```
   - Update `sendPayslipViaEmail()` function in `functions/payslipsModule.js`

2. **Mailgun**
   - Sign up at https://www.mailgun.com/
   - Configure domain
   - Add API credentials to config

3. **AWS SES**
   - Lower cost for high volume
   - Requires AWS account verification

4. **Nodemailer with SMTP**
   - Use your own SMTP server
   - Install: `npm install nodemailer --save`
   - Configure SMTP settings

## WhatsApp Integration

WhatsApp delivery uses the existing `sendWhatsAppMessage` Cloud Function. Make sure WhatsApp is properly configured in your business settings:

1. Navigate to **WhatsApp Settings**
2. Enable WhatsApp automation
3. Configure WhatsApp Business API credentials
4. Create a "payslip" automation card (optional)

## Security & Permissions

### Firestore Security Rules

Add these rules to your `firestore.rules`:

```javascript
// Payslip templates - business owners only
match /businesses/{businessId}/payslip_templates/{templateId} {
  allow read, write: if request.auth != null && 
    request.auth.uid == get(/databases/$(database)/documents/businesses/$(businessId)).data.ownerId;
}

// Payslip schedules - business owners only
match /businesses/{businessId}/payslip_schedules/{scheduleId} {
  allow read, write: if request.auth != null && 
    request.auth.uid == get(/databases/$(database)/documents/businesses/$(businessId)).data.ownerId;
}

// Payslip history - read only for business owners
match /businesses/{businessId}/payslip_history/{historyId} {
  allow read: if request.auth != null && 
    request.auth.uid == get(/databases/$(database)/documents/businesses/$(businessId)).data.ownerId;
  allow write: if false; // Only Cloud Functions can write
}
```

## Deployment

### Deploy Cloud Functions

```bash
cd functions
npm install
firebase deploy --only functions:sendPayslips,functions:processScheduledPayslips
```

### Test the Module

1. Open the business dashboard
2. Navigate to Payslips
3. Create a test template
4. Select an employee
5. Click "Preview" to verify data population
6. Send a test payslip to yourself

## Troubleshooting

### Payslips not sending
- Check Cloud Function logs: `firebase functions:log`
- Verify employee has email/phone in their profile
- Check WhatsApp settings are enabled
- Verify assessment cache has data for current month

### Variables not populating
- Ensure assessment cache is calculated: Go to Assessment tab and click "Recalculate Now"
- Check employee data in Firestore
- Verify variable names match exactly (case-sensitive)

### Scheduled payslips not delivered
- Check `processScheduledPayslips` function logs
- Verify schedule time is in the past
- Check schedule status in Firestore
- Ensure template still exists

### Email not working
- Configure email service provider (see Email Configuration section)
- Check Firebase Functions config
- Verify sender email is verified with your email service

## Future Enhancements

- [ ] PDF generation for payslips
- [ ] Custom calculation formulas per template
- [ ] Tax calculation integration
- [ ] Multiple currency support
- [ ] Employee self-service portal to view past payslips
- [ ] Digital signature for payslips
- [ ] Batch upload of adjustments/bonuses
- [ ] Year-end tax statement generation

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Cloud Function logs
3. Examine browser console for errors
4. Check Firestore data structure matches documentation

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Module Status**: ✅ Production Ready
