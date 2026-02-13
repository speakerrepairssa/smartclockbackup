#!/usr/bin/env node

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBzkE6e8QAAh_v8DhcPZVTiSRZgKKUdbNQ",
  authDomain: "aiclock-82608.firebaseapp.com",
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.appspot.com",
  messagingSenderId: "847148296718",
  appId: "1:847148296718:web:7afe6f8c3c8b77e3a8b456"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkAllWhatsAppSettings() {
  console.log('🔍 CHECKING WHATSAPP SETTINGS FOR ALL BUSINESSES...\n');

  const businesses = ['biz_srcomponents', 'biz_speaker_repairs', 'biz_machine_2'];
  
  for (const businessId of businesses) {
    console.log(`🏢 ${businessId.toUpperCase()}`);
    console.log('='+'='.repeat(businessId.length + 3));
    
    try {
      // Check WhatsApp settings
      const settingsRef = doc(db, 'businesses', businessId, 'settings', 'whatsapp');
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        console.log('✅ WhatsApp settings found:');
        console.log(`   Enabled: ${data.enabled || false}`);
        console.log(`   API Provider: ${data.apiProvider || 'Not set'}`);
        console.log(`   Phone Number: ${data.phoneNumber || 'Not set'}`);
        console.log(`   Business Name: ${data.businessName || 'Not set'}`);
        console.log(`   Access Token: ${data.accessToken ? 'SET (hidden)' : 'Not set'}`);
        console.log(`   Test Mode: ${data.testMode || false}`);
        if (data.phoneNumberId) console.log(`   Phone Number ID: ${data.phoneNumberId}`);
        if (data.businessAccountId) console.log(`   Business Account ID: ${data.businessAccountId}`);
        if (data.templateNames) console.log(`   Templates Available: ${data.templateNames.length}`);
      } else {
        console.log('❌ No WhatsApp settings found');
      }
      
      // Check WhatsApp templates
      const templatesRef = collection(db, 'businesses', businessId, 'whatsapp_templates');
      const templatesSnap = await getDocs(templatesRef);
      
      if (!templatesSnap.empty) {
        console.log(`📝 WhatsApp templates: ${templatesSnap.size} found`);
        templatesSnap.forEach(doc => {
          const templateData = doc.data();
          console.log(`   - ${doc.id}: ${templateData.trigger} (active: ${templateData.active})`);
        });
      } else {
        console.log('📝 No WhatsApp templates found');
      }
      
    } catch (error) {
      console.log(`❌ Error checking ${businessId}:`, error.message);
    }
    
    console.log('');
  }
}

checkAllWhatsAppSettings();