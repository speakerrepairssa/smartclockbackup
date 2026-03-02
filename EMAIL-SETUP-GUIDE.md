# Email Setup Guide for Payslips

The payslips service now uses Gmail SMTP to send emails. Follow these steps to configure it.

## Option 1: Gmail with App Password (Recommended for Testing)

### Step 1: Create Gmail App Password

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** > **2-Step Verification** (enable if not already)
3. Scroll down to **App passwords**
4. Create a new app password:
   - Select app: **Mail**
   - Select device: **Other (Custom name)** → Enter "AIClock Payslips"
5. Copy the 16-character password (like `abcd efgh ijkl mnop`)

### Step 2: Configure Firebase Functions

```bash
# Set email credentials (from your aiclock directory)
firebase functions:config:set \
  email.user="your-email@gmail.com" \
  email.password="abcd efgh ijkl mnop"

# View current config
firebase functions:config:get

# Deploy payslips service with new config
./deploy-payslips.sh
```

### Step 3: Test Email Sending

1. Go to your dashboard: https://aiclock-82608.web.app
2. Navigate to **Payslips** section
3. Create a payslip and send to a test employee
4. Check the employee's email inbox

---

## Option 2: Other Email Services (Production)

For production use, consider these professional alternatives:

### SendGrid (12,000 emails/month free)
```bash
npm install @sendgrid/mail --prefix functions/payslips-service
firebase functions:config:set sendgrid.api_key="YOUR_API_KEY"
```

### Mailgun (5,000 emails/month free)
```bash
npm install mailgun-js --prefix functions/payslips-service
firebase functions:config:set \
  mailgun.api_key="YOUR_API_KEY" \
  mailgun.domain="YOUR_DOMAIN"
```

### AWS SES (62,000 emails/month free)
```bash
npm install @aws-sdk/client-ses --prefix functions/payslips-service
firebase functions:config:set \
  aws.access_key="YOUR_ACCESS_KEY" \
  aws.secret_key="YOUR_SECRET_KEY" \
  aws.region="us-east-1"
```

---

## Email Configuration Status

### Current Setup
- **Service**: Gmail SMTP (nodemailer)
- **Status**: ⚠️ Not configured yet
- **Required**: EMAIL_USER and EMAIL_PASSWORD environment variables

### To Check Configuration
```bash
# View current email config
firebase functions:config:get email

# View logs to see email sending status
firebase functions:log --only payslips-service
```

---

## Troubleshooting

### "Email credentials not configured"
- Run: `firebase functions:config:set email.user="..." email.password="..."`
- Then deploy: `./deploy-payslips.sh`

### "Invalid login" or "Authentication failed"
- Make sure you're using an **App Password**, not your regular Gmail password
- Enable 2-Step Verification in your Google Account first
- Generate a new app password if needed

### Emails not arriving
- Check spam/junk folder
- Verify employee email addresses are correct
- Check Firebase logs: `firebase functions:log --only payslips-service`
- Gmail has sending limits (500 emails/day for free accounts)

### Gmail Daily Limit Reached
Switch to a professional service:
- SendGrid: 100 emails/day free, then $14.95/mo for 40k
- Mailgun: 5,000 emails/month free
- AWS SES: $0.10 per 1,000 emails

---

## Testing Email Setup

### Quick Test
```bash
# Send a test payslip to yourself
curl -X POST https://sendpayslips-4q7htrps4q-uc.a.run.app \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "your-business-id",
    "templateId": "your-template-id",
    "employees": ["employee-id"],
    "delivery": {
      "email": true,
      "whatsapp": false
    },
    "emailSubject": "Test Payslip"
  }'
```

### Check Logs
```bash
firebase functions:log --only payslips-service --limit 20
```

---

## Security Notes

- **Never commit** email credentials to Git
- Use Firebase environment config (encrypted storage)
- For production, use a dedicated email service account
- Consider rate limiting to prevent abuse
- Monitor sending quotas

---

## Production Checklist

- [ ] Email credentials configured in Firebase
- [ ] Test email sent successfully
- [ ] Spam folder checked
- [ ] Professional "from" address set up
- [ ] Email templates tested with different data
- [ ] Daily sending limits understood
- [ ] Monitoring/logging set up
- [ ] Backup email service configured (if primary fails)

---

## Summary

**Current Status**: Email service configured with nodemailer + Gmail SMTP

**Next Steps**:
1. Create Gmail App Password
2. Run: `firebase functions:config:set email.user="..." email.password="..."`
3. Deploy: `./deploy-payslips.sh`
4. Test sending a payslip

**For help**: Check Firebase logs or see troubleshooting section above
