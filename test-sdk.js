// Simple test script to verify Data Connect SDK usage
import { initializeApp } from 'firebase/app';
import { getDataConnect } from 'firebase/data-connect';

// Firebase configuration
const firebaseConfig = {
  projectId: 'aiclock-82608'
};

const app = initializeApp(firebaseConfig);
const dataConnect = getDataConnect(app, {
  connector: 'aiclock-connector',
  service: 'aiclock',
  location: 'us-central1'
});

// Test with direct SDK usage
async function testDirectSDK() {
  try {
    // Import the generated SDK 
    const sdk = await import('./src/dataconnect-generated/index.cjs.js');
    
    console.log('🔧 Testing with generated SDK...');
    console.log('Available functions:', Object.keys(sdk));
    
    const businessId = crypto.randomUUID();
    const result = await sdk.createBusiness(dataConnect, {
      id: businessId,
      businessName: "Test Company",
      email: "test@company.com", 
      plan: "BASIC",
      slotsAllowed: 50
    });
    
    console.log('✅ Business created:', result);
    return result;
    
  } catch (error) {
    console.error('SDK test failed:', error);
    return null;
  }
}

testDirectSDK();