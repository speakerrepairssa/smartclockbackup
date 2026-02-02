const https = require('https');
const http = require('http');

// Test different approaches to extract events from the exact device Uniclox used
const DEVICE_CONFIG = {
    ip: '192.168.0.114',
    username: 'admin', 
    password: 'Azam198419880001'
};

// Create HTTP agent that ignores SSL issues
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const protocol = options.protocol === 'https:' ? https : http;
        
        const req = protocol.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function testUnicloxApproaches() {
    console.log('=== Testing How Uniclox Accessed Device Events ===');
    console.log(`Device: ${DEVICE_CONFIG.ip}`);
    console.log(`Credentials: ${DEVICE_CONFIG.username}/${DEVICE_CONFIG.password}`);
    console.log('');

    const auth = Buffer.from(`${DEVICE_CONFIG.username}:${DEVICE_CONFIG.password}`).toString('base64');

    // Test different endpoints and approaches
    const testCases = [
        {
            name: "HTTP Basic - Event Search",
            options: {
                hostname: DEVICE_CONFIG.ip,
                port: 80,
                path: '/ISAPI/AccessControl/AcsEventLogs',
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/xml'
                }
            }
        },
        {
            name: "HTTP Basic - Content Search",
            options: {
                hostname: DEVICE_CONFIG.ip,
                port: 80,
                path: '/ISAPI/ContentMgmt/search',
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            }
        },
        {
            name: "HTTPS - Event Logs",
            options: {
                hostname: DEVICE_CONFIG.ip,
                port: 443,
                path: '/ISAPI/AccessControl/AcsEventLogs', 
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`
                },
                agent: httpsAgent
            }
        },
        {
            name: "Alternative Port 8000",
            options: {
                hostname: DEVICE_CONFIG.ip,
                port: 8000,
                path: '/ISAPI/AccessControl/AcsEvent',
                method: 'GET', 
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            }
        },
        {
            name: "Direct Event Database Query",
            options: {
                hostname: DEVICE_CONFIG.ip,
                port: 80,
                path: '/ISAPI/AccessControl/EventLogs?searchID=1&maxResults=100',
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json'
                }
            }
        }
    ];

    for (const testCase of testCases) {
        console.log(`Testing: ${testCase.name}`);
        console.log(`  URL: ${testCase.options.hostname}:${testCase.options.port}${testCase.options.path}`);
        
        try {
            const result = await makeRequest(testCase.options);
            console.log(`  Status: ${result.statusCode}`);
            
            if (result.statusCode === 200) {
                console.log(`  ✅ SUCCESS! Response length: ${result.body.length}`);
                console.log(`  Preview: ${result.body.substring(0, 200)}...`);
                
                // Check if this contains event data
                if (result.body.includes('AcsEvent') || 
                    result.body.includes('event') || 
                    result.body.includes('employeeNoString') ||
                    result.body.includes('cardNo')) {
                    console.log('  🎯 CONTAINS EVENT DATA! This might be how Uniclox did it!');
                    
                    // Save successful response for analysis
                    require('fs').writeFileSync('./uniclox-method-found.xml', result.body);
                    console.log('  💾 Full response saved to uniclox-method-found.xml');
                }
                
            } else if (result.statusCode === 401) {
                console.log('  🔐 Authentication required - checking auth method...');
            } else {
                console.log(`  ❌ Failed: ${result.body.substring(0, 100)}...`);
            }
            
        } catch (error) {
            console.log(`  ❌ Connection error: ${error.message}`);
        }
        
        console.log('');
    }

    console.log('=== Testing Complete ===');
    console.log('If any method returned status 200 with event data,');
    console.log('that is likely how Uniclox successfully extracted the 2905 events.');
}

// Run the test
testUnicloxApproaches().catch(console.error);