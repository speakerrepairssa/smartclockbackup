/**
 * Default Professional Payslip Template
 * Similar to SimplePay and other professional payroll services
 */

export const DEFAULT_PAYSLIP_TEMPLATE = {
  name: "Professional Payslip",
  subject: "Your Payslip for {{month}} {{year}}",
  
  // Company Information
  companyName: "{{businessName}}",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  companyLogo: "", // URL to logo
  taxNumber: "",
  registrationNumber: "",
  
  // Styling Options
  primaryColor: "#2563eb", // Blue
  secondaryColor: "#64748b", // Gray
  showLogo: true,
  showCompanyDetails: true,
  
  // Sections to include
  sections: {
    companyHeader: true,
    employeeDetails: true,
    payPeriod: true,
    earnings: true,
    deductions: true,
    summary: true,
    footer: true
  },
  
  // Deduction Configuration (South African Standard)
  deductionTypes: {
    uif: {
      enabled: true,
      label: "UIF (Unemployment Insurance Fund)",
      rate: 1.0, // 1% of gross
      description: "1% of gross salary"
    },
    paye: {
      enabled: true,
      label: "PAYE (Income Tax)",
      rate: 0, // Calculated based on tax brackets
      description: "As per SARS tax tables"
    },
    pension: {
      enabled: false,
      label: "Pension Fund Contribution",
      rate: 7.5, // Percentage of gross
      description: "Retirement annuity contribution"
    },
    medicalAid: {
      enabled: false,
      label: "Medical Aid Contribution",
      rate: 0, // Fixed amount
      description: "Monthly medical aid premium"
    },
    providentFund: {
      enabled: false,
      label: "Provident Fund",
      rate: 7.5,
      description: "Provident fund contribution"
    },
    other: {
      enabled: false,
      label: "Other Deductions",
      rate: 0,
      description: "Miscellaneous deductions"
    }
  },
  
  // Custom Messages
  headerMessage: "",
  footerMessage: "This is a computer-generated payslip. No signature is required.",
  
  // Generate HTML template
  generateHTML: function(data = {}) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background: #f8fafc;
      padding: 20px;
    }
    
    .payslip-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .payslip-header {
      background: ${this.primaryColor};
      color: white;
      padding: 30px;
      text-align: center;
    }
    
    .company-logo {
      max-width: 150px;
      margin-bottom: 15px;
    }
    
    .company-name {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    
    .company-details {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 10px;
    }
    
    .payslip-title {
      font-size: 24px;
      font-weight: 600;
      margin-top: 15px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .payslip-body {
      padding: 30px;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: ${this.primaryColor};
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid ${this.primaryColor};
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
    }
    
    .info-item {
      display: flex;
      flex-direction: column;
    }
    
    .info-label {
      font-size: 12px;
      color: ${this.secondaryColor};
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    
    .info-value {
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
    }
    
    .earnings-table, .deductions-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    
    .earnings-table th,
    .deductions-table th {
      background: #f1f5f9;
      padding: 12px;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .earnings-table td,
    .deductions-table td {
      padding: 12px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
    }
    
    .earnings-table tr:last-child td,
    .deductions-table tr:last-child td {
      border-bottom: none;
    }
    
    .amount {
      text-align: right;
      font-weight: 600;
      font-family: 'Courier New', monospace;
    }
    
    .summary-box {
      background: linear-gradient(135deg, ${this.primaryColor} 0%, #1e40af 100%);
      color: white;
      padding: 25px;
      border-radius: 8px;
      margin-top: 20px;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .summary-item {
      text-align: center;
    }
    
    .summary-label {
      font-size: 12px;
      opacity: 0.9;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .summary-value {
      font-size: 20px;
      font-weight: 700;
      font-family: 'Courier New', monospace;
    }
    
    .net-pay-box {
      border-top: 2px solid rgba(255,255,255,0.3);
      padding-top: 20px;
      text-align: center;
    }
    
    .net-pay-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 8px;
    }
    
    .net-pay-amount {
      font-size: 36px;
      font-weight: 700;
      font-family: 'Courier New', monospace;
    }
    
    .payslip-footer {
      background: #f8fafc;
      padding: 20px 30px;
      border-top: 1px solid #e2e8f0;
      font-size: 13px;
      color: ${this.secondaryColor};
      text-align: center;
    }
    
    .custom-message {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 4px;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .payslip-container {
        border: none;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="payslip-container">
    ${this.sections.companyHeader ? `
    <div class="payslip-header">
      ${this.showLogo && this.companyLogo ? `
        <img src="${this.companyLogo}" alt="Company Logo" class="company-logo">
      ` : ''}
      <div class="company-name">${this.companyName || '{{businessName}}'}</div>
      ${this.showCompanyDetails ? `
        <div class="company-details">
          ${this.companyAddress ? `${this.companyAddress}<br>` : ''}
          ${this.companyPhone ? `Tel: ${this.companyPhone}` : ''} 
          ${this.companyEmail ? ` | Email: ${this.companyEmail}` : ''}<br>
          ${this.taxNumber ? `Tax No: ${this.taxNumber}` : ''}
          ${this.registrationNumber ? ` | Reg No: ${this.registrationNumber}` : ''}
        </div>
      ` : ''}
      <div class="payslip-title">Payslip</div>
    </div>
    ` : ''}
    
    <div class="payslip-body">
      ${this.headerMessage ? `
      <div class="custom-message">
        ${this.headerMessage}
      </div>
      ` : ''}
      
      ${this.sections.employeeDetails ? `
      <div class="section">
        <div class="section-title">Employee Information</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Employee Name</div>
            <div class="info-value">{{employeeName}}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Position</div>
            <div class="info-value">{{position}}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Employee ID</div>
            <div class="info-value">{{employeeId}}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Pay Rate</div>
            <div class="info-value">R {{payRate}}/hour</div>
          </div>
        </div>
      </div>
      ` : ''}
      
      ${this.sections.payPeriod ? `
      <div class="section">
        <div class="section-title">Pay Period</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Period</div>
            <div class="info-value">{{month}} {{year}}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Pay Date</div>
            <div class="info-value">{{payDate}}</div>
          </div>
        </div>
      </div>
      ` : ''}
      
      ${this.sections.earnings ? `
      <div class="section">
        <div class="section-title">Earnings</div>
        <table class="earnings-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Hours</th>
              <th style="text-align: right;">Rate</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Regular Hours</td>
              <td class="amount">{{regularHours}}</td>
              <td class="amount">R {{payRate}}</td>
              <td class="amount">R {{regularPay}}</td>
            </tr>
            <tr>
              <td>Overtime Hours (1.5x)</td>
              <td class="amount">{{overtimeHours}}</td>
              <td class="amount">R {{overtimeRate}}</td>
              <td class="amount">R {{overtimePay}}</td>
            </tr>
            <tr style="font-weight: 700; background: #f8fafc;">
              <td colspan="3">Total Earnings</td>
              <td class="amount">R {{grossPay}}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${this.sections.deductions ? `
      <div class="section">
        <div class="section-title">Deductions</div>
        <table class="deductions-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${this.deductionTypes.uif.enabled ? `
            <tr>
              <td>${this.deductionTypes.uif.label}</td>
              <td class="amount">R {{uif}}</td>
            </tr>
            ` : ''}
            ${this.deductionTypes.paye.enabled ? `
            <tr>
              <td>${this.deductionTypes.paye.label}</td>
              <td class="amount">R {{paye}}</td>
            </tr>
            ` : ''}
            ${this.deductionTypes.pension.enabled ? `
            <tr>
              <td>${this.deductionTypes.pension.label}</td>
              <td class="amount">R {{pension}}</td>
            </tr>
            ` : ''}
            ${this.deductionTypes.medicalAid.enabled ? `
            <tr>
              <td>${this.deductionTypes.medicalAid.label}</td>
              <td class="amount">R {{medicalAid}}</td>
            </tr>
            ` : ''}
            ${this.deductionTypes.providentFund.enabled ? `
            <tr>
              <td>${this.deductionTypes.providentFund.label}</td>
              <td class="amount">R {{providentFund}}</td>
            </tr>
            ` : ''}
            ${this.deductionTypes.other.enabled ? `
            <tr>
              <td>${this.deductionTypes.other.label}</td>
              <td class="amount">R {{otherDeductions}}</td>
            </tr>
            ` : ''}
            <tr style="font-weight: 700; background: #f8fafc; border-top: 2px solid ${this.primaryColor};">
              <td>Total Deductions</td>
              <td class="amount">R {{deductions}}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${this.sections.summary ? `
      <div class="section">
        <div class="summary-box">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Total Hours</div>
              <div class="summary-value">{{hoursWorked}}h</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Gross Pay</div>
              <div class="summary-value">R {{grossPay}}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Deductions</div>
              <div class="summary-value">R {{deductions}}</div>
            </div>
          </div>
          <div class="net-pay-box">
            <div class="net-pay-label">NET PAY</div>
            <div class="net-pay-amount">R {{netPay}}</div>
          </div>
        </div>
      </div>
      ` : ''}
    </div>
    
    ${this.sections.footer ? `
    <div class="payslip-footer">
      ${this.footerMessage}
    </div>
    ` : ''}
  </div>
</body>
</html>
    `.trim();
  }
};

// Export function to create a customized instance
export function createPayslipTemplate(customizations = {}) {
  return {
    ...DEFAULT_PAYSLIP_TEMPLATE,
    ...customizations,
    generateHTML: DEFAULT_PAYSLIP_TEMPLATE.generateHTML
  };
}
