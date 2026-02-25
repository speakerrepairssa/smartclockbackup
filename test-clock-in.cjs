/**
 * Test Clock-In Event
 * Simulates a clock-in event to test the full pipeline
 */

const axios = require('axios');

const RELAY_URL = 'http://69.62.109.168:7660';
const WEBHOOK_URL = 'https://attendancewebhook-4q7htrps4q-uc.a.run.app';

// Test data - modify these values
const testEvent = {
  deviceId: 'admin', // Your device ID
  employeeId: '1',    // Employee badge number
  timestamp: new Date().toISOString(),
  eventType: 'clock-in',
  source: 'test'
};

async function testClockIn() {
  console.log('🧪 Testing Clock-In Pipeline\n');
  console.log('Test Event:', testEvent);
  console.log('');

  // Test 1: Relay health check
  console.log('1️⃣ Testing Relay Health...');
  try {
    const relayHealth = await axios.get(`${RELAY_URL}/`);
    console.log('✅ Relay is healthy:', relayHealth.data);
  } catch (error) {
    console.log('❌ Relay is DOWN:', error.message);
    return;
  }

  // Test 2: Send  event directly to webhook
  console.log('\n2️⃣ Sending event to Firebase webhook...');
  try {
    const response = await axios.post(WEBHOOK_URL, testEvent, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    console.log('✅ Webhook response:', response.data);
  } catch (error) {
    console.log('❌ Webhook error:', error.response?.data || error.message);
    return;
  }

  // Test 3: Check if relay can forward webhooks
  console.log('\n3️⃣ Testing relay webhook forwarding...');
  try {
    const relayWebhookUrl = `${RELAY_URL}/${testEvent.deviceId}-webhook`;
    console.log('Sending to:', relayWebhookUrl);
    
    const response = await axios.post(relayWebhookUrl, testEvent, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    console.log('✅ Relay forwarded successfully');
  } catch (error) {
    console.log('⚠️  Relay forward result:', error.response?.status || error.message);
  }

  console.log('\n✅ Testing complete! Check your business dashboard for the event.');
  console.log('📊 Event should appear in: Business Dashboard → Monitor → Attendance Events');
}

testClockIn().catch(console.error);
