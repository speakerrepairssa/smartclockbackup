/**
 * ⚡ ISOLATED CACHE CALCULATION CLOUD FUNCTION ⚡
 * 
 * This is a completely separate Cloud Function dedicated ONLY to cache calculation.
 * It's isolated from other functions to prevent updates from breaking the cache system.
 * 
 * Deploy separately: firebase deploy --only functions:cacheCalculation
 */

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Import the calculation logic
const { calculateAndCacheAssessment } = require('./cacheCalculation.js');

/**
 * 📊 UPDATE ASSESSMENT CACHE
 * Calculates and stores payroll assessment data in Firestore cache
 * 
 * GET/POST /cacheCalculation?businessId=xxx&month=2026-02&requiredHours=176
 */
exports.cacheCalculation = onRequest({ 
  invoker: 'public',
  cors: true,
  maxInstances: 10,
  memory: '256MiB',
  timeoutSeconds: 60
}, async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { businessId, month, requiredHours } = req.query;
    
    // Validate required parameters
    if (!businessId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required parameter: businessId',
        usage: 'GET/POST /cacheCalculation?businessId=biz_machine_2&month=2026-02&requiredHours=176'
      });
    }

    // Default to current month if not specified
    const targetMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM format
    const requiredHoursPerMonth = requiredHours ? parseInt(requiredHours) : 176;
    
    logger.info("📊 Starting assessment calculation", { 
      businessId, 
      targetMonth, 
      requiredHoursPerMonth 
    });
    
    // Run the calculation
    const result = await calculateAndCacheAssessment(businessId, targetMonth, requiredHoursPerMonth);
    
    logger.info("✅ Cache calculation completed", {
      businessId,
      employees: result.employees?.length || 0
    });
    
    // Return success response
    res.json({
      success: true,
      message: 'Assessment cache updated successfully',
      businessId,
      month: targetMonth,
      requiredHours: requiredHoursPerMonth,
      employeesCalculated: result.employees?.length || 0,
      lastUpdated: result.lastUpdated,
      summary: result.summary
    });

  } catch (error) {
    logger.error("❌ Cache calculation failed", {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
