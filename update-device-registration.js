#!/usr/bin/env node

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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

async function updateDevice() {
  try {
    const deviceRef = doc(db, 'businesses', 'biz_srcomponents', 'devices', 'ADMIN');
    
    const deviceData = {
      deviceId: 'ADMIN',
      locationName: 'hik3',
      deviceModel: 'Hikvision Face Recognition',
      deviceIP: '192.168.7.4',
      serialNumber: 'G04425941',
      maxEmployees: 100,
      deviceUsername: 'admin',
      devicePassword: btoa('Azam198419880001#'),
      httpPort: 80,
      httpsPort: 443,
      webhookPath: '/admin-webhook',
      vpsIP: '69.62.109.168',
      vpsPort: 7660,
      status: 'active',
      deviceType: 'Face Recognition',
      deviceName: 'hik3',
      ipAddress: '192.168.7.4',
      registeredBy: 'admin',
      registeredAt: '2026-03-02T10:31:48.927Z',
      updatedAt: new Date().toISOString(),
      lastSeen: null,
      connectionTested: false
    };
    
    await setDoc(deviceRef, deviceData);
    
    console.log('✅ Device updated successfully with complete configuration!');
    console.log('\nDevice configuration:');
    console.log('- Device ID: ADMIN');
    console.log('- Location: hik3');
    console.log('- IP: 192.168.7.4');
    console.log('- Serial: G04425941');
    console.log('- Webhook: /admin-webhook');
    console.log('\nNow try clocking in on the device!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function btoa(str) {
  return Buffer.from(str).toString('base64');
}

updateDevice();
