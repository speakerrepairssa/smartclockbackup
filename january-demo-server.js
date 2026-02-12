const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// Simulate January 2026 events
const januaryEvents = [
    // Week 1 January (Jan 1-7, 2026)
    { id: 'jan_1', employeeId: '3', employeeName: 'qaasiem', timestamp: '2026-01-02 08:15:00', eventType: 'check_in' },
    { id: 'jan_2', employeeId: '3', employeeName: 'qaasiem', timestamp: '2026-01-02 17:30:00', eventType: 'check_out' },
    { id: 'jan_3', employeeId: '8', employeeName: 'az8', timestamp: '2026-01-03 09:00:00', eventType: 'check_in' },
    { id: 'jan_4', employeeId: '8', employeeName: 'az8', timestamp: '2026-01-03 18:15:00', eventType: 'check_out' },
    
    // Week 2 January (Jan 8-14, 2026)
    { id: 'jan_5', employeeId: '5', employeeName: 'luq', timestamp: '2026-01-08 08:45:00', eventType: 'check_in' },
    { id: 'jan_6', employeeId: '5', employeeName: 'luq', timestamp: '2026-01-08 17:00:00', eventType: 'check_out' },
    { id: 'jan_7', employeeId: '3', employeeName: 'qaasiem', timestamp: '2026-01-10 08:30:00', eventType: 'check_in' },
    { id: 'jan_8', employeeId: '3', employeeName: 'qaasiem', timestamp: '2026-01-10 17:45:00', eventType: 'check_out' },
    
    // Week 3 January (Jan 15-21, 2026)
    { id: 'jan_9', employeeId: '8', employeeName: 'az8', timestamp: '2026-01-15 09:15:00', eventType: 'check_in' },
    { id: 'jan_10', employeeId: '8', employeeName: 'az8', timestamp: '2026-01-15 18:00:00', eventType: 'check_out' },
    { id: 'jan_11', employeeId: '5', employeeName: 'luq', timestamp: '2026-01-17 08:20:00', eventType: 'check_in' },
    { id: 'jan_12', employeeId: '5', employeeName: 'luq', timestamp: '2026-01-17 16:45:00', eventType: 'check_out' },
    
    // Week 4 January (Jan 22-28, 2026)
    { id: 'jan_13', employeeId: '3', employeeName: 'qaasiem', timestamp: '2026-01-22 08:10:00', eventType: 'check_in' },
    { id: 'jan_14', employeeId: '3', employeeName: 'qaasiem', timestamp: '2026-01-22 17:20:00', eventType: 'check_out' },
    { id: 'jan_15', employeeId: '8', employeeName: 'az8', timestamp: '2026-01-24 09:30:00', eventType: 'check_in' },
    { id: 'jan_16', employeeId: '8', employeeName: 'az8', timestamp: '2026-01-24 18:30:00', eventType: 'check_out' },
    
    // End of January
    { id: 'jan_17', employeeId: '5', employeeName: 'luq', timestamp: '2026-01-31 08:00:00', eventType: 'check_in' },
    { id: 'jan_18', employeeId: '5', employeeName: 'luq', timestamp: '2026-01-31 17:00:00', eventType: 'check_out' }
];

app.get('/january-events', (req, res) => {
    // Add day names for better display
    const eventsWithDays = januaryEvents.map(event => {
        const date = new Date(event.timestamp + 'Z');
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
        return { ...event, dayName };
    });
    
    // Calculate summary
    const summary = {};
    januaryEvents.forEach(e => {
        if (!summary[e.employeeName]) {
            summary[e.employeeName] = { check_ins: 0, check_outs: 0, total: 0 };
        }
        summary[e.employeeName][e.eventType === 'check_in' ? 'check_ins' : 'check_outs']++;
        summary[e.employeeName].total++;
    });
    
    res.json({
        success: true,
        month: 'January 2026',
        totalEvents: januaryEvents.length,
        events: eventsWithDays,
        summary: summary,
        message: `Found ${januaryEvents.length} attendance events for January 2026`
    });
});

const PORT = 3003;
app.listen(PORT, () => {
    console.log(`📅 January Events Test Server running on http://localhost:${PORT}`);
    console.log(`🔗 Test endpoint: http://localhost:${PORT}/january-events`);
});