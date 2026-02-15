/**
 * Isolated Payslips Service
 * Completely separate deployment to protect payslip generation from unrelated code changes
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// Initialize Firebase Admin (only if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

const { sendPayslips, processScheduledPayslips } = require("./payslipsModule");

// Export the HTTP function
exports.sendPayslips = sendPayslips;

// Export the scheduled function
exports.processScheduledPayslips = processScheduledPayslips;
