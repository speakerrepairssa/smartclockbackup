// Test Assessment Cache System
// Run this script to test the assessment caching functionality

import { calculateAndCacheAssessment } from './calculate-assessment-cache.js';

async function testAssessmentCaching() {
  console.log('🧪 Testing Assessment Cache System');
  console.log('==================================');
  
  // Test parameters
  const businessId = 'biz_machine_2';
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
  const requiredHours = 176; // Default monthly hours
  
  console.log(`Testing with:`, {
    businessId,
    month: currentMonth,
    requiredHours
  });
  
  try {
    // Test 1: Calculate and cache assessment data
    console.log('\n📊 Test 1: Calculating assessment data...');
    const result = await calculateAndCacheAssessment(businessId, currentMonth, requiredHours);
    
    if (result.success) {
      console.log('✅ Assessment calculation successful!');
      console.log(`📈 Generated assessment for ${result.employeeCount} employees`);
      console.log(`💰 Total hours worked: ${result.summary.totalHoursWorked}`);
      console.log(`💸 Total amount due: R${result.summary.totalAmountDue}`);
      console.log(`📊 Average attendance: ${result.summary.averageAttendance}%`);
    } else {
      console.log('❌ Assessment calculation failed:', result.error);
    }
    
  } catch (error) {
    console.error('🚨 Test failed:', error);
  }
}

// Test Cloud Function URL
async function testCloudFunction() {
  console.log('\n🌐 Testing Cloud Function endpoint...');
  
  const businessId = 'biz_machine_2';
  const month = new Date().toISOString().slice(0, 7);
  
  try {
    const response = await fetch(`https://us-central1-aiclock-82608.cloudfunctions.net/updateAssessmentCache?businessId=${businessId}&month=${month}&requiredHours=176`);
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Cloud Function test successful!');
      console.log('📊 Result:', result);
    } else {
      console.log('❌ Cloud Function test failed:', result);
    }
  } catch (error) {
    console.error('🚨 Cloud Function test error:', error);
  }
}

// Manual trigger test for browser
function browserTest() {
  console.log('🌐 Browser Test Instructions:');
  console.log('1. Open your business dashboard');
  console.log('2. Go to Assessment module');
  console.log('3. Select current month');
  console.log('4. Click "🚀 Recalculate Now" button');
  console.log('5. Check browser console for cache loading messages');
  console.log('6. Verify instant loading on subsequent refreshes');
}

// Run tests
if (typeof window === 'undefined') {
  // Node.js environment
  testAssessmentCaching();
  testCloudFunction();
} else {
  // Browser environment  
  browserTest();
  window.testAssessmentCaching = testAssessmentCaching;
  window.testCloudFunction = testCloudFunction;
}