const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function fixBusinessEmail() {
  try {
    console.log('🔍 Checking SR Components business document...');
    
    const doc = await db.collection('businesses').doc('biz_srcomponents').get();
    
    if (doc.exists) {
      const data = doc.data();
      console.log('📊 Current business data:');
      console.log('  - Business Name:', data.businessName);
      console.log('  - Email:', data.email);
      console.log('  - Plan:', data.plan);
      console.log('  - Slots:', data.slotsAllowed);
      
      // Check if email is missing or undefined
      if (!data.email || data.email === 'undefined' || data.email === undefined) {
        console.log('🔧 Updating missing email...');
        
        await db.collection('businesses').doc('biz_srcomponents').update({
          email: 'info@srcomponents.co.za',
          plan: data.plan || 'Professional',
          businessName: data.businessName || 'SR Components',
          updatedAt: new Date().toISOString()
        });
        
        console.log('✅ Updated business email to: info@srcomponents.co.za');
      } else {
        console.log('ℹ️  Email already properly set:', data.email);
      }
    } else {
      console.log('❌ Business document "biz_srcomponents" not found');
    }
    
  } catch (error) {
    console.error('❌ Error fixing business email:', error);
  }
  
  process.exit(0);
}

fixBusinessEmail();