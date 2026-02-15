// Check WhatsApp automation card configuration
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

async function checkAutomationCard() {
  try {
    const businessId = 'biz_srcomponents'; // SR Components
    
    console.log('🔍 Checking WhatsApp automation cards for:', businessId);
    console.log('─'.repeat(80));
    
    const cardsRef = db.collection('businesses').doc(businessId).collection('whatsapp_automations');
    const snapshot = await cardsRef.get();
    
    console.log(`\n📋 Found ${snapshot.size} automation card(s)\n`);
    
    snapshot.forEach(doc => {
      const card = doc.data();
      console.log(`\n🎯 Card ID: ${doc.id}`);
      console.log(`   Name: ${card.name}`);
      console.log(`   Template: ${card.templateName}`);
      console.log(`   Trigger: ${card.trigger}`);
      console.log(`   Recipient: ${card.recipient}`);
      console.log(`   Enabled: ${card.enabled}`);
      console.log(`\n   📝 Parameter Mappings (${card.parameterMappings?.length || 0}):`);
      
      if (card.parameterMappings && card.parameterMappings.length > 0) {
        card.parameterMappings.forEach((mapping, index) => {
          console.log(`   ${index + 1}. Parameter {{${mapping.parameter}}}`);
          console.log(`      Source: ${mapping.source}`);
          console.log(`      Value: ${mapping.value}`);
          console.log(`      Parameter Index: ${mapping.parameterIndex}`);
        });
      } else {
        console.log('      No parameter mappings configured');
      }
      
      console.log('\n' + '─'.repeat(80));
    });
    
    console.log('\n✅ Check complete\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAutomationCard();
