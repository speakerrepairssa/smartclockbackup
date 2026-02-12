#!/usr/bin/env node

const http = require('http');

// Simple script to list events from VPS
const options = {
    hostname: '69.62.109.168',
    port: 3002,
    path: '/device/extract',
    method: 'GET',
    timeout: 15000
};

console.log('📅 FETCHING EVENTS FROM LIVE VPS SERVICE...');
console.log('🔗 URL: http://69.62.109.168:3002/device/extract');
console.log();

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            
            console.log('✅ DATA RECEIVED SUCCESSFULLY');
            console.log('='.repeat(60));
            console.log(`Total Events Found: ${response.events.length}`);
            console.log(`Last Sync: ${response.lastSync}`);
            console.log(`Message: ${response.message}`);
            console.log();
            
            // Filter January events
            const januaryEvents = response.events.filter(e => e.timestamp.includes('2026-01'));
            
            if (januaryEvents.length > 0) {
                console.log(`📋 JANUARY 2026 EVENTS (${januaryEvents.length} found):`);
                console.log('-'.repeat(60));
                
                januaryEvents.forEach((event, index) => {
                    const date = new Date(event.timestamp + 'Z'); // Add Z for UTC
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
                    console.log(`${(index + 1).toString().padStart(2)}. ${event.timestamp} (${dayName}) - ${event.employeeName} (${event.eventType.toUpperCase()})`);
                });
            } else {
                console.log('❌ NO JANUARY EVENTS FOUND');
                console.log('📋 ALL EVENTS IN DATABASE:');
                console.log('-'.repeat(60));
                
                response.events.forEach((event, index) => {
                    console.log(`${(index + 1).toString().padStart(2)}. ${event.timestamp} - ${event.employeeName} (${event.eventType.toUpperCase()})`);
                });
            }
            
        } catch (error) {
            console.error('❌ ERROR PARSING RESPONSE:', error.message);
            console.log('Raw data:', data.substring(0, 500));
        }
    });
});

req.on('error', (error) => {
    console.error('❌ REQUEST FAILED:', error.message);
});

req.on('timeout', () => {
    console.error('❌ REQUEST TIMED OUT');
    req.destroy();
});

req.end();