# Professional Payslip Template System

## Overview

A complete visual payslip editor similar to SimplePay and other professional payroll services. Create beautiful, branded payslips with an easy-to-use interface.

## ✨ Features

### 🎨 Visual Template Editor
- **4 Tabs**: Company Info, Styling, Sections, Messages
- **Live Preview**: See changes instantly
- **Professional Design**: Clean, modern HTML templates
- **Fully Customizable**: Colors, logos, sections, messages

### 📋 Template Sections
- Company Header (logo, name, contact details)
- Employee Information (name, position, ID, pay rate)
- Pay Period (month, year, pay date)
- Earnings Breakdown (regular + overtime hours with rates)
- Deductions (tax, UIF, other)
- Payment Summary (total hours, gross pay, net pay)
- Footer (legal disclaimer and custom messages)

### 🎯 Key Capabilities
- Toggle sections on/off
- Custom brand colors
- Company logo support
- Custom messages
- Responsive design
- Print-friendly
- Email-ready HTML

## 📁 Files Created

```
src/modules/payslips/
├── default-template.js      # Professional HTML template definition
├── template-editor.html     # Visual editor UI
├── template-editor.js       # Editor controller logic
├── payslips.html           # Updated main UI
└── payslips.js            # Updated module integration
```

## 🚀 How It Works

### 1. Company Info Tab
Set up your business details:
- Company name
- Address
- Phone & email
- Tax number
- Registration number
- Logo URL

### 2. Styling Tab
Customize the appearance:
- **Primary Color**: Header background
- **Secondary Color**: Text and labels
- **Show Logo**: Toggle logo display
- **Show Company Details**: Toggle contact info

### 3. Sections Tab
Choose what to include:
- ✅ Company Header (always on)
- ✅ Employee Information
- ✅ Pay Period
- ✅ Earnings Breakdown
- ✅ Deductions
- ✅ Payment Summary
- ✅ Footer

### 4. Messages Tab
Add custom text:
- **Header Message**: Optional message at top
- **Footer Message**: Legal disclaimer
- **Email Subject**: With template variables

## 📊 Template Variables

Available in subject and messages:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{employeeName}}` | Employee's name | "John Doe" |
| `{{position}}` | Job title | "Cashier" |
| `{{employeeId}}` | Employee ID | "EMP001" |
| `{{payRate}}` | Hourly rate | "25.00" |
| `{{month}}` | Month name | "February" |
| `{{year}}` | Year | "2026" |
| `{{period}}` | YYYY-MM format | "2026-02" |
| `{{payDate}}` | Pay date | "28 February 2026" |
| `{{hoursWorked}}` | Total hours | "176.00" |
| `{{regularHours}}` | Regular hours (≤160) | "160.00" |
| `{{overtimeHours}}` | Overtime hours (>160) | "16.00" |
| `{{regularPay}}` | Regular pay amount | "4000.00" |
| `{{overtimePay}}` | Overtime pay (1.5x) | "600.00" |
| `{{grossPay}}` | Total before deductions | "4600.00" |
| `{{deductions}}` | Total deductions | "460.00" |
| `{{netPay}}` | Final pay amount | "4140.00" |
| `{{businessName}}` | Company name | "Speaker Repairs" |

## 🎨 Example Template

Here's what a standard payslip looks like:

```
┌─────────────────────────────────────────┐
│        [LOGO]  COMPANY NAME             │
│    123 Business St | Tel: 012 345 6789 │
│         Tax No: 9001234567              │
│              PAYSLIP                    │
└─────────────────────────────────────────┘

EMPLOYEE INFORMATION
─────────────────────────────────────────
Name: John Doe             Position: Cashier
Employee ID: EMP001        Pay Rate: R 25.00/hour

PAY PERIOD
─────────────────────────────────────────
Period: February 2026      Pay Date: 28 Feb 2026

EARNINGS
─────────────────────────────────────────
Description         Hours    Rate      Amount
Regular Hours       160.00   R 25.00   R 4000.00
Overtime Hours      16.00    R 37.50   R 600.00
Total Earnings                         R 4600.00

DEDUCTIONS
─────────────────────────────────────────
Total Deductions                       R 460.00

PAYMENT SUMMARY
─────────────────────────────────────────
Total Hours: 176.00h
Gross Pay: R 4600.00
Deductions: R 460.00

