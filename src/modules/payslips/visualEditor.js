// Visual Payslip Editor - QuickBooks-style drag-and-drop editor
import { db } from "../../config/firebase.js";
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class VisualPayslipEditor {
  constructor(businessId) {
    this.businessId = businessId;
    this.currentTemplate = null;
    this.designSettings = {
      logo: null,
      primaryColor: '#667eea',
      secondaryColor: '#764ba2',
      fontFamily: 'Arial, sans-serif',
      showLogo: true,
      showCompanyInfo: true,
      headerLayout: 'left' // 'left', 'center', 'right'
    };
    this.components = [];
  }

  /**
   * Initialize the visual editor
   */
  async init() {
    this.setupUploadHandlers();
    this.loadDesignSettings();
    this.initializeComponents();
  }

  /**
   * Setup file upload handlers for logo
   */
  setupUploadHandlers() {
    const logoInput = document.getElementById('logoUpload');
    const uploadBtn = document.getElementById('uploadLogoBtn');
    const removeLogoBtn = document.getElementById('removeLogoBtn');

    if (uploadBtn && logoInput) {
      uploadBtn.addEventListener('click', () => logoInput.click());
    }

    if (logoInput) {
      logoInput.addEventListener('change', (e) => this.handleLogoUpload(e));
    }

    if (removeLogoBtn) {
      removeLogoBtn.addEventListener('click', () => this.removeLogo());
    }
  }

  /**
   * Handle logo file upload
   */
  async handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image too large. Maximum size is 2MB');
      return;
    }

    try {
      // Convert to base64
      const base64 = await this.fileToBase64(file);
      this.designSettings.logo = base64;
      
      // Update preview
      this.updateLogoPreview(base64);
      await this.saveDesignSettings();
      
      console.log('✅ Logo uploaded successfully');
    } catch (error) {
      console.error('❌ Error uploading logo:', error);
      alert('Failed to upload logo');
    }
  }

  /**
   * Convert file to base64
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Update logo preview
   */
  updateLogoPreview(base64) {
    const preview = document.getElementById('logoPreview');
    const placeholder = document.getElementById('logoPlaceholder');
    
    if (preview && placeholder) {
      preview.src = base64;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
    }
  }

  /**
   * Remove logo
   */
  async removeLogo() {
    this.designSettings.logo = null;
    
    const preview = document.getElementById('logoPreview');
    const placeholder = document.getElementById('logoPlaceholder');
    
    if (preview && placeholder) {
      preview.style.display = 'none';
      placeholder.style.display = 'flex';
    }
    
    await this.saveDesignSettings();
  }

  /**
   * Load design settings from Firestore
   */
  async loadDesignSettings() {
    try {
      const settingsRef = doc(db, "businesses", this.businessId, "payslip_settings", "design");
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        this.designSettings = { ...this.designSettings, ...settingsDoc.data() };
        this.applyDesignSettings();
      }
    } catch (error) {
      console.error('Error loading design settings:', error);
    }
  }

  /**
   * Save design settings to Firestore
   */
  async saveDesignSettings() {
    try {
      const settingsRef = doc(db, "businesses", this.businessId, "payslip_settings", "design");
      await setDoc(settingsRef, this.designSettings, { merge: true });
      console.log('✅ Design settings saved');
    } catch (error) {
      console.error('❌ Error saving design settings:', error);
    }
  }

  /**
   * Apply design settings to UI
   */
  applyDesignSettings() {
    // Apply logo
    if (this.designSettings.logo) {
      this.updateLogoPreview(this.designSettings.logo);
    }

    // Apply colors
    const colorInputs = {
      'primaryColorPicker': this.designSettings.primaryColor,
      'secondaryColorPicker': this.designSettings.secondaryColor
    };

    for (const [id, value] of Object.entries(colorInputs)) {
      const input = document.getElementById(id);
      if (input) input.value = value;
    }

    // Apply font
    const fontSelect = document.getElementById('fontFamilySelect');
    if (fontSelect) fontSelect.value = this.designSettings.fontFamily;
  }

  /**
   * Initialize draggable components
   */
  initializeComponents() {
    this.components = [
      { id: 'header', name: 'Header', icon: '📋', type: 'fixed' },
      { id: 'employeeInfo', name: 'Employee Info', icon: '👤', type: 'draggable' },
      { id: 'earnings', name: 'Earnings Table', icon: '💰', type: 'draggable' },
      { id: 'deductions', name: 'Deductions Table', icon: '➖', type: 'draggable' },
      { id: 'summary', name: 'Payment Summary', icon: '📊', type: 'draggable' },
      { id: 'footer', name: 'Footer', icon: '📝', type: 'fixed' }
    ];
  }

  /**
   * Generate professional payslip HTML
   */
  generatePayslipHTML(employeeData, templateData = {}) {
    const { logo, primaryColor, fontFamily } = this.designSettings;
    const {
      companyAddress = '',
      companyContact = '',
      customMessage = '',
      payslipFooter = 'This is a computer-generated payslip. No signature is required.',
      taxNumber = ''
    } = templateData;
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: ${fontFamily};
      background: #f5f5f5;
      padding: 20px;
    }
    
    .payslip-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .payslip-header {
      background: linear-gradient(135deg, ${primaryColor}, ${this.designSettings.secondaryColor});
      color: white;
      padding: 30px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    
    .company-info h1 {
      font-size: 24px;
      margin-bottom: 8px;
    }
    
    .company-info p {
      font-size: 12px;
      opacity: 0.9;
      margin-bottom: 3px;
      line-height: 1.4;
    }
    
    .company-info .subtitle {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .logo-container img {
      max-width: 120px;
      max-height: 80px;
      background: white;
      padding: 10px;
      border-radius: 8px;
    }
    
    .payslip-info {
      background: #f8f9fa;
      padding: 20px 30px;
      border-bottom: 2px solid ${primaryColor};
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    
    .info-item {
      display: flex;
      justify-content: space-between;
    }
    
    .info-label {
      color: #666;
      font-weight: 600;
      font-size: 13px;
    }
    
    .info-value {
      color: #333;
      font-weight: 700;
      font-size: 13px;
    }
    
    .payslip-body {
      padding: 30px;
    }
    
    .section-title {
      color: ${primaryColor};
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid ${primaryColor};
    }
    
    table {
      width: 100%;
      margin-bottom: 30px;
      border-collapse: collapse;
    }
    
    thead {
      background: #f8f9fa;
    }
    
    th {
      text-align: left;
      padding: 12px;
      font-size: 13px;
      font-weight: 700;
      color: #333;
      border-bottom: 2px solid ${primaryColor};
    }
    
    td {
      padding: 10px 12px;
      font-size: 13px;
      color: #555;
      border-bottom: 1px solid #e9ecef;
    }
    
    .amount {
      text-align: right;
      font-weight: 600;
    }
    
    .total-row {
      background: #f8f9fa;
      font-weight: 700;
      font-size: 14px;
    }
    
    .total-row td {
      border-top: 2px solid ${primaryColor};
      border-bottom: 2px solid ${primaryColor};
    }
    
    .net-pay {
      background: ${primaryColor};
      color: white;
      padding: 20px 30px;
      margin: 0 -30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 18px;
      font-weight: 700;
    }
    
    .custom-message {
      background: #fffbeb;
      border-left: 4px solid ${primaryColor};
      padding: 15px 20px;
      margin: 20px 0;
      font-size: 13px;
      color: #666;
      font-style: italic;
    }
    
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      margin: 30px -30px 0;
      text-align: center;
      color: #666;
      font-size: 11px;
      border-top: 1px solid #dee2e6;
      line-height: 1.6;
    }
    
    .footer p {
      margin-bottom: 8px;
    }
    
    .footer .tax-info {
      font-size: 10px;
      color: #999;
      margin-top: 10px;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .payslip-container {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="payslip-container">
    <!-- Header -->
    <div class="payslip-header">
      <div class="company-info">
        <h1>${employeeData.businessName || 'Your Company'}</h1>
        <p class="subtitle">Payslip for ${employeeData.month} ${employeeData.year}</p>
        ${companyAddress ? `<p>${companyAddress.replace(/\n/g, '<br>')}</p>` : ''}
        ${companyContact ? `<p>${companyContact}</p>` : ''}
      </div>
      ${logo ? `<div class="logo-container"><img src="${logo}" alt="Company Logo"></div>` : ''}
    </div>
    
    <!-- Employee Info -->
    <div class="payslip-info">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Employee Name:</span>
          <span class="info-value">${employeeData.employeeName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Employee ID:</span>
          <span class="info-value">${employeeData.employeeId}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Period:</span>
          <span class="info-value">${employeeData.period}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Pay Date:</span>
          <span class="info-value">${employeeData.payDate || new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
    
    <!-- Body -->
    <div class="payslip-body">
      <!-- Earnings -->
      <h2 class="section-title">Earnings</h2>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="amount">Rate</th>
            <th class="amount">Units</th>
            <th class="amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Basic Salary</td>
            <td class="amount">R ${employeeData.payRate}</td>
            <td class="amount">${employeeData.regularHours}h</td>
            <td class="amount">R ${employeeData.regularPay}</td>
          </tr>
          ${parseFloat(employeeData.overtimeHours) > 0 ? `
          <tr>
            <td>Overtime</td>
            <td class="amount">R ${(employeeData.payRate * 1.5).toFixed(2)}</td>
            <td class="amount">${employeeData.overtimeHours}h</td>
            <td class="amount">R ${employeeData.overtimePay}</td>
          </tr>
          ` : ''}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="3">Gross Pay</td>
            <td class="amount">R ${employeeData.grossPay}</td>
          </tr>
        </tfoot>
      </table>
      
      <!-- Deductions -->
      <h2 class="section-title">Deductions</h2>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total Deductions</td>
            <td class="amount">R ${employeeData.deductions}</td>
          </tr>
        </tbody>
      </table>
      
      <!-- Net Pay -->
      <div class="net-pay">
        <span>NETT PAY</span>
        <span>R ${employeeData.netPay}</span>
      </div>
      
      ${customMessage ? `
      <!-- Custom Message -->
      <div class="custom-message">
        ${customMessage.replace(/\n/g, '<br>')}
      </div>
      ` : ''}
      
      <!-- Footer -->
      <div class="footer">
        <p>${payslipFooter}</p>
        ${companyContact ? `<p>${companyContact}</p>` : employeeData.businessEmail ? `<p>For queries, please contact HR at ${employeeData.businessEmail}</p>` : ''}
        ${taxNumber ? `<p class="tax-info">${taxNumber}</p>` : ''}
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }
}

export default VisualPayslipEditor;
