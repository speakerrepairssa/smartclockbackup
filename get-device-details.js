#!/usr/bin/env node

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBzkE6e8QAAh_v8DhcPZVTiSRZgKKUdbNQ",
  authDomain: "aiclock-82608.firebaseapp.com", 
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.appspot.com",
  messagingSenderId: "847148296718",
  appId: "1:847148296718:web:7afe6f8c3c8b77e3a8b456",
  measurementId: "G-HF5YNKQCR8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function getDeviceDetails() {
  try {
    const deviceRef = doc(db, 'businesses', 'biz_srcomponents', 'devices', 'admin');
    const deviceSnap = await getDoc(deviceRef);
    
    if (deviceSnap.exists()) {
      const data = deviceSnap.data();
      console.log('\n📱 Device Details for SR Components - admin:');
      console.log('='.repeat(60));
      console.log('');
      console.log('Device ID:', data.deviceId || 'N/A');
      console.log('Location Name:', data.locationName || 'N/A');
      console.log('Device Model:', data.deviceModel || 'N/A');
      console.log('Device IP:', data.deviceIP || 'N/A');
      console.log('Webhook Path:', data.webhookPath || 'N/A');
      console.log('Status:', data.status || 'N/A');
      console.log('Max Employees:', data.maxEmployees || 'N/A');
      console.log('Created At:', data.createdAt || 'N/A');
      console.log('Last Seen:', data.lastSeen || 'Never');
      console.log('\n📋 All Fields:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('Device not found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

getDeviceDetails();
