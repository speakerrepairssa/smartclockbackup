const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

async function updateBusinessPlan() {
  try {
    const businessId = "biz_machine_2";
    const businessRef = db.collection('businesses').doc(businessId);
    
    await businessRef.update({
      plan: "Professional",
      maxEmployees: 20,
      planUpdatedAt: new Date().toISOString(),
      features: {
        maxEmployees: 20,
        deviceSync: true,
        reports: true,
        whatsappIntegration: true,
        advancedReporting: true
      }
    });

    console.log(`✅ Business ${businessId} updated to Professional plan (20 employees)`);
    
    // Also update the default plan display
    const currentData = await businessRef.get();
    console.log('Current business data:', currentData.data());
    
  } catch (error) {
    console.error("❌ Error updating business plan:", error);
  }
}

updateBusinessPlan();