NET PAY: R 4140.00
═════════════════════════════════════════

This is a computer-generated payslip.
No signature is required.
```

## 💾 Data Storage

Templates are stored in Firestore:

```javascript
businesses/{businessId}/payslip_templates/{templateId}
{
  name: "Professional Payslip",
  subject: "Your Payslip for {{month}} {{year}}",
  companyName: "Your Company",
  companyAddress: "123 Business St...",
  companyPhone: "+27 12 345 6789",
  companyEmail: "info@company.com",
  companyLogo: "https://...",
  taxNumber: "9001234567",
  registrationNumber: "2024/123456/07",
  primaryColor: "#2563eb",
  secondaryColor: "#64748b",
  showLogo: true,
  showCompanyDetails: true,
  sections: {
    companyHeader: true,
    employeeDetails: true,
    payPeriod: true,
    earnings: true,
    deductions: true,
    summary: true,
    footer: true
  },
  headerMessage: "Thank you for your dedication...",
  footerMessage: "This is a computer-generated payslip...",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## 🔧 Technical Details

### Template Generation

The template is generated as complete HTML with embedded CSS:

```javascript
import { createPayslipTemplate } from './default-template.js';

const template = createPayslipTemplate({
  companyName: "Speaker Repairs",
  primaryColor: "#2563eb",
  // ... other config
});

const html = template.generateHTML(employeeData);
```

### Live Preview

The editor uses an iframe to show real-time preview:

```javascript
// Update preview with sample data
const sampleData = {
  employeeName: 'John Doe',
  payRate: '25.00',
  // ... other sample values
};

const filledHtml = template.generateHTML(sampleData);
previewFrame.contentDocument.write(filledHtml);
```

### Email Delivery

Generated HTML can be sent directly via email or converted to PDF for WhatsApp.

## 🚦 Next Steps

### To Use the New System:

1. **Navigate to Payslips** in the dashboard sidebar
2. **Create New Template** - Click "+ New" button
3. **Fill in Company Info** - Add your business details
4. **Customize Styling** - Choose brand colors
5. **Toggle Sections** - Enable/disable sections as needed
6. **Add Messages** - Customize header and footer text
7. **Save Template** - Click "💾 Save"
8. **Select Employees** - Choose who to send payslips to
9. **Send or Schedule** - Deliver immediately or schedule for later

### Integration with Isolated Service:

The template HTML is passed to the isolated `sendPayslips` function:

```javascript
const config = this.templateEditor.getConfig();
const html = template.generateHTML(sampleData);

// Send to isolated payslips service
await fetch('https://us-central1-aiclock-82608.cloudfunctions.net/sendPayslips', {
  method: 'POST',
  body: JSON.stringify({
    businessId: this.businessId,
    employeeIds: selectedEmployees,
    templateHtml: html,
    templateConfig: config,
    deliveryMethods: { email: true, whatsapp: true }
  })
});
```

## 📱 Mobile Responsive

The payslip template is fully responsive and looks great on:
- Desktop (optimal)
- Tablet
- Mobile (stacked layout)
- Print (clean, professional)

## 🎯 Benefits Over Plain Text

| Before (Plain Text) | After (Professional Template) |
|---------------------|-------------------------------|
| ❌ Plain text only | ✅ Beautiful HTML with styling |
| ❌ Manual formatting | ✅ Automatic professional layout |
| ❌ No branding | ✅ Custom colors and logo |
| ❌ Fixed sections | ✅ Toggle sections on/off |
| ❌ No preview | ✅ Live preview while editing |
| ❌ Hard to customize | ✅ Visual editor, easy changes |

## 🔒 Security

- Template stored securely in Firestore
- No sensitive data in template (only structure)
- Employee data merged at generation time
- Isolated Cloud Function for sending

## 📝 Notes

- Logo must be hosted externally (URL)
- Maximum logo size: 150px width
- Colors in hex format (#RRGGBB)
- All amounts displayed in South African Rand (R)
- Overtime calculated at 1.5x rate for hours >160/month

---

**Status**: ✅ Complete and ready to use
**Integration**: Works with isolated payslips-service
**Compatibility**: All modern browsers
**Next Enhancement**: PDF generation for offline sharing
