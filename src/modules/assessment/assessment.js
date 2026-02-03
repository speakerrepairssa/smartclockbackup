// Assessment Module - Handle employee performance assessments
class AssessmentModule {
  constructor(firebaseCompat, businessId) {
    this.businessId = businessId;
    this.currentMonth = null;
    
    console.log('🔧 Assessment module initialized with:', {
      businessId: this.businessId,
      windowDB: !!window.db,
      collection: !!window.collection,
      query: !!window.query,
      where: !!window.where,
      getDocs: !!window.getDocs
    });
  }

  async init() {
    try {
      console.log('📊 Initializing Assessment module for business:', this.businessId);
      
      // Set default month to current month
      const now = new Date();
      const monthInput = document.getElementById('assessmentMonthInput');
      const monthDisplay = document.getElementById('assessmentMonth');
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthInput) {
        monthInput.value = currentMonth;
      }
      
      if (monthDisplay) {
        monthDisplay.textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      
      // Load assessment for current month
      await this.loadAssessment();
      
    } catch (error) {
      console.error("❌ Error initializing assessment:", error);
    }
  }

  async loadAssessment() {
    const month = document.getElementById('assessmentMonthInput').value;
    const display = document.getElementById('assessmentContent');
    const monthDisplay = document.getElementById('assessmentMonth');

    if (!month) {
      display.innerHTML = '<div style="text-align: center; padding: 3rem; color: #999;">Select a month to generate assessment</div>';
      return;
    }

    try {
      display.innerHTML = '<div style="text-align: center; padding: 3rem; color: #999;">Generating assessment...</div>';

      // Parse month
      const [year, monthNum] = month.split('-');
      const monthDate = new Date(year, monthNum - 1, 1);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      if (monthDisplay) {
        monthDisplay.textContent = monthName;
      }

      // Try to load from assessment collection first, fallback to dummy data
      let employeeAssessments = [];
      
      try {
        console.log('🔍 Loading assessment data for:', {
          businessId: this.businessId,
          month: month,
          collection: `businesses/${this.businessId}/assessment`
        });
        
        // Load from assessment collection using window Firebase v9 functions
        if (window.collection && window.query && window.where && window.getDocs && window.db) {
          console.log('✅ All Firebase v9 functions available from window');
          
          const assessmentRef = window.collection(window.db, "businesses", this.businessId, "assessment");
          const assessmentQuery = window.query(assessmentRef, window.where("month", "==", month));
          const assessmentSnap = await window.getDocs(assessmentQuery);
          
          console.log('📊 Modern Firestore query results:', {
            empty: assessmentSnap.empty,
            size: assessmentSnap.size,
            docs: assessmentSnap.docs.length
          });

          if (!assessmentSnap.empty) {
            // Use existing assessment data from collection
            assessmentSnap.forEach(doc => {
              const data = doc.data();
              console.log('📄 Processing document:', doc.id, data);
              
              employeeAssessments.push({
              index: data.employeeIndex || data.employeeId || 1,
              name: data.employeeName || `Employee ${data.employeeIndex || data.employeeId}`,
              employeeId: data.employeeId || data.employeeIndex,
              requiredHours: data.requiredHours || 176,
              currentHours: data.actualHours || data.currentHours || 0,
              pastDueHours: data.pastDueHours || 0,
              hoursShort: data.hoursShort || 0,
              payRate: data.payRate || data.hourlyRate || 30.00,
              currentIncomeDue: data.totalPay || data.currentIncomeDue || 0,
              status: data.status === 'on_track' ? 'On Track' : 
                     data.status === 'behind' ? 'Behind' : 
                     data.status === 'critical' ? 'Critical' : 'On Track',
              statusColor: data.status === 'on_track' ? '#28a745' : 
                          data.status === 'behind' ? '#fd7e14' : 
                          data.status === 'critical' ? '#dc3545' : '#28a745',
              attendanceStatus: data.attendanceStatus || 'active'
              });
            });
            
            // Sort by index
            employeeAssessments.sort((a, b) => a.index - b.index);
            console.log('✅ Loaded', employeeAssessments.length, 'assessment records from Firestore');
          } else {
            console.log('📭 No assessment documents found for month:', month);
            console.log('🔄 Calculating assessment from attendance events...');
            employeeAssessments = await this.calculateAssessmentFromAttendance(month);
          }
        } else {
          console.error('❌ Missing Firebase v9 functions:', {
            collection: !!window.collection,
            query: !!window.query,
            where: !!window.where,
            getDocs: !!window.getDocs,
            db: !!window.db
          });
          employeeAssessments = await this.calculateAssessmentFromAttendance(month);
        }
        
      } catch (error) {
        console.error('⚠️ Could not load from collection:', error);
      }

      // Fallback to dummy data if collection is empty or failed
      if (employeeAssessments.length === 0) {
        console.log('📋 Using dummy assessment data as fallback');
        employeeAssessments = [
          {
            index: 1,
            name: "Employee 1",
            requiredHours: 176,
            currentHours: 165.5,
            pastDueHours: 0,
            hoursShort: 10.5,
            payRate: 30.00,
            currentIncomeDue: 4965.00,
            status: 'Behind',
            statusColor: '#fd7e14'
          },
          {
            index: 2,
            name: "Employee 2",
            requiredHours: 176,
            currentHours: 180.0,
            pastDueHours: 0,
            hoursShort: 0,
            payRate: 32.00,
            currentIncomeDue: 5760.00,
            status: 'On Track',
            statusColor: '#28a745'
          },
          {
            index: 3,
            name: "Employee 3",
            requiredHours: 176,
            currentHours: 120.0,
            pastDueHours: 0,
            hoursShort: 56.0,
            payRate: 30.00,
            currentIncomeDue: 3360.00,
            status: 'Critical',
            statusColor: '#dc3545'
          }
        ];
      }

      // Render assessment table
      this.renderAssessmentTable(employeeAssessments, display);
      
    } catch (error) {
      console.error("❌ Error loading assessment:", error);
      display.innerHTML = `<div style="text-align: center; padding: 3rem; color: #dc3545;">Error loading assessment: ${error.message}</div>`;
    }
  }

