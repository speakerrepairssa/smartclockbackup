# Isolated Payslips Service

## Purpose

This is a **completely isolated** Cloud Function deployment for payslip generation and sending. It's separated from the main functions to:

- ✅ **Protect against breaking changes** in other functions
- ✅ **Independent deployment** without affecting other services
- ✅ **Clear responsibility** for payroll operations
- ✅ **Easier debugging** when payslips have issues

## Architecture

```
functions/payslips-service/
├── index.js              # HTTP endpoint
├── payslipsModule.js     # Core payslip logic
├── package.json          # Minimal dependencies
└── README.md             # This file
```

## Key Features

### Payslip Generation
- Reads employee data from Firestore
- Fetches hours worked from assessment cache
- Calculates regular and overtime pay
- Supports template variables: `{{employeeName}}`, `{{hoursWorked}}`, `{{netPay}}`, etc.

### Delivery Methods
- **Email**: Placeholder (needs SendGrid/Mailgun integration)
- **WhatsApp**: Calls `sendWhatsAppMessage` function

### Break Protection
- Only deducts break time if worked >= 2 hours
- Prevents negative payable hours
- Respects shift schedules

## API Endpoint

```
POST https://us-central1-aiclock-82608.cloudfunctions.net/sendPayslips
```

### Request Body
```json
{
  "businessId": "biz_speaker_repairs",
  "employeeIds": ["az8", "az12"],
  "templateId": "template_123",
  "template": "Dear {{employeeName}},\n\nYou worked {{hoursWorked}} hours...",
  "subject": "Your Payslip for {{month}} {{year}}",
  "deliveryMethods": {
    "email": true,
    "whatsapp": true
  }
}
```

### Response
```json
{
  "success": true,
  "sent": 2,
  "failed": 0,
  "details": [
    {
      "employeeId": "az8",
      "employeeName": "John Doe",
      "deliveries": [
        { "success": true, "method": "email" },
        { "success": true, "method": "whatsapp" }
      ]
    }
  ]
}
```

## Deployment

This function is deployed **separately** via firebase.json:

```json
{
  "functions": [
    {
      "source": "functions/payslips-service",
      "codebase": "payslips-service"
    }
  ]
}
```

Deploy with:
```bash
firebase deploy --only functions:payslips-service
```

Or deploy all codebases:
```bash
firebase deploy --only functions
```

## Template Variables

Available in template content and subject:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{employeeName}}` | Employee's name | "John Doe" |
| `{{position}}` | Job title | "Cashier" |
| `{{payRate}}` | Hourly rate | "25.00" |
| `{{month}}` | Current month name | "February" |
| `{{year}}` | Current year | "2026" |
| `{{period}}` | Period in YYYY-MM | "2026-02" |
| `{{hoursWorked}}` | Total hours worked | "1.39" |
| `{{regularHours}}` | Regular hours (≤160) | "1.39" |
| `{{overtimeHours}}` | Overtime hours (>160) | "0.00" |
| `{{regularPay}}` | Regular pay amount | "34.75" |
| `{{overtimePay}}` | Overtime pay amount | "0.00" |
| `{{grossPay}}` | Total before deductions | "34.75" |
| `{{deductions}}` | Total deductions | "0.00" |
| `{{netPay}}` | Final pay amount | "34.75" |
| `{{businessName}}` | Company name | "Speaker Repairs" |

## How It Works

1. **Generate Payslip**: For each employee, read staff data and assessment cache
2. **Calculate Pay**: Regular hours (≤160) + overtime (>160) at 1.5x rate
3. **Fill Template**: Replace all `{{variables}}` with actual values
4. **Send**: Deliver via email and/or WhatsApp
5. **Log**: Record delivery results to `payslip_history` collection

## Testing

Test with curl:
```bash
curl -X POST https://us-central1-aiclock-82608.cloudfunctions.net/sendPayslips \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "biz_speaker_repairs",
    "employeeIds": ["az8"],
    "template": "Dear {{employeeName}}, you worked {{hoursWorked}} hours.",
    "subject": "Your Payslip",
    "deliveryMethods": {
      "email": false,
      "whatsapp": true
    }
  }'
```

## Future Improvements

- [ ] Email integration (SendGrid/Mailgun)
- [ ] PDF generation for payslips
- [ ] Configurable overtime thresholds
- [ ] Multiple pay rates (weekend, holiday)
- [ ] Tax calculations
- [ ] Deduction management
- [ ] Multi-currency support

## Maintenance

This function is **isolated** from other code. When making changes:

1. Edit files in `functions/payslips-service/`
2. Test locally if possible
3. Deploy with `firebase deploy --only functions:payslips-service`
4. Check Cloud Function logs for errors

## Logs

View logs:
```bash
gcloud logging read "resource.labels.function_name=sendPayslips" \
  --limit 50 --format json --project aiclock-82608
```
