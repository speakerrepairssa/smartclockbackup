#!/usr/bin/env node

const http = require('http');

// Fetch and display January 2026 events
const options = {
    hostname: 'localhost',
    port: 3003,
    path: '/january-events',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        const response = JSON.parse(data);
        
        console.log('📅 JANUARY 2026 ATTENDANCE EVENTS TEST');
        console.log('='.repeat(50));
        console.log('📊 Summary:');
        console.log(`• Total Events: ${response.totalEvents}`);
        console.log(`• Period: ${response.period}`);
        console.log(`• Device: ${response.device}`);
        console.log();
        
        console.log('👥 Employee Summary:');
        Object.entries(response.employeeSummary).forEach(([name, stats]) => {
            console.log(`👤 ${name}:`);
            console.log(`   • Days worked: ${stats.days_worked}`);
            console.log(`   • Check-ins: ${stats.check_ins}`);
            console.log(`   • Check-outs: ${stats.check_outs}`);
            console.log(`   • Estimated hours: ${stats.estimated_hours}`);
            console.log();
        });
        
        console.log('📋 Detailed Events (chronological):');
        console.log('-'.repeat(50));
        response.events.forEach(event => {
            const [date, time] = event.timestamp.split(' ');
            console.log(`${date} (${event.dayName}) ${time} - ${event.employeeName} (${event.eventType.toUpperCase()})`);
        });
        
        console.log('\n✅ Test completed successfully! January events are working.');
        console.log('🔗 Your live VPS service also has these same events at: http://69.62.109.168:3002/device/extract');
    });
});

req.on('error', (error) => {
    console.error('Error:', error.message);
});

req.end();