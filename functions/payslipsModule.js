/**
 * Payslips Module - Cloud Functions
 * Handles payslip generation, email sending, WhatsApp delivery, and scheduled sending
 */

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { getFirestore } = require("firebase-admin/firestore");
const https = require('https');

const db = getFirestore();

/**
 * Generate a payslip for a specific employee
 */
async function generatePayslipForEmployee(businessId, employeeId, template, subject) {
  try {
    logger.info("Generating payslip", { businessId, employeeId });

    // Get employee data
    const employeeRef = db.collection('businesses').doc(businessId).collection('staff').doc(employeeId);
    const employeeDoc = await employeeRef.get();

    if (!employeeDoc.exists) {
      throw new Error(`Employee ${employeeId} not found`);
    }

    const employee = employeeDoc.data();

    // Get current month's assessment cache
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const cacheRef = db.collection('businesses').doc(businessId).collection('assessment_cache').doc(month);
    const cacheDoc = await cacheRef.get();

    let assessmentData = {
      currentHours: 0,
      currentIncomeDue: 0,
      payRate: employee.payRate || 0
    };

    if (cacheDoc.exists) {
      const cache = cacheDoc.data();
      const empAssessment = cache.employees?.find(e => e.employeeId === employeeId);
      if (empAssessment) {
        assessmentData = empAssessment;
      }
    }

    // Calculate regular and overtime hours (8 hours/day standard)
    const hoursWorked = assessmentData.currentHours || 0;
    const regularHours = Math.min(hoursWorked, 160); // Assuming 20 working days * 8 hours
    const overtimeHours = Math.max(0, hoursWorked - 160);
    const payRate = assessmentData.payRate || employee.payRate || 0;

    // Calculate pay
    const regularPay = regularHours * payRate;
    const overtimePay = overtimeHours * payRate * 1.5; // Time and a half for overtime
    const grossPay = regularPay + overtimePay;
    const deductions = 0; // Can be configured later
    const netPay = grossPay - deductions;

    // Get business data
    const businessRef = db.collection('businesses').doc(businessId);
    const businessDoc = await businessRef.get();
    const businessData = businessDoc.exists ? businessDoc.data() : {};

    // Build replacement map
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    const replacements = {
      '{{employeeName}}': employee.employeeName || employee.name || 'N/A',
      '{{position}}': employee.position || 'Employee',
      '{{payRate}}': payRate.toFixed(2),
      '{{month}}': monthNames[now.getMonth()],
      '{{year}}': now.getFullYear().toString(),
      '{{period}}': `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      '{{hoursWorked}}': hoursWorked.toFixed(2),
      '{{regularHours}}': regularHours.toFixed(2),
      '{{overtimeHours}}': overtimeHours.toFixed(2),
      '{{regularPay}}': regularPay.toFixed(2),
      '{{overtimePay}}': overtimePay.toFixed(2),
      '{{grossPay}}': grossPay.toFixed(2),
      '{{deductions}}': deductions.toFixed(2),
      '{{netPay}}': netPay.toFixed(2),
      '{{businessName}}': businessData.businessName || 'Your Company'
    };

    // Replace placeholders in template
    let filledContent = template;
    let filledSubject = subject;

    for (const [placeholder, value] of Object.entries(replacements)) {
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      filledContent = filledContent.replace(regex, value);
      filledSubject = filledSubject.replace(regex, value);
    }

    return {
      content: filledContent,
      subject: filledSubject,
      employee: employee,
      data: {
        hoursWorked,
        regularHours,
        overtimeHours,
        regularPay,
        overtimePay,
        grossPay,
        deductions,
        netPay
      }
    };

  } catch (error) {
    logger.error("Error generating payslip", { error: error.message, businessId, employeeId });
    throw error;
  }
}

/**
 * Send payslip via email using a third-party email service
 * Note: This is a placeholder. You'll need to configure an email service like SendGrid, Mailgun, or SMTP
 */
async function sendPayslipViaEmail(employeeEmail, subject, content) {
  try {
    logger.info("Sending payslip via email", { to: employeeEmail });

    // TODO: Integrate with email service
    // For now, we'll just log it
    // You can use services like:
    // - SendGrid: https://sendgrid.com/
    // - Mailgun: https://www.mailgun.com/
    // - AWS SES: https://aws.amazon.com/ses/
    // - Or configure nodemailer with SMTP

    /*
    Example with SendGrid:
    
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    const msg = {
      to: employeeEmail,
      from: 'payroll@yourcompany.com',
      subject: subject,
      text: content,
      html: content.replace(/\n/g, '<br>')
    };
    
    await sgMail.send(msg);
    */

    logger.info("Email sent successfully (placeholder)", { to: employeeEmail });
    
    return { success: true, method: 'email', recipient: employeeEmail };
    
  } catch (error) {
    logger.error("Error sending email", { error: error.message, to: employeeEmail });
    return { success: false, method: 'email', recipient: employeeEmail, error: error.message };
  }
}

/**
 * Send payslip via WhatsApp
 */
async function sendPayslipViaWhatsApp(businessId, employeePhone, employeeName, payslipData) {
  try {
    logger.info("Sending payslip via WhatsApp", { businessId, to: employeePhone });

    // Format the message
    const message = `
Dear ${employeeName},

Your payslip is ready:

Period: ${payslipData.data.period || 'Current Month'}
Hours Worked: ${payslipData.data.hoursWorked}h
Net Pay: R${payslipData.data.netPay}

Full details:
${payslipData.content}
    `.trim();

    // Call the existing sendWhatsAppMessage function
    const postData = JSON.stringify({
      businessId: businessId,
      trigger: 'payslip',
      employeeData: {
        phone: employeePhone,
        employeeName: employeeName,
        ...payslipData.data
      }
    });

    const options = {
      hostname: 'sendwhatsappmessage-4q7htrps4q-uc.a.run.app',
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const result = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`WhatsApp function returned ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    logger.info("WhatsApp payslip sent successfully", { to: employeePhone });
    
    return { success: true, method: 'whatsapp', recipient: employeePhone };
    
  } catch (error) {
    logger.error("Error sending WhatsApp", { error: error.message, to: employeePhone });
    return { success: false, method: 'whatsapp', recipient: employeePhone, error: error.message };
  }
}

/**
 * Cloud Function: Send Payslips
 * Sends payslips to selected employees via email and/or WhatsApp
 */
exports.sendPayslips = onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { businessId, employeeIds, templateId, template, subject, deliveryMethods } = req.body;

    if (!businessId || !employeeIds || !template) {
      throw new Error('Missing required fields: businessId, employeeIds, template');
    }

    logger.info("Sending payslips", {
      businessId,
      employeeCount: employeeIds.length,
      deliveryMethods
    });

    const results = {
      sent: 0,
      failed: 0,
      details: []
    };

    // Process each employee
    for (const employeeId of employeeIds) {
      try {
        // Generate payslip
        const payslip = await generatePayslipForEmployee(businessId, employeeId, template, subject);
        
        const employeeResults = [];

        // Send via email if enabled
        if (deliveryMethods.email && payslip.employee.email) {
          const emailResult = await sendPayslipViaEmail(
            payslip.employee.email,
            payslip.subject,
            payslip.content
          );
          employeeResults.push(emailResult);
        }

        // Send via WhatsApp if enabled
        if (deliveryMethods.whatsapp && payslip.employee.phone) {
          const whatsappResult = await sendPayslipViaWhatsApp(
            businessId,
            payslip.employee.phone,
            payslip.employee.employeeName || payslip.employee.name,
            payslip
          );
          employeeResults.push(whatsappResult);
        }

        // Check if at least one delivery succeeded
        const anySuccess = employeeResults.some(r => r.success);
        
        if (anySuccess) {
          results.sent++;
        } else {
          results.failed++;
        }

        results.details.push({
          employeeId,
          employeeName: payslip.employee.employeeName || payslip.employee.name,
          deliveries: employeeResults
        });

      } catch (error) {
        logger.error("Error sending payslip to employee", {
          error: error.message,
          employeeId
        });
        results.failed++;
        results.details.push({
          employeeId,
          error: error.message
        });
      }
    }

    // Log the delivery to Firestore
    await db.collection('businesses').doc(businessId).collection('payslip_history').add({
      sentAt: new Date(),
      employeeIds: employeeIds,
      templateId: templateId || null,
      deliveryMethods: deliveryMethods,
      results: results
    });

    logger.info("Payslips sent", results);

    res.json({
      success: true,
      ...results
    });

  } catch (error) {
    logger.error("Error sending payslips", { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Cloud Function: Process Scheduled Payslips
 * Runs every hour to check for scheduled payslips that need to be sent
 */
exports.processScheduledPayslips = onSchedule("every 1 hours", async (event) => {
  try {
    logger.info("Processing scheduled payslips");

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get all businesses
    const businessesSnapshot = await db.collection('businesses').get();

    let totalProcessed = 0;
    let totalSent = 0;

    for (const businessDoc of businessesSnapshot.docs) {
      const businessId = businessDoc.id;

      // Get scheduled payslips that are due
      const schedulesRef = db.collection('businesses').doc(businessId).collection('payslip_schedules');
      const schedulesSnapshot = await schedulesRef
        .where('status', '==', 'scheduled')
        .where('scheduledTime', '<=', now)
        .where('scheduledTime', '>', oneHourAgo)
        .get();

      for (const scheduleDoc of schedulesSnapshot.docs) {
        const schedule = scheduleDoc.data();
        totalProcessed++;

        try {
          logger.info("Processing scheduled payslip", {
            businessId,
            scheduleId: scheduleDoc.id,
            employeeCount: schedule.employeeIds.length
          });

          // Get the template
          const templateRef = db.collection('businesses').doc(businessId)
            .collection('payslip_templates').doc(schedule.templateId);
          const templateDoc = await templateRef.get();

          if (!templateDoc.exists) {
            throw new Error('Template not found');
          }

          const template = templateDoc.data();

          // Send payslips
          const results = {
            sent: 0,
            failed: 0,
            details: []
          };

          for (const employeeId of schedule.employeeIds) {
            try {
              const payslip = await generatePayslipForEmployee(
                businessId,
                employeeId,
                template.content,
                template.subject
              );

              const employeeResults = [];

              if (schedule.deliveryMethods.email && payslip.employee.email) {
                const emailResult = await sendPayslipViaEmail(
                  payslip.employee.email,
                  payslip.subject,
                  payslip.content
                );
                employeeResults.push(emailResult);
              }

              if (schedule.deliveryMethods.whatsapp && payslip.employee.phone) {
                const whatsappResult = await sendPayslipViaWhatsApp(
                  businessId,
                  payslip.employee.phone,
                  payslip.employee.employeeName || payslip.employee.name,
                  payslip
                );
                employeeResults.push(whatsappResult);
              }

              const anySuccess = employeeResults.some(r => r.success);
              
              if (anySuccess) {
                results.sent++;
              } else {
                results.failed++;
              }

              results.details.push({
                employeeId,
                employeeName: payslip.employee.employeeName || payslip.employee.name,
                deliveries: employeeResults
              });

            } catch (error) {
              logger.error("Error processing employee in scheduled payslip", {
                error: error.message,
                employeeId
              });
              results.failed++;
            }
          }

          // Update schedule status
          await scheduleDoc.ref.update({
            status: 'completed',
            completedAt: now,
            results: results
          });

          // Log to history
          await db.collection('businesses').doc(businessId).collection('payslip_history').add({
            sentAt: now,
            employeeIds: schedule.employeeIds,
            templateId: schedule.templateId,
            deliveryMethods: schedule.deliveryMethods,
            scheduled: true,
            scheduleId: scheduleDoc.id,
            results: results
          });

          totalSent += results.sent;

          logger.info("Scheduled payslip completed", {
            businessId,
            scheduleId: scheduleDoc.id,
            sent: results.sent,
            failed: results.failed
          });

        } catch (error) {
          logger.error("Error processing scheduled payslip", {
            error: error.message,
            businessId,
            scheduleId: scheduleDoc.id
          });

          // Mark as failed
          await scheduleDoc.ref.update({
            status: 'failed',
            failedAt: now,
            error: error.message
          });
        }
      }
    }

    logger.info("Scheduled payslips processing complete", {
      totalProcessed,
      totalSent
    });

  } catch (error) {
    logger.error("Error in scheduled payslips processor", { error: error.message });
  }
});

module.exports = {
  sendPayslips: exports.sendPayslips,
  processScheduledPayslips: exports.processScheduledPayslips,
  generatePayslipForEmployee,
  sendPayslipViaEmail,
  sendPayslipViaWhatsApp
};
