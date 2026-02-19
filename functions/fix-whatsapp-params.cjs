// Fix WhatsApp Template Parameters
// Run from functions directory: cd functions && node ../fix-whatsapp-params.cjs

const admin = require('firebase-admin');

// Check if already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function fixAutomationCard() {
  const businessId = 'biz_srcomponents';
  
  console.log('\n📝 Fixing WhatsApp automation card for payrollfinal template...\n');
  
  // Get automation cards with payrollfinal template
  const automationsSnap = await db.collection('businesses')
    .doc(businessId)
    .collection('whatsapp_automations')
    .where('templateName', '==', 'payrollfinal')
    .get();
  
  if (automationsSnap.empty) {
    console.log('❌ No payrollfinal automation card found');
    return;
  }
  
  for (const doc of automationsSnap.docs) {
    console.log(`✅ Found automation card: ${doc.id}`);
    
    // Correct parameter mappings for payrollfinal template
    const correctMappings = [
      { parameter: '1', value: 'employeeName', source: 'employee' },          // 1. Employee Name
      { parameter: '2', value: 'requiredHours', source: 'employee' },         // 2. Required Hours
      { parameter: '3', value: 'currentIncomeDue', source: 'employee' },      // 3. Current Income Due (money amount)
      { parameter: '4', value: 'currentHours', source: 'employee' },          // 4. Current Hours Worked
      { parameter: '5', value: 'hoursShort', source: 'employee' },            // 5. Hours Short
      { parameter: '6', value: '1.5', source: 'custom' },                     // 6. Daily Multiplier (can be null or 1.5)
      { parameter: '7', value: 'payRate', source: 'employee' }                // 7. Pay Rate
    ];
    
    await doc.ref.update({
      parameterMappings: correctMappings
    });
    
    console.log('✅ Updated parameter mappings:');
    correctMappings.forEach((mapping, idx) => {
      console.log(`   ${idx + 1}. Parameter ${mapping.parameter}: "${mapping.value}" (source: ${mapping.source})`);
    });
  }
  
  console.log('\n✅ All automation cards fixed!\n');
}

fixAutomationCard()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
