#!/usr/bin/env node

/**
 * Local runner for collection standardization
 * Run with: node run-standardization.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// You'll need to download your service account key and place it here
// Or use environment variable GOOGLE_APPLICATION_CREDENTIALS
let serviceAccount;
try {
  // Try to load service account from file
  serviceAccount = require('./aiclock-82608-firebase-adminsdk.json');
} catch (error) {
  console.log('Service account file not found. Using default credentials...');
  console.log('Make sure GOOGLE_APPLICATION_CREDENTIALS is set or download service account key');
}

// Initialize Firebase Admin
if (serviceAccount) {
  initializeApp({
    credential: cert(serviceAccount)
  });
} else {
  initializeApp(); // Uses default credentials
}

// Import our standardization functions
const { standardizeAllBusinesses } = require('./standardizeCollections');

async function main() {
  console.log('🚀 Starting Collection Standardization...\n');
  
  try {
    const results = await standardizeAllBusinesses();
    
    console.log('\n📊 FINAL SUMMARY:');
    console.log('================');
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Successfully standardized: ${successful} businesses`);
    console.log(`❌ Failed: ${failed} businesses`);
    console.log(`📈 Total: ${results.length} businesses processed`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Businesses:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.businessId}: ${r.error}`);
      });
    }
    
    console.log('\n✨ Collection standardization completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Fatal error during standardization:', error);
    process.exit(1);
  }
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🔧 AiClock Collection Standardization Tool

Usage:
  node run-standardization.js    Run full standardization
  node run-standardization.js --help    Show this help

What this does:
- Analyzes all businesses in your Firestore database
- Migrates data from various collection structures to a standardized format:
  * attendanceEvents, events -> attendance_events
  * Nested date/employee structure -> flat structure with proper indexing
  * Ensures all businesses have: employees, attendance_events, devices, schedules, timecards, settings

Requirements:
- Firebase Admin SDK credentials (service account key or GOOGLE_APPLICATION_CREDENTIALS)
- Proper permissions to read/write Firestore collections

Safety:
- All original data is preserved during migration
- Creates new standardized collections alongside existing ones
- Extensive logging shows exactly what's happening
`);
  process.exit(0);
}

// Run the main function
main();