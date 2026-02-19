/**
 * DIAGNOSTIC SCRIPT - Find Assessment Calculation Error
 * This will help identify why the cloud function is returning 500 errors
 */

const { initializeApp,  cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

async function diagnoseAssessmentError() {
  console.log('='.repeat(60));
  console.log('🔍 DIAGNOSING ASSESSMENT CALCULATION ERROR');
  console.log('='.repeat(60));

  // Test with the actual business ID from the error logs
  const businessId = 'biz_your_business_name';
  const month = '2026-02';

  try {
    console.log(`\n📊 Testing business: ${businessId}`);
    console.log(`📅 Month: ${month}`);

    // Step 1: Check if business exists
    console.log('\n[Step 1] Checking if business exists...');
    const businessDoc = await db.collection('businesses').doc(businessId).get();
    
    if (!businessDoc.exists) {
      console.log(`❌ ERROR: Business "${businessId}" does not exist in database!`);
      console.log('✅ SOLUTION: Use a valid business ID like "biz_speaker_repairs" or "biz_machine_2"');
      return;
    } else {
      console.log(`✅ Business found: ${businessDoc.data().businessName || businessId}`);
    }

    // Step 2: Check if staff collection exists
    console.log('\n[Step 2] Checking staff collection...');
    const staffSnapshot = await db.collection('businesses').doc(businessId)
      .collection('staff').get();
    
    console.log(`✅ Found ${staffSnapshot.size} staff members`);
    
    if (staffSnapshot.empty) {
      console.log('⚠️  WARNING: No staff members found. Assessment will be empty.');
    }

    // Step 3: Check assessment cache
    console.log('\n[Step 3] Checking assessment cache...');
    const cacheDoc = await db.collection('businesses').doc(businessId)
      .collection('assessment_cache').doc(month).get();
    
    if (cacheDoc.exists) {
      const cacheData = cacheDoc.data();
      console.log(`✅ Cache exists - Last updated: ${cacheData.lastUpdated}`);
      console.log(`📊 Cached employees: ${cacheData.employees?.length || 0}`);
    } else {
      console.log('⚠️  No cache found for this month');
    }

    // Step 4: Try loading the cacheCalculation module
    console.log('\n[Step 4] Testing calculation module...');
    
    try {
      const { calculateAndCacheAssessment } = require('./functions/cacheCalculation.js');
      console.log('✅ Module loaded successfully');
      
      console.log('\n[Step 5] Running calculation...');
      const result = await calculateAndCacheAssessment(businessId, month, 176);
      
      console.log('\n✅ SUCCESS! Assessment calculated:');
      console.log(`   📊 Employees: ${result.employees?.length || 0}`);
      console.log(`   💰 Total Income: R${result.summary?.totalIncome || 0}`);
      console.log(`   ⏱️  Total Hours: ${result.summary?.totalHoursWorked || 0}`);
      
    } catch (moduleError) {
      console.log('\n❌ CALCULATION ERROR:');
      console.log(moduleError.message);
      console.log('\n📋 Stack trace:');
      console.log(moduleError.stack);
      
      console.log('\n💡 POSSIBLE CAUSES:');
      console.log('   1. Missing employee data (slot, payRate, etc.)');
      console.log('   2. Invalid attendance events format');
      console.log('   3. Missing business configuration');
      console.log('   4. Database permission issues');
    }

  } catch (error) {
    console.log('\n❌ DIAGNOSTIC ERROR:');
    console.log(error.message);
    console.log('\n📋 Stack trace:');
    console.log(error.stack);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 DIAGNOSTIC COMPLETE');
  console.log('='.repeat(60));
}

// Run diagnostic
diagnoseAssessmentError().catch(console.error);
