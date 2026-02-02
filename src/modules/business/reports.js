/**
 * Business Reports Module - Staff Attendance Reports
 * Generates individual staff member attendance reports with detailed analytics
 */

export class BusinessReports {
  constructor(businessId, db) {
    this.businessId = businessId;
    this.db = db;
  }

  async initialize() {
    console.log('Reports module initialized');
    const display = document.getElementById('reportsContent');
    if (display) {
      display.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: #666;">
          <h3>📊 Staff Reports Module</h3>
          <p>Select a month above and click "Refresh Reports" to view individual staff member attendance reports</p>
        </div>
      `;
    }

    // Set current month as default
    const monthInput = document.getElementById('reportMonth');
    if (monthInput && !monthInput.value) {
      const currentDate = new Date();
      const currentMonth = currentDate.getFullYear() + '-' + 
        String(currentDate.getMonth() + 1).padStart(2, '0');
      monthInput.value = currentMonth;
    }
  }

  async loadReports() {
    const display = document.getElementById('reportsContent');
    if (!display) return;

    // Get selected month from report controls
    const monthInput = document.getElementById('reportMonth');
    const selectedMonth = monthInput ? monthInput.value : '';
    
    if (!selectedMonth) {
      display.innerHTML = `
        <div style="padding: 2rem; background: #fff3cd; border-radius: 8px; color: #856404;">
          <h3>⚠️ Please Select a Month</h3>
          <p>Choose a month from the dropdown above to generate reports</p>
        </div>
      `;
      return;
    }

    try {
      display.innerHTML = '<div style="text-align: center; padding: 3rem; color: #999;">🔄 Generating staff reports...</div>';

      console.log('Loading reports for month:', selectedMonth);
      console.log('Business ID:', this.businessId);

      // Wait for Firebase to be ready
      let retries = 0;
      while ((!window.db || !window.firestoreFunctions) && retries < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }

      if (!window.db || !window.firestoreFunctions) {
        throw new Error('Firebase not available. Please refresh the page.');
      }

      const { collection, getDocs, query, where, orderBy } = window.firestoreFunctions;

      // Get staff members
      console.log('Step 1: Fetching staff members');
      const staffRef = collection(window.db, "businesses", this.businessId, "staff");
      const staffSnap = await getDocs(staffRef);
      
      if (staffSnap.empty) {
        display.innerHTML = `
          <div style="padding: 2rem; background: #fff3cd; border-radius: 8px;">
            <h3>⚠️ No Staff Found</h3>
            <p>No staff members found for this business.</p>
          </div>
        `;
        return;
      }

      // Get staff data
      const staffMembers = [];
      staffSnap.forEach(doc => {
        const data = doc.data();
        if (data.active !== false) { // Include active staff and those without active field
          staffMembers.push({
            id: doc.id,
            slotId: doc.id,
            ...data
          });
        }
      });

      console.log('Step 2: Found staff members:', staffMembers.length);

      // Generate reports for each staff member
      const staffReports = [];
      const [year, month] = selectedMonth.split('-');
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Last day of month

      console.log('Step 3: Analyzing attendance data for date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);

      for (const staff of staffMembers) {
        console.log('Processing staff member:', staff.employeeName, 'Slot:', staff.slotId);
        
        try {
          // Get attendance events for this staff member for the selected month
          const attendanceRef = collection(window.db, "businesses", this.businessId, "attendance_events");
          const attendanceQuery = query(
            attendanceRef,
            where("slotNumber", "==", parseInt(staff.slotId)),
            where("eventDate", ">=", startDate.toISOString().split('T')[0]),
            where("eventDate", "<=", endDate.toISOString().split('T')[0]),
            orderBy("eventDate", "asc"),
            orderBy("timestamp", "asc")
          );
          
          const attendanceSnap = await getDocs(attendanceQuery);
          
          console.log(`Found ${attendanceSnap.size} attendance events for ${staff.employeeName}`);

          // Process attendance events
          const events = [];
          attendanceSnap.forEach(doc => {
            const eventData = doc.data();
            events.push({
              id: doc.id,
              ...eventData
            });
          });

          // Calculate attendance statistics
          const report = this.calculateStaffReport(staff, events, startDate, endDate);
          staffReports.push(report);

        } catch (error) {
          console.error(`Error processing ${staff.employeeName}:`, error);
          staffReports.push({
            staff: staff,
            error: error.message,
            totalDays: 0,
            daysWorked: 0,
            totalHours: 0,
            attendanceRate: 0,
            dailyRecords: []
          });
        }
      }

      console.log('Step 4: Generated reports for', staffReports.length, 'staff members');

      // Display the reports
      this.displayStaffReports(staffReports, selectedMonth, display);

    } catch (error) {
      console.error('Error loading reports:', error);
      this.showError('Error loading reports: ' + error.message);
    }
  }

  calculateStaffReport(staff, events, startDate, endDate) {
    // Calculate total work days in the month (excluding weekends)
    const totalDays = this.getWorkDaysInMonth(startDate, endDate);
    
    // Group events by date
    const eventsByDate = {};
    events.forEach(event => {
      const date = event.eventDate || event.timestamp?.split('T')[0];
      if (date) {
        if (!eventsByDate[date]) {
          eventsByDate[date] = [];
        }
        eventsByDate[date].push(event);
      }
    });

    // Process each day
    const dailyRecords = [];
    let totalHours = 0;
    let daysWorked = 0;

    Object.keys(eventsByDate).sort().forEach(date => {
      const dayEvents = eventsByDate[date].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      
      const dayRecord = this.calculateDayRecord(date, dayEvents);
      dailyRecords.push(dayRecord);
      
      if (dayRecord.hoursWorked > 0) {
        daysWorked++;
        totalHours += dayRecord.hoursWorked;
      }
    });

    // Calculate attendance rate
    const attendanceRate = totalDays > 0 ? Math.round((daysWorked / totalDays) * 100) : 0;

    return {
      staff: staff,
      totalDays: totalDays,
      daysWorked: daysWorked,
      totalHours: Math.round(totalHours * 10) / 10, // Round to 1 decimal
      averageHoursPerDay: daysWorked > 0 ? Math.round((totalHours / daysWorked) * 10) / 10 : 0,
      attendanceRate: attendanceRate,
      dailyRecords: dailyRecords,
      error: null
    };
  }

  calculateDayRecord(date, events) {
    const record = {
      date: date,
      clockIn: null,
      clockOut: null,
      hoursWorked: 0,
      status: 'Absent',
      events: events.map(e => ({
        time: new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false }),
        type: e.attendanceStatus,
        timestamp: e.timestamp
      }))
    };

    if (events.length === 0) {
      return record;
    }

    // Find clock in/out pairs
    let clockInTime = null;
    let totalMinutes = 0;

    for (let event of events) {
      if (event.attendanceStatus === 'in') {
        if (!clockInTime) {
          clockInTime = new Date(event.timestamp);
          if (!record.clockIn) {
            record.clockIn = clockInTime.toLocaleTimeString('en-US', { hour12: false });
          }
        }
      } else if (event.attendanceStatus === 'out' && clockInTime) {
        const clockOutTime = new Date(event.timestamp);
        const minutes = (clockOutTime - clockInTime) / (1000 * 60);
        totalMinutes += minutes;
        
        record.clockOut = clockOutTime.toLocaleTimeString('en-US', { hour12: false });
        clockInTime = null; // Reset for next pair
      }
    }

    record.hoursWorked = Math.round((totalMinutes / 60) * 10) / 10;
    
    if (record.hoursWorked > 0) {
      record.status = record.hoursWorked >= 8 ? 'Full Day' : 'Partial Day';
    } else if (events.length > 0) {
      record.status = 'Clock-in Only';
    }

    return record;
  }

  getWorkDaysInMonth(startDate, endDate) {
    let workDays = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Monday to Friday
        workDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return workDays;
  }

  displayStaffReports(staffReports, selectedMonth, display) {
    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });

    // Calculate summary statistics
    const totalStaff = staffReports.length;
    const activeStaff = staffReports.filter(r => r.daysWorked > 0).length;
    const avgAttendance = totalStaff > 0 ? 
      Math.round(staffReports.reduce((sum, r) => sum + r.attendanceRate, 0) / totalStaff) : 0;
    const totalHoursWorked = staffReports.reduce((sum, r) => sum + r.totalHours, 0);

    let html = `
      <div style="padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #e9ecef;">
          <h2 style="color: #2c5282; margin-bottom: 0.5rem;">📊 Staff Attendance Report</h2>
          <p style="color: #666; font-size: 1.1rem; margin: 0;">${monthName}</p>
        </div>

        <!-- Summary Stats -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
          <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 2rem; font-weight: bold; color: #2c5282;">${totalStaff}</div>
            <div style="color: #666; font-size: 0.9rem;">Total Staff</div>
          </div>
          <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 2rem; font-weight: bold; color: #28a745;">${activeStaff}</div>
            <div style="color: #666; font-size: 0.9rem;">Active Staff</div>
          </div>
          <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 2rem; font-weight: bold; color: #ffc107;">${avgAttendance}%</div>
            <div style="color: #666; font-size: 0.9rem;">Avg Attendance</div>
          </div>
          <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 2rem; font-weight: bold; color: #17a2b8;">${Math.round(totalHoursWorked)}</div>
            <div style="color: #666; font-size: 0.9rem;">Total Hours</div>
          </div>
        </div>

        <!-- Individual Staff Reports -->
        <div style="display: grid; gap: 1.5rem;">
    `;

    staffReports.forEach(report => {
      const staff = report.staff;
      const statusColor = report.attendanceRate >= 90 ? '#28a745' : 
                         report.attendanceRate >= 70 ? '#ffc107' : '#dc3545';

      html += `
        <div style="border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden;">
          
          <!-- Staff Header -->
          <div style="background: ${statusColor}; color: white; padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="margin: 0; font-size: 1.2rem;">${staff.employeeName || 'Unknown Employee'}</h3>
              <p style="margin: 0.25rem 0 0 0; opacity: 0.9; font-size: 0.9rem;">
                Slot ${staff.slotId} • Badge: ${staff.badgeNumber || staff.slotId}
              </p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.5rem; font-weight: bold;">${report.attendanceRate}%</div>
              <div style="font-size: 0.8rem; opacity: 0.9;">Attendance Rate</div>
            </div>
          </div>

          <!-- Staff Stats -->
          <div style="padding: 1rem; background: #f8f9fa; display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; text-align: center; border-bottom: 1px solid #dee2e6;">
            <div>
              <div style="font-weight: bold; color: #333;">${report.daysWorked}</div>
              <div style="font-size: 0.8rem; color: #666;">Days Worked</div>
            </div>
            <div>
              <div style="font-weight: bold; color: #333;">${report.totalHours}</div>
              <div style="font-size: 0.8rem; color: #666;">Total Hours</div>
            </div>
            <div>
              <div style="font-weight: bold; color: #333;">${report.averageHoursPerDay}</div>
              <div style="font-size: 0.8rem; color: #666;">Avg Hours/Day</div>
            </div>
          </div>

          <!-- Daily Records -->
          <div style="padding: 1rem;">
            <h4 style="margin: 0 0 1rem 0; color: #333; font-size: 1rem;">Daily Attendance Records</h4>
            
            ${report.dailyRecords.length > 0 ? `
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                  <thead>
                    <tr style="background: #f8f9fa;">
                      <th style="padding: 0.5rem; text-align: left; border: 1px solid #dee2e6;">Date</th>
                      <th style="padding: 0.5rem; text-align: center; border: 1px solid #dee2e6;">Clock In</th>
                      <th style="padding: 0.5rem; text-align: center; border: 1px solid #dee2e6;">Clock Out</th>
                      <th style="padding: 0.5rem; text-align: center; border: 1px solid #dee2e6;">Hours</th>
                      <th style="padding: 0.5rem; text-align: center; border: 1px solid #dee2e6;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${report.dailyRecords.map(day => {
                      const statusBadgeColor = day.status === 'Absent' ? '#dc3545' :
                                              day.status === 'Full Day' ? '#28a745' :
                                              day.status === 'Partial Day' ? '#ffc107' : '#6c757d';
                      
                      return `
                        <tr>
                          <td style="padding: 0.5rem; border: 1px solid #dee2e6; font-weight: 500;">
                            ${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </td>
                          <td style="padding: 0.5rem; border: 1px solid #dee2e6; text-align: center;">
                            ${day.clockIn || '-'}
                          </td>
                          <td style="padding: 0.5rem; border: 1px solid #dee2e6; text-align: center;">
                            ${day.clockOut || '-'}
                          </td>
                          <td style="padding: 0.5rem; border: 1px solid #dee2e6; text-align: center; font-weight: 500;">
                            ${day.hoursWorked || '0'}
                          </td>
                          <td style="padding: 0.5rem; border: 1px solid #dee2e6; text-align: center;">
                            <span style="background: ${statusBadgeColor}; color: white; padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.8rem;">
                              ${day.status}
                            </span>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div style="text-align: center; padding: 2rem; color: #666; background: #f8f9fa; border-radius: 8px;">
                No attendance records found for this month
              </div>
            `}
            
            ${report.error ? `
              <div style="margin-top: 1rem; padding: 0.75rem; background: #f8d7da; color: #721c24; border-radius: 4px; font-size: 0.9rem;">
                ⚠️ Error: ${report.error}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    html += `
        </div>

        <!-- Footer -->
        <div style="margin-top: 2rem; padding-top: 1rem; border-top: 2px solid #e9ecef; text-align: center; color: #666; font-size: 0.9rem;">
          Report generated on ${new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })} at ${new Date().toLocaleTimeString('en-US')}
        </div>
      </div>
    `;

    display.innerHTML = html;
  }

  showError(message) {
    const display = document.getElementById('reportsContent');
    if (display) {
      display.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: #e53e3e;">
          <h3>⚠️ Error</h3>
          <p>${message}</p>
          <button onclick="window.businessReports.loadReports()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Try Again
          </button>
        </div>
      `;
    }
  }

  printReports() {
    // Hide navigation and other elements for clean printing
    const elementsToHide = ['nav', '.sidebar', '.report-controls'];
    const originalDisplay = [];
    
    elementsToHide.forEach((selector, index) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        originalDisplay.push(el.style.display);
        el.style.display = 'none';
      });
    });

    // Add print styles
    const printStyle = document.createElement('style');
    printStyle.innerHTML = `
      @media print {
        body { font-size: 12px; }
        .no-print { display: none !important; }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; page-break-after: auto; }
      }
    `;
    document.head.appendChild(printStyle);

    // Trigger print
    window.print();

    // Restore original display after printing
    setTimeout(() => {
      let displayIndex = 0;
      elementsToHide.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          el.style.display = originalDisplay[displayIndex] || '';
          displayIndex++;
        });
      });
      
      // Remove print styles
      document.head.removeChild(printStyle);
    }, 100);
  }
  }

  printReports() {
    window.print();
  }
}

// Export functions for global access
export function createReportsModule(businessId, db) {
  return new BusinessReports(businessId, db);
}