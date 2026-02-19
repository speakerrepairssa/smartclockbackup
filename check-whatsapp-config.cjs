const admin = require('firebase-admin');
const serviceAccount = require('./aiclock-82608-firebase-adminsdk-jvy3c-ba9b43c67b.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAutomation() {
  const businessId = 'biz_srcomponents';
  const automationsSnap = await db.collection('businesses')
    .doc(businessId)
    .collection('whatsapp_automations')
    .get();
  
  console.log('\n=== WhatsApp Automation Cards ===\n');
  
  automationsSnap.forEach(doc => {
    const data = doc.data();
    console.log(`Card ID: ${doc.id}`);
    console.log(`Trigger: ${data.trigger}`);
    console.log(`Template: ${data.templateName}`);
    console.log(`Enabled: ${data.enabled}`);
    console.log('\nParameter Mappings:');
    if (data.parameterMappings) {
      data.parameterMappings.forEach((mapping, idx) => {
        console.log(`  ${idx + 1}. Parameter ${mapping.parameter}: "${mapping.value}" (source: ${mapping.source})`);
      });
    }
    console.log('\n---\n');
  });
  
  process.exit(0);
}

checkAutomation().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
