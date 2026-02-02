/**
 * Business Reports Module - Clean and Simple
 * Provides basic monthly reports without interfering with other modules
 */

console.log('📊 Reports module loaded (clean version)');

// Simple reports initialization - no complex dependencies
function initializeReports() {
  console.log('✅ Reports initialized');
  
  // Set current month as default
  const monthInput = document.getElementById('reportMonth');
  if (monthInput && !monthInput.value) {
    const currentDate = new Date();
    const currentMonth = currentDate.getFullYear() + '-' + 
      String(currentDate.getMonth() + 1).padStart(2, '0');
    monthInput.value = currentMonth;
  }
}

// Export for compatibility (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initializeReports };
}