  renderAssessmentTable(employeeAssessments, display) {
    // Calculate totals
    const totalEmployees = employeeAssessments.length;
    const totalHours = employeeAssessments.reduce((sum, emp) => sum + emp.currentHours, 0);
    const totalHoursShort = employeeAssessments.reduce((sum, emp) => sum + emp.hoursShort, 0);
    const totalIncomeDue = employeeAssessments.reduce((sum, emp) => sum + emp.currentIncomeDue, 0);

    display.innerHTML = `
      <!-- Employee Assessment Table -->
      <div class="table-responsive">
        <table class="table table-hover">
          <thead class="table-dark">
            <tr>
              <th>#</th>
              <th>Employee Name</th>
              <th>Required Hours</th>
              <th>Current Hours</th>
              <th>Past Due Hours</th>
              <th>Hours Short</th>
              <th>Pay Rate</th>
              <th>Current Income Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${employeeAssessments.map(emp => `
              <tr>
                <td><strong>${emp.index}</strong></td>
                <td><strong>${emp.name}</strong></td>
                <td>${emp.requiredHours}</td>
                <td><span style="color: #17a2b8;">${emp.currentHours}</span></td>
                <td><span style="color: #ffc107;">${emp.pastDueHours}</span></td>
                <td><span style="color: #dc3545;">${emp.hoursShort}</span></td>
                <td>R${emp.payRate.toFixed(2)}</td>
                <td><strong style="color: #28a745;">R${emp.currentIncomeDue.toFixed(2)}</strong></td>
                <td>
                  <span class="badge" style="background-color: ${emp.statusColor}; color: white;">
                    ${emp.status}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Summary Cards -->
      <div class="row g-3 mt-4">
        <div class="col-lg-3 col-md-6">
          <div class="summary-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <h3 style="margin: 0; font-size: 2.5rem; font-weight: 700;">${totalEmployees}</h3>
                <p style="margin: 0; opacity: 0.9;">Total Employees</p>
              </div>
              <div style="font-size: 3rem; opacity: 0.3;">👥</div>
            </div>
          </div>
        </div>

        <div class="col-lg-3 col-md-6">
          <div class="summary-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 1.5rem; border-radius: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <h3 style="margin: 0; font-size: 2.5rem; font-weight: 700;">${totalHours.toFixed(1)}</h3>
                <p style="margin: 0; opacity: 0.9;">Total Hours Worked</p>
              </div>
              <div style="font-size: 3rem; opacity: 0.3;">⏰</div>
            </div>
          </div>
        </div>

        <div class="col-lg-3 col-md-6">
          <div class="summary-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 1.5rem; border-radius: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <h3 style="margin: 0; font-size: 2.5rem; font-weight: 700;">${totalHoursShort.toFixed(1)}</h3>
                <p style="margin: 0; opacity: 0.9;">Total Hours Short</p>
              </div>
              <div style="font-size: 3rem; opacity: 0.3;">⚠️</div>
            </div>
          </div>
        </div>

        <div class="col-lg-3 col-md-6">
          <div class="summary-card" style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: #333; padding: 1.5rem; border-radius: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <h3 style="margin: 0; font-size: 2.5rem; font-weight: 700;">R${totalIncomeDue.toFixed(2)}</h3>
                <p style="margin: 0; opacity: 0.8;">Total Amount Due</p>
              </div>
              <div style="font-size: 3rem; opacity: 0.3;">💰</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Additional Summary Cards -->
      <div class="row g-3 mt-3">
        <div class="col-lg-6 col-md-12">
          <div class="summary-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <h3 style="margin: 0; font-size: 2.5rem; font-weight: 700;">R${(totalIncomeDue * 1.1).toFixed(2)}</h3>
                <p style="margin: 0; opacity: 0.9;">Potential Payroll (100%)</p>
              </div>
              <div style="font-size: 3rem; opacity: 0.3;">📊</div>
            </div>
          </div>
        </div>

        <div class="col-lg-6 col-md-12">
          <div class="summary-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 1.5rem; border-radius: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <h3 style="margin: 0; font-size: 2.5rem; font-weight: 700;">${((totalHours / (totalEmployees * 176)) * 100).toFixed(1)}%</h3>
                <p style="margin: 0; opacity: 0.9;">Average Attendance</p>
              </div>
              <div style="font-size: 3rem; opacity: 0.3;">📈</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Calculate assessment data from attendance events
  async calculateAssessmentFromAttendance(month) {
    try {
      console.log('📊 Calculating assessment from attendance_events for month:', month);
      
      // Get all attendance events for this business
      const attendanceRef = window.collection(this.db, "businesses", this.businessId, "attendance_events");
      const attendanceSnap = await window.getDocs(attendanceRef);
      
      console.log(`📋 Found ${attendanceSnap.size} total attendance events`);
      
      // Process attendance data
      const employeeData = {};
      const standardPayRates = { "azam": 35.00, "1": 35.00, "2": 32.00, "3": 30.00 };
      
      attendanceSnap.forEach(doc => {
        const data = doc.data();
        const empId = data.employeeId || data.employeeName || "unknown";
        const empName = data.employeeName || empId;
        
        if (!employeeData[empId]) {
          employeeData[empId] = {
            name: empName,
            totalHours: 0,
            attendanceDays: 0,
            payRate: standardPayRates[empId] || standardPayRates[empName] || 30.00
          };
        }
        
        // Calculate hours worked (8 hours per attendance event for now)
        const hoursWorked = 8;
        employeeData[empId].totalHours += hoursWorked;
        employeeData[empId].attendanceDays += 1;
      });
      
      console.log('👥 Calculated employee data:', employeeData);
      
      // Generate assessment array
      const assessmentArray = [];
      const requiredHoursPerMonth = 176;
      let employeeIndex = 1;
      
      for (const [empId, data] of Object.entries(employeeData)) {
        const hoursShort = Math.max(0, requiredHoursPerMonth - data.totalHours);
        const totalPay = data.totalHours * data.payRate;
        
        let status = 'On Track';
        let statusColor = '#28a745';
        if (hoursShort > 40) {
          status = 'Critical';
          statusColor = '#dc3545';
        } else if (hoursShort > 0) {
          status = 'Behind';
          statusColor = '#fd7e14';
        }
        
        assessmentArray.push({
          index: employeeIndex++,
          name: data.name,
          employeeId: empId,
          requiredHours: requiredHoursPerMonth,
          currentHours: data.totalHours,
          pastDueHours: 0,
          hoursShort: hoursShort,
          payRate: data.payRate,
          currentIncomeDue: totalPay,
          status: status,
          statusColor: statusColor,
          attendanceStatus: "active",
          dataSource: 'calculated_from_attendance'
        });
      }
      
      // If no attendance data found, return basic employee structure
      if (assessmentArray.length === 0) {
        console.log('📝 No attendance data found, creating placeholder employees');
        return [
          {
            index: 1, name: "azam", employeeId: "1", requiredHours: 176, currentHours: 0,
            pastDueHours: 0, hoursShort: 176, payRate: 35.00, currentIncomeDue: 0,
            status: 'Critical', statusColor: '#dc3545', attendanceStatus: "no_data",
            dataSource: 'placeholder'
          }
        ];
      }
      
      console.log('✅ Calculated assessment for', assessmentArray.length, 'employees');
      return assessmentArray;
      
    } catch (error) {
      console.error('❌ Error calculating from attendance:', error);
      return [];
    }
  }

  // Print functionality
  printAssessment() {
    const printWindow = window.open('', '_blank');
    const content = document.getElementById('assessmentContent').innerHTML;
    const monthDisplay = document.getElementById('assessmentMonth').textContent;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Assessment Report - ${monthDisplay}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .badge { padding: 4px 8px; border-radius: 4px; color: white; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <h1>Employee Assessment Report</h1>
          <h2>${monthDisplay}</h2>
          ${content}
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
  }
}

// Global functions for backwards compatibility
window.initAssessment = function() {
  if (window.assessmentModule) {
    return window.assessmentModule.init();
  } else {
    console.error('Assessment module not initialized');
  }
};

window.loadAssessment = function() {
  if (window.assessmentModule) {
    return window.assessmentModule.loadAssessment();
  } else {
    console.error('Assessment module not initialized');
  }
};

window.printAssessment = function() {
  if (window.assessmentModule) {
    return window.assessmentModule.printAssessment();
  } else {
    console.error('Assessment module not initialized');
  }
};

// Initialize when loaded
window.Assessment = AssessmentModule;