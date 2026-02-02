const https = require('https');
const http = require('http');

// This script tries different approaches to extract events
// similar to how Uniclox might have done it

const deviceIP = '192.168.0.114';
const username = 'admin';
const password = 'Azam198419880001';

// Create auth header
const auth = Buffer.from(`${username}:${password}`).toString('base64');

console.log('=== Hikvision Event Extraction Attempts ===');
console.log(`Device: ${deviceIP}`);
console.log(`Testing different approaches that Uniclox might have used...`);
console.log('');

// Function to make HTTP request
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const protocol = options.protocol === 'https:' ? https : http;
        
        const req = protocol.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
        });
        
        req.on('error', reject);
        
        if (data) {
            req.write(data);
        }
        
        req.end();
    });
}

async function testApproaches() {
    const approaches = [
        {
            name: "Direct Event Log Access",
            options: {
                hostname: deviceIP,
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
            name: "Event Search with Time Range",
            options: {
                hostname: deviceIP,
                port: 80,
                path: '/ISAPI/ContentMgmt/search',
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/xml'
                }
            },
            data: `<?xml version="1.0" encoding="UTF-8"?>
<CMSearchDescription>
    <searchID>EventSearch</searchID>
    <trackList>
        <trackID>101</trackID>
    </trackList>
    <timeSpanList>
        <timeSpan>
            <startTime>2024-01-01T00:00:00Z</startTime>
            <endTime>2024-12-31T23:59:59Z</endTime>
        </timeSpan>
    </timeSpanList>
    <maxResults>100</maxResults>
    <searchResultPosition>0</searchResultPosition>
</CMSearchDescription>`
        },
        {
            name: "Simple Event Query",
            options: {
                hostname: deviceIP,
                port: 80,
                path: '/ISAPI/AccessControl/AcsEvent?format=json',
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            }
        },
        {
            name: "Database Direct Access",
            options: {
                hostname: deviceIP,
                port: 80,
                path: '/ISAPI/AccessControl/EventLogs',
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json'
                }
            }
        },
        {
            name: "Record Search",
            options: {
                hostname: deviceIP,
                port: 80,
                path: '/ISAPI/ContentMgmt/record/search',
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/xml'
                }
            },
            data: `<?xml version="1.0" encoding="UTF-8"?>
<searchDescription>
    <searchID>1</searchID>
    <maxResults>100</maxResults>
</searchDescription>`
        },
        {
            name: "Security Event Query",
            options: {
                hostname: deviceIP,
                port: 80,
                path: '/ISAPI/Event/triggers/AccessControllerEvent',
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            }
        }
    ];

    for (const approach of approaches) {
        console.log(`Testing: ${approach.name}`);
        try {
            const result = await makeRequest(approach.options, approach.data);
            console.log(`  Status: ${result.statusCode}`);
            
            if (result.statusCode === 200) {
                console.log(`  SUCCESS! Response length: ${result.body.length}`);
                console.log(`  Response preview: ${result.body.substring(0, 200)}...`);
                
                // If this looks like event data, show more
                if (result.body.includes('AcsEvent') || result.body.includes('event') || result.body.includes('record')) {
                    console.log('\n  FULL RESPONSE:');
                    console.log(result.body);
                }
            } else {
                const preview = result.body.substring(0, 100);
                console.log(`  Failed: ${preview}${result.body.length > 100 ? '...' : ''}`);
            }
        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
        console.log('');
    }
}

// Also test different ports that Uniclox might have used
async function testAlternatePorts() {
    console.log('=== Testing Alternative Ports ===');
    const ports = [80, 443, 8000, 8080, 554];
    
    for (const port of ports) {
        console.log(`Testing port ${port}...`);
        try {
            const options = {
                hostname: deviceIP,
                port: port,
                path: '/ISAPI/System/deviceInfo',
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`
                },
                rejectUnauthorized: false
            };
            
            const result = await makeRequest(options);
            console.log(`  Port ${port}: Status ${result.statusCode}`);
            if (result.statusCode === 200) {
                console.log(`    Response: ${result.body.substring(0, 100)}...`);
            }
        } catch (error) {
            console.log(`  Port ${port}: ${error.message}`);
        }
    }
}

// Run all tests
async function main() {
    await testApproaches();
    await testAlternatePorts();
    console.log('\n=== Testing Complete ===');
    console.log('If any approach worked, the device supports event extraction.');
    console.log('Uniclox likely used one of the successful methods above.');
}

main().catch(console.error);