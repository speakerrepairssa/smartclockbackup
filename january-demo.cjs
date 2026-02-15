const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// January 2026 Events Demo Data
const januaryEvents = [
    // Week 1 January (Jan 1-7, 2026)
    { id: 'jan_1', employeeId: '3', employeeName: 'qaasiem', timestamp: '2026-01-02 08:15:00', eventType: 'check_in', deviceId: 'FC4349999' },
    { id: 'jan_2', employeeId: '3', employeeName: 'qaasiem', timestamp: '2026-01-02 17:30:00', eventType: 'check_out', deviceId: 'FC4349999' },
    { id: 'jan_3', employeeId: '8', employeeName: 'az8', timestamp: '2026-01-03 09:00:00', eventType: 'check_in', deviceId: 'FC4349999' },
    { id: 'jan_4', employeeId: '8', employeeName: 'az8', timestamp: '2026-01-03 18:15:00', eventType: 'check_out', deviceId: 'FC4349999' },
    
    // Week 2 January (Jan 8-14, 2026)
    { id: 'jan_5', employeeId: '5', employeeName: 'luq', timestamp: '2026-01-08 08:45:00', eventType: 'check_in', deviceId: 'FC4349999' },
    { id: 'jan_6', employeeId: '5', employeeName: 'luq', timestamp: '2026-01-08 17:00:00', eventType: 'check_out', deviceId: 'FC4349999' },
    { id: 'jan_7', employeeId: '3', employeeName: 'qaasiem', timestamp: '2026-01-10 08:30:00', eventType: 'check_in', deviceId: 'FC4349999' },
    { id: 'jan_8', employeeId: '3', employeeName: 'qaasiem', timestamp: '2026-01-10 17:45:00', eventType: 'check_out', deviceId: 'FC4349999' },
    
    // Week 3 January (Jan 15-21, 2026)
    { id: 'jan_9', employeeId: '8', employeeName: 'az8', timestamp: '2026-01-15 09:15:00', eventType: 'check_in', deviceId: 'FC4349999' },
    { id: 'jan_10', employeeId: '8', employeeName: 'az8', timestamp: '2026-01-15 18:00:00', eventType: 'check_out', deviceId: 'FC4349999' },
    { id: 'jan_11', employeeId: '5', employeeName: 'luq', timestamp: '2026-01-17 08:20:00', eventType: 'check_in', deviceId: 'FC4349999' },
    { id: 'jan_12', employeeId: '5', employeeName: 'luq', timestamp: '2026-01-17 16:45:00', eventType: 'check_out', deviceId: 'FC4349999' },
    
    // Week 4 January (Jan 22-28, 2026)
    { id: 'jan_13', employeeId: '3', employeeName: 'qaasiem', timestamp: '2026-01-22 08:10:00', eventType: 'check_in', deviceId: 'FC4349999' },
    { id: 'jan_14', employeeId: '3', employeeName: 'qaasiem', timestamp: '2026-01-22 17:20:00', eventType: 'check_out', deviceId: 'FC4349999' },
    { id: 'jan_15', employeeId: '8', employeeName: 'az8', timestamp: '2026-01-24 09:30:00', eventType: 'check_in', deviceId: 'FC4349999' },
    { id: 'jan_16', employeeId: '8', employeeName: 'az8', timestamp: '2026-01-24 18:30:00', eventType: 'check_out', deviceId: 'FC4349999' },
    
    // End of January
    { id: 'jan_17', employeeId: '5', employeeName: 'luq', timestamp: '2026-01-31 08:00:00', eventType: 'check_in', deviceId: 'FC4349999' },
    { id: 'jan_18', employeeId: '5', employeeName: 'luq', timestamp: '2026-01-31 17:00:00', eventType: 'check_out', deviceId: 'FC4349999' }
];

// Main endpoint to show January events
app.get('/january-events', (req, res) => {
    // Add day names for better display
    const eventsWithDays = januaryEvents.map(event => {
        const date = new Date(event.timestamp);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        return { ...event, dayName };
    });
    
    // Calculate summary by employee
    const summary = {};
    januaryEvents.forEach(e => {
        if (!summary[e.employeeName]) {
            summary[e.employeeName] = { check_ins: 0, check_outs: 0, total_hours: 0, days_worked: 0 };
        }
        
        if (e.eventType === 'check_in') {
            summary[e.employeeName].check_ins++;
        } else {
            summary[e.employeeName].check_outs++;
        }
    });
    
    // Calculate days worked and estimated hours
    Object.keys(summary).forEach(employee => {
        const employeeEvents = januaryEvents.filter(e => e.employeeName === employee);
        const uniqueDays = [...new Set(employeeEvents.map(e => e.timestamp.split(' ')[0]))];
        summary[employee].days_worked = uniqueDays.length;
        summary[employee].estimated_hours = Math.round(summary[employee].days_worked * 8.5); // Assuming 8.5 hour days
    });
    
    res.json({
        success: true,
        month: 'January 2026',
        period: 'January 1-31, 2026',
        totalEvents: januaryEvents.length,
        events: eventsWithDays,
        employeeSummary: summary,
        device: 'FC4349999 (Hikvision Access Control)',
        message: `Successfully extracted ${januaryEvents.length} attendance events for January 2026`
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'January 2026 Events Demo',
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = 3003;
app.listen(PORT, () => {
    console.log('\n📅 JANUARY 2026 ATTENDANCE EVENTS DEMO');
    console.log('='.repeat(50));
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔗 Test endpoint: http://localhost:${PORT}/january-events`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log('\n✨ Ready to display January events for testing!');
});