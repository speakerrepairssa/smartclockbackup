// Fix missing maxEmployees field in businesses
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function fixMaxEmployees() {
  try {
    console.log('Starting maxEmployees fix...\n');
    
    const businessesSnapshot = await db.collection('businesses').get();
    console.log(`Found ${businessesSnapshot.size} businesses\n`);
    
    const planLimits = {
      'Basic': 5,
      'Standard': 10,
      'Premium': 20,
      'Enterprise': 50
    };
    
    let updated = 0;
    let skipped = 0;
    
    for (const doc of businessesSnapshot.docs) {
      const data = doc.data();
      const businessId = doc.id;
      
      // Check if maxEmployees is missing
      if (!data.maxEmployees) {
        // Use slotsAllowed if it exists, otherwise use plan limit
        const maxEmployees = data.slotsAllowed || planLimits[data.plan] || 5;
        
        console.log(`Updating ${businessId}:`);
        console.log(`  Name: ${data.businessName}`);
        console.log(`  Email: ${data.email || data.adminEmail}`);
        console.log(`  Plan: ${data.plan || 'Basic'}`);
        console.log(`  slotsAllowed: ${data.slotsAllowed || 'not set'}`);
        console.log(`  Setting maxEmployees: ${maxEmployees}\n`);
        
        await db.collection('businesses').doc(businessId).update({
          maxEmployees: maxEmployees
        });
        
        updated++;
      } else {
        console.log(`Skipping ${businessId} - maxEmployees already set to ${data.maxEmployees}`);
        skipped++;
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total businesses: ${businessesSnapshot.size}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixMaxEmployees();
