#!/usr/bin/env node

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');

const app = initializeApp({
  apiKey: 'AIzaSyBzkE6e8QAAh_v8DhcPZVTiSRZgKKUdbNQ',
  authDomain: 'aiclock-82608.firebaseapp.com', 
  projectId: 'aiclock-82608'
});
const db = getFirestore(app);

async function checkWhatsApp() {
  const businessId = 'biz_speaker_repairs';
  
  console.log('🔍 Checking WhatsApp settings for Speaker Repairs...\n');
  
  // Check settings
  const settingsRef = doc(db, 'businesses', businessId, 'settings', 'whatsapp');
  const settingsDoc = await getDoc(settingsRef);
  
  if (settingsDoc.exists()) {
    console.log('✅ WhatsApp settings exist:');
    console.log(JSON.stringify(settingsDoc.data(), null, 2));
  } else {
    console.log('❌ WhatsApp settings missing');
  }
  
  console.log('');
  
  // Check templates
  const templatesRef = collection(db, 'businesses', businessId, 'whatsapp_templates');
  const templatesSnap = await getDocs(templatesRef);
  
  if (!templatesSnap.empty) {
    console.log('📝 WhatsApp templates:');
    templatesSnap.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${doc.id}: trigger=${data.trigger}, active=${data.active}`);
    });
  } else {
    console.log('❌ No WhatsApp templates found');
  }
  
  process.exit(0);
}

checkWhatsApp().catch(console.error);