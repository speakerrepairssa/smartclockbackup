// Direct WhatsApp API Test
// Run with: node test-whatsapp-direct.js

const https = require('https');

// Your WhatsApp credentials (from Firebase Console)
const ACCESS_TOKEN = 'EAAJQl3ZCAfVoBO1xlskr4PEg52Akx24aQZCdfsENfKzEf5yLwEZBvTN1L6k8rDRa1P2z9gWCL1wvn2yiaBHdAxE8JtIMSKXdlwUmgxoF4BElZAzqZB2jFWu97QzFZCSmFwR34UUojOTAk0XH3mZBrRmYQxLFLgvlGHzr3xHZAEDPenaixzGoRRWqo0ZAAZDZD';
const PHONE_NUMBER_ID = '104235266075141';
const TO_NUMBER = '27500330091'; // Formatted to international (removed leading 0, added 27)
const TEMPLATE_NAME = 'payrollfinal';

// Test parameters
const testParameters = [
  { type: 'text', text: 'azam' },          // 1. Employee Name
  { type: 'text', text: '174' },           // 2. Required Hours
  { type: 'text', text: '2134.36' },       // 3. Current Income Due
  { type: 'text', text: '101.16' },        // 4. Current Hours
  { type: 'text', text: '72.84' },         // 5. Hours Short
  { type: 'text', text: '1.5' },           // 6. Daily Multiplier
  { type: 'text', text: '150' }            // 7. Pay Rate
];

const postData = JSON.stringify({
  messaging_product: 'whatsapp',
  to: TO_NUMBER,
  type: 'template',
  template: {
    name: TEMPLATE_NAME,
    language: {
      code: 'en'
    },
    components: [{
      type: 'body',
      parameters: testParameters
    }]
  }
});

console.log('🚀 Testing WhatsApp Cloud API...');
console.log('📱 Sending to:', TO_NUMBER);
console.log('📄 Template:', TEMPLATE_NAME);
console.log('📦 Request body:', postData);
console.log('');

const options = {
  hostname: 'graph.facebook.com',
  port: 443,
  path: `/v18.0/${PHONE_NUMBER_ID}/messages`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('📨 Response Status:', res.statusCode);
    console.log('📨 Response Body:', data);
    console.log('');
    
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ SUCCESS! Message sent to WhatsApp API');
      console.log('Check your phone:', TO_NUMBER);
    } else {
      console.log('❌ FAILED! WhatsApp API returned an error');
      try {
        const errorData = JSON.parse(data);
        console.log('Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('Raw error:', data);
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.write(postData);
req.end();
