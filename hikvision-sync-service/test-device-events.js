// Quick test to check actual events on FC4349999 device
const axios = require('axios');

async function testDeviceEvents() {
    console.log('🔍 Testing FC4349999 device for actual events...');
    
    const deviceIP = '192.168.0.114';
    const username = 'admin';
    const password = 'Azam198419880001';
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    // Try different endpoints to find any stored data
    const endpoints = [
        '/ISAPI/AccessControl/CardInfo/Search',
        '/ISAPI/AccessControl/UserInfo/Search', 
        '/ISAPI/AccessControl/AttendanceReport',
        '/ISAPI/Smart/UserManager/Search',
        '/ISAPI/ContentMgmt/record/search',
        '/ISAPI/Event/notification/eventTypes',
        '/SDK/recordSearch',
        '/SDK/userManager'
    ];
    
    console.log(`📡 Testing ${endpoints.length} different endpoints...`);
    
    for (const endpoint of endpoints) {
        try {
            const url = `https://${deviceIP}${endpoint}`;
            console.log(`\n🔎 Testing: ${endpoint}`);
            
            const response = await axios({
                method: 'GET',
                url: url,
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/xml, application/json',
                    'User-Agent': 'WebSDK-Test/1.0'
                },
                timeout: 5000,
                httpsAgent: new (require('https').Agent)({
                    rejectUnauthorized: false
                })
            });
            
            console.log(`✅ SUCCESS: Status ${response.status}`);
            if (response.data && typeof response.data === 'string' && response.data.length > 100) {
                console.log(`📄 Data length: ${response.data.length} characters`);
                
                // Look for event-related keywords
                const keywords = ['event', 'attendance', 'record', 'user', 'card', 'time'];
                const foundKeywords = keywords.filter(keyword => 
                    response.data.toLowerCase().includes(keyword)
                );
                
                if (foundKeywords.length > 0) {
                    console.log(`🎯 Found keywords: ${foundKeywords.join(', ')}`);
                    
                    // Try to extract number information
                    const numbers = response.data.match(/(\d+)/g);
                    if (numbers && numbers.length > 0) {
                        console.log(`🔢 Numbers found in response: ${numbers.slice(0, 10).join(', ')}${numbers.length > 10 ? '...' : ''}`);
                    }
                }
                
                console.log(`📝 Sample content: ${response.data.substring(0, 200)}...`);
            }
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ HTTP ${error.response.status}: ${error.response.statusText}`);
            } else {
                console.log(`❌ Error: ${error.message}`);
            }
        }
    }
    
    // Try POST requests with search parameters
    console.log(`\n🔍 Testing POST requests with search parameters...`);
    
    const searchEndpoints = [
        {
            endpoint: '/ISAPI/AccessControl/UserInfo/Search',
            data: '<?xml version="1.0"?><UserInfoSearchCond><searchID>test123</searchID><maxResults>100</maxResults></UserInfoSearchCond>',
            contentType: 'application/xml'
        },
        {
            endpoint: '/ISAPI/AccessControl/CardInfo/Search', 
            data: '<?xml version="1.0"?><CardInfoSearchCond><searchID>cardtest123</searchID><maxResults>100</maxResults></CardInfoSearchCond>',
            contentType: 'application/xml'
        }
    ];
    
    for (const test of searchEndpoints) {
        try {
            const url = `https://${deviceIP}${test.endpoint}`;
            console.log(`\n📤 POST Testing: ${test.endpoint}`);
            
            const response = await axios({
                method: 'POST',
                url: url,
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': test.contentType,
                    'User-Agent': 'WebSDK-Test/1.0'
                },
                data: test.data,
                timeout: 10000,
                httpsAgent: new (require('https').Agent)({
                    rejectUnauthorized: false
                })
            });
            
            console.log(`✅ POST SUCCESS: Status ${response.status}`);
            console.log(`📄 Response: ${response.data}`);
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ POST HTTP ${error.response.status}: ${error.response.data || error.response.statusText}`);
            } else {
                console.log(`❌ POST Error: ${error.message}`);
            }
        }
    }
}

// Run the test
testDeviceEvents().catch(console.error);