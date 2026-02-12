#!/usr/bin/env node

// Test script to display January 2026 events
const http = require('http');

const options = {
    hostname: '69.62.109.168',
    port: 3002,
    path: '/device/extract',
    method: 'GET',
    timeout: 5000
};

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            const januaryEvents = response.events.filter(e => e.timestamp.includes('2026-01'));
            
            console.log('📅 JANUARY 2026 ATTENDANCE EVENTS TEST');
            console.log('='.repeat(50));
            console.log(`Total January Events: ${januaryEvents.length}\n`);
            
            // Display events
            januaryEvents.forEach(event => {
                const date = new Date(event.timestamp + 'Z'); // Add Z for UTC
                const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
                console.log(`${event.timestamp} (${dayName}) - ${event.employeeName} (${event.eventType.toUpperCase()})`);
            });
            
            // Employee summary
            console.log('\n📊 Employee Summary:');
            const summary = {};
            januaryEvents.forEach(e => {
                if (!summary[e.employeeName]) {
                    summary[e.employeeName] = { check_in: 0, check_out: 0 };
                }
                summary[e.employeeName][e.eventType]++;
            });
            
            Object.entries(summary).forEach(([name, counts]) => {
                console.log(`👤 ${name}: ${counts.check_in} check-ins, ${counts.check_out} check-outs`);
            });
            
        } catch (error) {
            console.error('Error parsing response:', error.message);
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('Request failed:', error.message);
});

req.on('timeout', () => {
    console.error('Request timed out');
    req.destroy();
});

req.end();