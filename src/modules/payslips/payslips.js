// Payslips Module - Handle payslip template creation and distribution
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "../../config/firebase.js";
import { showNotification } from "../shared/ui.js";
import { TemplateEditor } from "./template-editor.js";
import { DEFAULT_PAYSLIP_TEMPLATE, createPayslipTemplate } from "./default-template.js";
import { VisualPayslipEditor } from "./visualEditor.js";

/**
 * Payslips Module Class
 * Manages payslip templates, generation, and distribution with professional template editor
 */
class PayslipsModule {
  constructor(businessId) {
    this.businessId = businessId;
    this.currentTemplate = null;
    this.selectedEmployees = [];
    this.scheduleConfig = null;
    this.templateEditor = null;
    this.visualEditor = null;
    
    console.log('💰 Payslips module initialized for business:', this.businessId);
  }

  /**
   * Initialize the payslips module
   */
  async init() {
    try {
      console.log('📊 Initializing Payslips module');
      
      // Initialize visual editor first
      this.visualEditor = new VisualPayslipEditor(this.businessId);
      await this.visualEditor.init();
      
      await this.loadTemplateEditorUI();
      await this.loadTemplates();
      await this.loadEmployees();
      this.setupEventListeners();
      
      console.log('✅ Payslips module initialized successfully');
    } catch (error) {
      console.error("❌ Error initializing payslips module:", error);
      showNotification("Failed to initialize payslips module", "error");
    }
  }

  /**
   * Load the template editor UI
   */
  async loadTemplateEditorUI() {
    try {
      const container = document.getElementById('templateEditorContainer');
      if (!container) {
        console.error('❌ Template editor container not found');
        return;
      }

      console.log('📥 Fetching template editor HTML...');

      // Fetch and load the template editor HTML
      const response = await fetch('/modules/payslips/template-editor.html');
      if (!response.ok) {
        throw new Error(`Failed to fetch template editor: ${response.status} ${response.statusText}`);
      }
      
      const html = await response.text();
      console.log('✅ Template editor HTML fetched, injecting into DOM...');
      
      container.innerHTML = html;

      // Wait for DOM to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Initialize the template editor
      console.log('🎨 Initializing TemplateEditor class...');
      this.templateEditor = new TemplateEditor();
      
      console.log('✅ Template editor UI loaded successfully');
    } catch (error) {
      console.error('❌ Error loading template editor:', error);
      console.error('Error details:', error.message);
      showNotification('Failed to load template editor: ' + error.message, 'error');
    }
  }

  /**
   * Setup event listeners for UI interactions
   */
  setupEventListeners() {
    console.log('Setting up payslips event listeners...');
    
    // Template management
    const createTemplateBtn = document.getElementById('createTemplateBtn');
    const createDefaultTemplateBtn = document.getElementById('createDefaultTemplateBtn');
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    const deleteTemplateBtn = document.getElementById('deleteTemplateBtn');
    
    console.log('Found elements:', {
      createTemplateBtn: !!createTemplateBtn,
      createDefaultTemplateBtn: !!createDefaultTemplateBtn,
      saveTemplateBtn: !!saveTemplateBtn,
      deleteTemplateBtn: !!deleteTemplateBtn
    });
    
    if (createTemplateBtn) {
      createTemplateBtn.addEventListener('click', () => {
        console.log('Create template button clicked');
        this.createNewTemplate();
      });
    } else {
      console.error('createTemplateBtn not found');
    }
    
    if (createDefaultTemplateBtn) {
      createDefaultTemplateBtn.addEventListener('click', () => {
        console.log('Create default template button clicked');
        this.createDefaultTemplate();
      });
    }
    
    if (saveTemplateBtn) {
      saveTemplateBtn.addEventListener('click', () => this.saveTemplate());
    }
    
    if (deleteTemplateBtn) {
      deleteTemplateBtn.addEventListener('click', () => this.deleteTemplate());
    }

    // Template selection
    const templateSelect = document.getElementById('templateSelect');
    if (templateSelect) {
      templateSelect.addEventListener('change', (e) => this.loadTemplate(e.target.value));
    }

    // Employee selection
    const selectAllEmployeesBtn = document.getElementById('selectAllEmployees');
    const deselectAllEmployeesBtn = document.getElementById('deselectAllEmployees');
    
    if (selectAllEmployeesBtn) {
      selectAllEmployeesBtn.addEventListener('click', () => this.selectAllEmployees());
    }
    
    if (deselectAllEmployeesBtn) {
      deselectAllEmployeesBtn.addEventListener('click', () => this.deselectAllEmployees());
    }

    // Preview and send
    const previewPayslipBtn = document.getElementById('previewPayslipBtn');
    const sendPayslipsBtn = document.getElementById('sendPayslipsBtn');
    const schedulePayslipsBtn = document.getElementById('schedulePayslipsBtn');
    
    if (previewPayslipBtn) {
      previewPayslipBtn.addEventListener('click', () => this.previewPayslip());
    }
    
    if (sendPayslipsBtn) {
      sendPayslipsBtn.addEventListener('click', () => this.sendPayslipsNow());
    }
    
    if (schedulePayslipsBtn) {
      schedulePayslipsBtn.addEventListener('click', () => this.schedulePayslips());
    }

    // Delivery method toggles
    const emailToggle = document.getElementById('deliveryEmail');
    const whatsappToggle = document.getElementById('deliveryWhatsApp');
    
    if (emailToggle) {
      emailToggle.addEventListener('change', () => this.updateDeliveryMethods());
    }
    
    if (whatsappToggle) {
      whatsappToggle.addEventListener('change', () => this.updateDeliveryMethods());
    }
  }

  /**
   * Setup design customization controls
   */
  setupDesignControls() {
    // Color pickers
    const primaryColorPicker = document.getElementById('primaryColorPicker');
    const secondaryColorPicker = document.getElementById('secondaryColorPicker');
    const fontFamilySelect = document.getElementById('fontFamilySelect');
    
    if (primaryColorPicker) {
      primaryColorPicker.addEventListener('change', (e) => {
        this.visualEditor.designSettings.primaryColor = e.target.value;
        document.getElementById('primaryColorPreview').textContent = e.target.value;
        this.visualEditor.saveDesignSettings();
        this.updateLivePreview();
      });
    }
    
    if (secondaryColorPicker) {
      secondaryColorPicker.addEventListener('change', (e) => {
        this.visualEditor.designSettings.secondaryColor = e.target.value;
        document.getElementById('secondaryColorPreview').textContent = e.target.value;
        this.visualEditor.saveDesignSettings();
        this.updateLivePreview();
      });
    }
    
    if (fontFamilySelect) {
      fontFamilySelect.addEventListener('change', (e) => {
        this.visualEditor.designSettings.fontFamily = e.target.value;
        this.visualEditor.saveDesignSettings();
        this.updateLivePreview();
      });
    }
  }

  /**
   * Update live preview with current settings
   */
  updateLivePreview() {
    // This will instantly update the preview
    if (this.selectedEmployees.length > 0) {
      this.previewPayslip();
    }
  }

  /**
   * Load all payslip templates for this business
   */
  async loadTemplates() {
    try {
      const templatesRef = collection(db, "businesses", this.businessId, "payslip_templates");
      const snapshot = await getDocs(templatesRef);
      
      const templates = [];
      snapshot.forEach((doc) => {
        templates.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      this.displayTemplates(templates);
      
      if (templates.length > 0) {
        this.loadTemplate(templates[0].id);
      } else {
        // Auto-create a simple default template if none exist
        console.log('No templates found, creating default template...');
        await this.createDefaultTemplate();
      }
      
      console.log(`✅ Loaded ${templates.length} payslip templates`);
    } catch (error) {
      console.error("❌ Error loading templates:", error);
      showNotification("Failed to load payslip templates", "error");
    }
  }

  /**
   * Display templates in the dropdown
   */
  displayTemplates(templates) {
    const templateSelect = document.getElementById('templateSelect');
    if (!templateSelect) return;
    
    templateSelect.innerHTML = '<option value="">Select a template...</option>';
    
    templates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.name || 'Unnamed Template';
      templateSelect.appendChild(option);
    });
  }

  /**
   * Load employees from staff collection
   */
  async loadEmployees() {
    try {
      const staffRef = collection(db, "businesses", this.businessId, "staff");
      const snapshot = await getDocs(staffRef);
      
      const employees = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        employees.push({
          id: doc.id,
          name: data.employeeName || data.name,
          email: data.email,
          phone: data.phone,
          slot: data.slot,
          payRate: data.payRate,
          active: data.active !== false
        });
      });
      
      employees.sort((a, b) => a.slot - b.slot);
      this.displayEmployees(employees);
      
      console.log(`✅ Loaded ${employees.length} employees`);
    } catch (error) {
      console.error("❌ Error loading employees:", error);
      showNotification("Failed to load employees", "error");
    }
  }

  /**
   * Display employees with checkboxes for selection
   */
  displayEmployees(employees) {
    const employeeList = document.getElementById('employeeList');
    if (!employeeList) return;
    
    employeeList.innerHTML = '';
    
    employees.forEach(employee => {
      const employeeCard = document.createElement('div');
      employeeCard.className = 'employee-card';
      employeeCard.innerHTML = `
        <input 
          type="checkbox" 
          id="emp_${employee.id}" 
          value="${employee.id}"
          ${employee.active ? '' : 'disabled'}
        >
        <label for="emp_${employee.id}">
          <div class="employee-info">
            <strong>${employee.name}</strong>
            <small>Slot ${employee.slot}</small>
          </div>
          <div class="employee-contact">
            ${employee.email ? `<span>📧 ${employee.email}</span>` : ''}
            ${employee.phone ? `<span>📱 ${employee.phone}</span>` : ''}
          </div>
        </label>
      `;
      
      const checkbox = employeeCard.querySelector('input');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedEmployees.push(employee.id);
        } else {
          this.selectedEmployees = this.selectedEmployees.filter(id => id !== employee.id);
        }
        this.updateSelectedCount();
      });
      
      employeeList.appendChild(employeeCard);
    });
  }

  /**
   * Update selected employee count
   */
  updateSelectedCount() {
    const countDisplay = document.getElementById('selectedEmployeeCount');
    if (countDisplay) {
      countDisplay.textContent = this.selectedEmployees.length;
    }
  }

  /**
   * Select all active employees
   */
  selectAllEmployees() {
    const checkboxes = document.querySelectorAll('#employeeList input[type="checkbox"]:not([disabled])');
    this.selectedEmployees = [];
    
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
      this.selectedEmployees.push(checkbox.value);
    });
    
    this.updateSelectedCount();
    showNotification(`Selected ${this.selectedEmployees.length} employees`, "success");
  }

  /**
   * Deselect all employees
   */
  deselectAllEmployees() {
    const checkboxes = document.querySelectorAll('#employeeList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
    
    this.selectedEmployees = [];
    this.updateSelectedCount();
    showNotification("All employees deselected", "info");
  }

  /**
   * Create a new template
   */
  createNewTemplate() {
    console.log('Creating new template...');
    
    try {
      this.currentTemplate = null;
      
      const templateName = document.getElementById('templateName');
      const templateSelect = document.getElementById('templateSelect');
      
      if (templateName) templateName.value = '';
      if (templateSelect) templateSelect.value = '';
      
      // Clear the template editor to defaults
      if (this.templateEditor) {
        this.templateEditor.loadConfigIntoForm({
          ...DEFAULT_PAYSLIP_TEMPLATE,
          companyName: '', // Will be filled by user
          companyAddress: '',
          companyPhone: '',
          companyEmail: ''
        });
      }
      
      console.log('✅ New template created successfully');
      showNotification("New blank template created - customize and save", "success");
    } catch (error) {
      console.error('❌ Error creating template:', error);
      showNotification("Error creating template", "error");
    }
  }

  /**
   * Create a default professional template with pre-filled values
   */
  async createDefaultTemplate() {
    console.log('Loading default professional template into visual editor...');
    
    try {
      // Get business data to pre-fill company info
      const businessRef = doc(db, "businesses", this.businessId);
      const businessDoc = await getDoc(businessRef);
      const businessData = businessDoc.exists() ? businessDoc.data() : {};
      
      console.log('📋 Business data:', businessData);
      
      // Load DEFAULT_PAYSLIP_TEMPLATE into the visual editor
      if (this.templateEditor) {
        const defaultConfig = {
          ...DEFAULT_PAYSLIP_TEMPLATE,
          companyName: businessData.businessName || 'Your Company Name',
          companyEmail: businessData.email || '',
          companyPhone: businessData.phone || ''
        };
        
        // Load into visual editor
        this.templateEditor.loadConfigIntoForm(defaultConfig);
        
        // Clear current template so it's treated as new
        this.currentTemplate = null;
        
        // Set template name field
        const templateName = document.getElementById('templateName');
        if (templateName) {
          templateName.value = 'Professional Payslip';
        }
        
        // Clear template selector
        const templateSelect = document.getElementById('templateSelect');
        if (templateSelect) {
          templateSelect.value = '';
        }
        
        console.log('✅ Default professional template loaded into visual editor');
        showNotification("Default professional template loaded! Customize and send, or save for later.", "success");
      } else {
        console.error('❌ Template editor not available');
        showNotification("Template editor not loaded yet. Please wait a moment and try again.", "warning");
      }
      
    } catch (error) {
      console.error('❌ Error loading default template:', error);
      showNotification("Error loading default template: " + error.message, "error");
    }
  }

  /**
   * Get default payslip template
   */
  getDefaultTemplate() {
    return `Dear {{employeeName}},

Please find your payslip for {{month}} {{year}}.

--------------------------------
PAYSLIP SUMMARY
--------------------------------
Employee: {{employeeName}}
Position: {{position}}
Pay Rate: R {{payRate}}/hour

Period: {{period}}
Total Hours Worked: {{hoursWorked}}
Regular Hours: {{regularHours}}
Overtime Hours: {{overtimeHours}}

--------------------------------
EARNINGS
--------------------------------
Regular Pay: R {{regularPay}}
Overtime Pay: R {{overtimePay}}
Gross Pay: R {{grossPay}}

--------------------------------
DEDUCTIONS
--------------------------------
Total Deductions: R {{deductions}}

--------------------------------
NET PAY: R {{netPay}}
--------------------------------

Thank you for your hard work!

Best regards,
{{businessName}}`;
  }

  /**
   * Load a specific template
   */
  async loadTemplate(templateId) {
    if (!templateId) return;
    
    try {
      const templateRef = doc(db, "businesses", this.businessId, "payslip_templates", templateId);
      const templateDoc = await getDoc(templateRef);
      
      if (!templateDoc.exists()) {
        showNotification("Template not found", "error");
        return;
      }
      
      const template = templateDoc.data();
      this.currentTemplate = { id: templateId, ...template };
      
      // Set template name
      document.getElementById('templateName').value = template.name || '';
      
      // Load the full template config into the editor
      if (this.templateEditor) {
        this.templateEditor.loadConfigIntoForm(template);
      }
      
      console.log('✅ Template loaded:', templateId);
    } catch (error) {
      console.error("❌ Error loading template:", error);
      showNotification("Failed to load template", "error");
    }
  }

  /**
   * Save the current template
   */
  async saveTemplate() {
    try {
      const name = document.getElementById('templateName').value.trim();
      
      if (!name) {
        showNotification("Please enter a template name", "warning");
        return;
      }
      
      // Get the complete template configuration from the editor
      const templateConfig = this.templateEditor ? this.templateEditor.getConfig() : {};
      
      const templateData = {
        name,
        ...templateConfig, // Include all template editor config
        updatedAt: Timestamp.now()
      };
      
      let templateId;
      
      if (this.currentTemplate && this.currentTemplate.id) {
        // Update existing template
        templateId = this.currentTemplate.id;
        await updateDoc(doc(db, "businesses", this.businessId, "payslip_templates", templateId), templateData);
        showNotification("Template updated successfully", "success");
      } else {
        // Create new template
        templateData.createdAt = Timestamp.now();
        const newTemplateRef = doc(collection(db, "businesses", this.businessId, "payslip_templates"));
        await setDoc(newTemplateRef, templateData);
        templateId = newTemplateRef.id;
        showNotification("Template created successfully", "success");
      }
      
      this.currentTemplate = { id: templateId, ...templateData };
      await this.loadTemplates();
      document.getElementById('templateSelect').value = templateId;
      
    } catch (error) {
      console.error("❌ Error saving template:", error);
      showNotification("Failed to save template", "error");
    }
  }

  /**
   * Delete the current template
   */
  async deleteTemplate() {
    if (!this.currentTemplate || !this.currentTemplate.id) {
      showNotification("No template selected", "warning");
      return;
    }
    
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, "businesses", this.businessId, "payslip_templates", this.currentTemplate.id));
      showNotification("Template deleted successfully", "success");
      
      this.createNewTemplate();
      await this.loadTemplates();
      
    } catch (error) {
      console.error("❌ Error deleting template:", error);
      showNotification("Failed to delete template", "error");
    }
  }

  /**
   * Preview payslip for the first selected employee
   */
  async previewPayslip() {
    if (this.selectedEmployees.length === 0) {
      showNotification("Please select at least one employee", "warning");
      return;
    }
    
    try {
      // Get the first selected employee's data
      const employeeId = this.selectedEmployees[0];
      const payslipData = await this.getEmployeePayslipData(employeeId);
      
      console.log('Payslip data:', payslipData);
      
      // Get template customization data
      const templateData = {
        companyAddress: document.getElementById('companyAddress')?.value.trim() || '',
        companyContact: document.getElementById('companyContact')?.value.trim() || '',
        customMessage: document.getElementById('customMessage')?.value.trim() || '',
        payslipFooter: document.getElementById('payslipFooter')?.value.trim() || 'This is a computer-generated payslip. No signature is required.',
        taxNumber: document.getElementById('taxNumber')?.value.trim() || ''
      };
      
      // Generate professional HTML using visual editor
      let payslipHTML;
      if (this.visualEditor && typeof this.visualEditor.generatePayslipHTML === 'function') {
        payslipHTML = this.visualEditor.generatePayslipHTML(payslipData, templateData);
      } else {
        console.warn('Visual editor not available, using fallback template');
        payslipHTML = this.generateFallbackPayslipHTML(payslipData, templateData);
      }
      
      console.log('Generated HTML length:', payslipHTML.length);
      
      // Display in modal with iframe for proper styling and download button
      const modal = document.getElementById('previewModal');
      const previewContent = document.getElementById('previewContent');
      
      if (modal && previewContent) {
        // Store payslip HTML and data for download
        this.currentPreviewHTML = payslipHTML;
        this.currentPreviewData = payslipData;
        
        // Use iframe to render the complete HTML with styles
        previewContent.innerHTML = `
          <div style="margin-bottom: 15px; display: flex; gap: 10px; justify-content: flex-end;">
            <button id="downloadPayslipBtn" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px;">
              <span>📥</span> Download PDF
            </button>
            <button id="printPayslipBtn" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px;">
              <span>🖨️</span> Print
            </button>
          </div>
          <iframe id="payslipPreviewFrame" style="width: 100%; height: 800px; border: none; background: white;"></iframe>
        `;
        
        const iframe = document.getElementById('payslipPreviewFrame');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(payslipHTML);
        iframeDoc.close();
        
        // Add download button event listener
        const downloadBtn = document.getElementById('downloadPayslipBtn');
        if (downloadBtn) {
          downloadBtn.addEventListener('click', () => this.downloadPayslip());
        }
        
        // Add print button event listener
        const printBtn = document.getElementById('printPayslipBtn');
        if (printBtn) {
          printBtn.addEventListener('click', () => this.printPayslip());
        }
        
        modal.style.display = 'block';
      }
      
    } catch (error) {
      console.error("❌ Error previewing payslip:", error);
      console.error("Error stack:", error.stack);
      showNotification("Failed to generate preview: " + error.message, "error");
    }
  }
  
  /**
   * Generate fallback payslip HTML if visual editor is not available
   */
  generateFallbackPayslipHTML(employeeData, templateData = {}) {
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    .payslip { max-width: 800px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #2563eb; font-size: 28px; margin-bottom: 10px; }
    .header h2 { color: #666; font-size: 18px; font-weight: normal; }
    .info-section { margin-bottom: 30px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; background: #f8f9fa; padding: 20px; border-radius: 8px; }
    .info-item { display: flex; flex-direction: column; }
    .info-label { font-size: 12px; color: #666; font-weight: 600; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 15px; color: #333; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead { background: #f8f9fa; }
    th { text-align: left; padding: 12px; font-size: 13px; font-weight: 700; color: #333; border-bottom: 2px solid #2563eb; }
    td { padding: 12px; font-size: 13px; color: #555; border-bottom: 1px solid #e9ecef; }
    .amount { text-align: right; font-weight: 600; }
    .total-row { background: #f8f9fa; font-weight: 700; font-size: 14px; }
    .total-row td { border-top: 2px solid #2563eb; }
    .net-pay { background: linear-gradient(135deg, #2563eb, #1e40af); color: white; padding: 25px; margin: 30px 0; text-align: center; border-radius: 8px; }
    .net-pay-label { font-size: 14px; opacity: 0.9; margin-bottom: 10px; }
    .net-pay-amount { font-size: 36px; font-weight: 700; }
    .footer { background: #f8f9fa; padding: 20px; margin-top: 30px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #dee2e6; }
  </style>
</head>
<body>
  <div class="payslip">
    <div class="header">
      <h1>${employeeData.businessName || 'Company Name'}</h1>
      <h2>Payslip for ${employeeData.month} ${employeeData.year}</h2>
      ${companyAddress ? `<p style="margin-top: 10px; color: #666; font-size: 13px;">${companyAddress.replace(/\n/g, '<br>')}</p>` : ''}
    </div>
    
    <div class="info-section">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Employee Name</span>
          <span class="info-value">${employeeData.employeeName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Employee ID</span>
          <span class="info-value">${employeeData.employeeId}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Period</span>
          <span class="info-value">${employeeData.period}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Pay Date</span>
          <span class="info-value">${employeeData.payDate || new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
    
    <h3 style="color: #2563eb; margin-bottom: 15px;">Earnings</h3>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="amount">Rate</th>
          <th class="amount">Hours</th>
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
          <td>Overtime (1.5x)</td>
          <td class="amount">R ${(parseFloat(employeeData.payRate) * 1.5).toFixed(2)}</td>
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
    
    <h3 style="color: #2563eb; margin-bottom: 15px;">Deductions</h3>
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
    
    <div class="net-pay">
      <div class="net-pay-label">NETT PAY</div>
      <div class="net-pay-amount">R ${employeeData.netPay}</div>
    </div>
    
    ${customMessage ? `
    <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; font-size: 13px; color: #666;">
      ${customMessage.replace(/\n/g, '<br>')}
    </div>
    ` : ''}
    
    <div class="footer">
      <p>${payslipFooter}</p>
      ${companyContact ? `<p style="margin-top: 10px;">${companyContact}</p>` : ''}
      ${taxNumber ? `<p style="margin-top: 10px; font-size: 11px; color: #999;">${taxNumber}</p>` : ''}
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Download the current payslip preview as PDF
   */
  async downloadPayslip() {
    if (!this.currentPreviewHTML || !this.currentPreviewData) {
      showNotification("No payslip preview available", "warning");
      return;
    }
    
    try {
      showNotification("Generating PDF...", "info");
      
      // Load html2pdf library if not already loaded
      if (typeof html2pdf === 'undefined') {
        await this.loadHtml2PdfLibrary();
      }
      
      // Get the iframe content
      const iframe = document.getElementById('payslipPreviewFrame');
      if (!iframe) {
        throw new Error("Preview iframe not found");
      }
      
      const element = iframe.contentDocument.body;
      
      // PDF options
      const opt = {
        margin: 10,
        filename: `Payslip - ${this.currentPreviewData.employeeName} ${this.currentPreviewData.period}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        }
      };
      
      // Generate PDF
      await html2pdf().set(opt).from(element).save();
      
      showNotification("Payslip PDF downloaded successfully", "success");
    } catch (error) {
      console.error("❌ Error downloading payslip:", error);
      showNotification("Failed to download payslip: " + error.message, "error");
    }
  }

  /**
   * Load html2pdf library dynamically
   */
  async loadHtml2PdfLibrary() {
    return new Promise((resolve, reject) => {
      if (typeof html2pdf !== 'undefined') {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Print the current payslip preview
   */
  printPayslip() {
    const iframe = document.getElementById('payslipPreviewFrame');
    if (!iframe) {
      showNotification("No payslip preview available", "warning");
      return;
    }
    
    try {
      iframe.contentWindow.print();
    } catch (error) {
      console.error("❌ Error printing payslip:", error);
      showNotification("Failed to print payslip", "error");
    }
  }

  /**
   * Get employee payslip data formatted for visual editor
   */
  async getEmployeePayslipData(employeeId) {
    // Get employee data
    const employeeRef = doc(db, "businesses", this.businessId, "staff", employeeId);
    const employeeDoc = await getDoc(employeeRef);
    
    if (!employeeDoc.exists()) {
      throw new Error("Employee not found");
    }
    
    const employee = employeeDoc.data();
    
    // Get current month's assessment cache
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const cacheRef = doc(db, "businesses", this.businessId, "assessment_cache", month);
    const cacheDoc = await getDoc(cacheRef);
    
    let assessmentData = {
      currentHours: 0,
      currentIncomeDue: 0,
      payRate: employee.payRate || 0
    };
    
    if (cacheDoc.exists()) {
      const cache = cacheDoc.data();
      const empAssessment = cache.employees?.find(e => e.employeeId === employeeId);
      if (empAssessment) {
        assessmentData = empAssessment;
      }
    }
    
    // Calculate regular and overtime hours (8 hours/day standard)
    const hoursWorked = assessmentData.currentHours || 0;
    const regularHours = Math.min(hoursWorked, 160); // Assuming 20 working days * 8 hours
    const overtimeHours = Math.max(0, hoursWorked - 160);
    const payRate = assessmentData.payRate || employee.payRate || 0;
    
    // Calculate pay
    const regularPay = regularHours * payRate;
    const overtimePay = overtimeHours * payRate * 1.5; // Time and a half for overtime
    const grossPay = regularPay + overtimePay;
    const deductions = 0; // Can be configured later
    const netPay = grossPay - deductions;
    
    // Get business data
    const businessRef = doc(db, "businesses", this.businessId);
    const businessDoc = await getDoc(businessRef);
    const businessData = businessDoc.exists() ? businessDoc.data() : {};
    
    // Month names
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Return formatted data for visual editor
    return {
      employeeName: employee.employeeName || employee.name || 'N/A',
      employeeId: employee.employeeId || 'N/A',
      position: employee.position || 'Employee',
      payRate: payRate.toFixed(2),
      month: monthNames[now.getMonth()],
      year: now.getFullYear().toString(),
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      payDate: new Date().toLocaleDateString('en-ZA'),
      hoursWorked: hoursWorked.toFixed(2),
      regularHours: regularHours.toFixed(2),
      overtimeHours: overtimeHours.toFixed(2),
      regularPay: regularPay.toFixed(2),
      overtimePay: overtimePay.toFixed(2),
      grossPay: grossPay.toFixed(2),
      deductions: deductions.toFixed(2),
      netPay: netPay.toFixed(2),
      businessName: businessData.businessName || 'Your Company',
      businessEmail: businessData.email || ''
    };
  }

  /**
   * Generate a payslip for a specific employee
   */
  async generatePayslip(employeeId, template, subject) {
    try {
      // Get employee data
      const employeeRef = doc(db, "businesses", this.businessId, "staff", employeeId);
      const employeeDoc = await getDoc(employeeRef);
      
      if (!employeeDoc.exists()) {
        throw new Error("Employee not found");
      }
      
      const employee = employeeDoc.data();
      
      // Get current month's assessment cache
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const cacheRef = doc(db, "businesses", this.businessId, "assessment_cache", month);
      const cacheDoc = await getDoc(cacheRef);
      
      let assessmentData = {
        currentHours: 0,
        currentIncomeDue: 0,
        payRate: employee.payRate || 0
      };
      
      if (cacheDoc.exists()) {
        const cache = cacheDoc.data();
        const empAssessment = cache.employees?.find(e => e.employeeId === employeeId);
        if (empAssessment) {
          assessmentData = empAssessment;
        }
      }
      
      // Calculate regular and overtime hours (8 hours/day standard)
      const hoursWorked = assessmentData.currentHours || 0;
      const regularHours = Math.min(hoursWorked, 160); // Assuming 20 working days * 8 hours
      const overtimeHours = Math.max(0, hoursWorked - 160);
      const payRate = assessmentData.payRate || employee.payRate || 0;
      
      // Calculate pay
      const regularPay = regularHours * payRate;
      const overtimePay = overtimeHours * payRate * 1.5; // Time and a half for overtime
      const grossPay = regularPay + overtimePay;
      const deductions = 0; // Can be configured later
      const netPay = grossPay - deductions;
      
      // Get business data
      const businessRef = doc(db, "businesses", this.businessId);
      const businessDoc = await getDoc(businessRef);
      const businessData = businessDoc.exists() ? businessDoc.data() : {};
      
      // Build replacement map
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
      
      const replacements = {
        '{{employeeName}}': employee.employeeName || employee.name || 'N/A',
        '{{position}}': employee.position || 'Employee',
        '{{payRate}}': payRate.toFixed(2),
        '{{month}}': monthNames[now.getMonth()],
        '{{year}}': now.getFullYear().toString(),
        '{{period}}': `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        '{{hoursWorked}}': hoursWorked.toFixed(2),
        '{{regularHours}}': regularHours.toFixed(2),
        '{{overtimeHours}}': overtimeHours.toFixed(2),
        '{{regularPay}}': regularPay.toFixed(2),
        '{{overtimePay}}': overtimePay.toFixed(2),
        '{{grossPay}}': grossPay.toFixed(2),
        '{{deductions}}': deductions.toFixed(2),
        '{{netPay}}': netPay.toFixed(2),
        '{{businessName}}': businessData.businessName || 'Your Company'
      };
      
      // Replace placeholders in template
      let filledContent = template;
      let filledSubject = subject;
      
      for (const [placeholder, value] of Object.entries(replacements)) {
        filledContent = filledContent.replace(new RegExp(placeholder, 'g'), value);
        filledSubject = filledSubject.replace(new RegExp(placeholder, 'g'), value);
      }
      
      return {
        content: filledContent,
        subject: filledSubject,
        employee: employee,
        data: {
          hoursWorked,
          regularHours,
          overtimeHours,
          regularPay,
          overtimePay,
          grossPay,
          deductions,
          netPay
        }
      };
      
    } catch (error) {
      console.error("❌ Error generating payslip:", error);
      throw error;
    }
  }

  /**
   * Send payslips immediately
   */
  async sendPayslipsNow() {
    if (this.selectedEmployees.length === 0) {
      showNotification("Please select at least one employee", "warning");
      return;
    }
    
    const sendEmail = document.getElementById('deliveryEmail')?.checked;
    const sendWhatsApp = document.getElementById('deliveryWhatsApp')?.checked;
    
    if (!sendEmail && !sendWhatsApp) {
      showNotification("Please select at least one delivery method", "warning");
      return;
    }
    
    // Get template either from saved template or visual editor
    let templateData;
    let templateId;
    let templateSubject;
    
    if (this.currentTemplate && (this.currentTemplate.content || this.currentTemplate.id)) {
      // Use saved template
      templateData = this.currentTemplate.content || this.currentTemplate;
      templateId = this.currentTemplate.id;
      templateSubject = this.currentTemplate.subject || 'Your Payslip';
    } else if (this.templateEditor) {
      // Use visual editor configuration (no need to save first)
      console.log('📝 Using visual template editor configuration');
      const config = this.templateEditor.getConfig();
      
      // Generate HTML from visual editor config
      const template = createPayslipTemplate(config);
      templateData = template.generateHTML({});
      templateId = 'unsaved-visual-template';
      templateSubject = config.subject || 'Your Payslip';
      
      console.log('✅ Generated template from visual editor');
    } else {
      showNotification("Template editor not available. Please refresh the page.", "error");
      return;
    }
    
    if (!confirm(`Send payslips to ${this.selectedEmployees.length} employee(s)?`)) {
      return;
    }
    
    try {
      showNotification(`Sending payslips to ${this.selectedEmployees.length} employees...`, "info");
      
      // Prepare request payload
      const payload = {
        businessId: this.businessId,
        employeeIds: this.selectedEmployees,
        templateId: templateId,
        template: templateData,
        subject: templateSubject,
        deliveryMethods: {
          email: sendEmail,
          whatsapp: sendWhatsApp
        }
      };
      
      console.log('📤 Sending payslips request:', {
        businessId: this.businessId,
        employeeCount: this.selectedEmployees.length,
        templateId,
        templateDataLength: templateData?.length,
        deliveryMethods: { email: sendEmail, whatsapp: sendWhatsApp }
      });
      
      // Call Cloud Function to send payslips
      const response = await fetch('https://us-central1-aiclock-82608.cloudfunctions.net/sendPayslips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      console.log('📥 Response status:', response.status, response.statusText);
      
      // Check if response is OK before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Response data:', result);
      
      if (result.success) {
        showNotification(`Payslips sent successfully! ${result.sent} sent, ${result.failed} failed`, "success");
      } else {
        showNotification(`Failed to send payslips: ${result.message}`, "error");
      }
      
    } catch (error) {
      console.error("❌ Error sending payslips:", error);
      showNotification(`Failed to send payslips: ${error.message}`, "error");
    }
  }

  /**
   * Schedule payslips for automatic delivery
   */
  async schedulePayslips() {
    if (this.selectedEmployees.length === 0) {
      showNotification("Please select at least one employee", "warning");
      return;
    }
    
    const sendEmail = document.getElementById('deliveryEmail')?.checked;
    const sendWhatsApp = document.getElementById('deliveryWhatsApp')?.checked;
    
    if (!sendEmail && !sendWhatsApp) {
      showNotification("Please select at least one delivery method", "warning");
      return;
    }
    
    const scheduleDate = document.getElementById('scheduleDate')?.value;
    const scheduleTime = document.getElementById('scheduleTime')?.value;
    
    if (!scheduleDate || !scheduleTime) {
      showNotification("Please set schedule date and time", "warning");
      return;
    }
    
    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    
    if (scheduledDateTime < new Date()) {
      showNotification("Schedule time must be in the future", "warning");
      return;
    }
    
    // Get template - for scheduling we need to save it first
    let templateId;
    let templateSubject;
    
    if (this.currentTemplate && this.currentTemplate.id) {
      // Use existing saved template
      templateId = this.currentTemplate.id;
      templateSubject = this.currentTemplate.subject || 'Your Payslip';
    } else if (this.templateEditor) {
      // Auto-save template from visual editor
      console.log('📝 Auto-saving template for scheduling...');
      const templateName = document.getElementById('templateName')?.value.trim() || `Payslip ${new Date().toLocaleDateString()}`;
      
      const config = this.templateEditor.getConfig();
      const templateData = {
        name: templateName,
        ...config,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      const newTemplateRef = doc(collection(db, "businesses", this.businessId, "payslip_templates"));
      await setDoc(newTemplateRef, templateData);
      templateId = newTemplateRef.id;
      templateSubject = config.subject || 'Your Payslip';
      
      this.currentTemplate = { id: templateId, ...templateData };
      await this.loadTemplates();
      document.getElementById('templateSelect').value = templateId;
      
      showNotification("Template saved for scheduling", "info");
    } else {
      showNotification("Template editor not available. Please refresh the page.", "error");
      return;
    }
    
    try {
      // Save schedule configuration
      const scheduleData = {
        businessId: this.businessId,
        employeeIds: this.selectedEmployees,
        templateId: templateId,
        subject: templateSubject,
        deliveryMethods: {
          email: sendEmail,
          whatsapp: sendWhatsApp
        },
        scheduledTime: Timestamp.fromDate(scheduledDateTime),
        status: 'scheduled',
        createdAt: Timestamp.now()
      };
      
      const scheduleRef = doc(collection(db, "businesses", this.businessId, "payslip_schedules"));
      await setDoc(scheduleRef, scheduleData);
      
      showNotification(
        `Payslips scheduled for ${scheduledDateTime.toLocaleString()} for ${this.selectedEmployees.length} employees`,
        "success"
      );
      
      await this.loadSchedules();
      
    } catch (error) {
      console.error("❌ Error scheduling payslips:", error);
      showNotification("Failed to schedule payslips", "error");
    }
  }

  /**
   * Load scheduled payslips
   */
  async loadSchedules() {
    try {
      const schedulesRef = collection(db, "businesses", this.businessId, "payslip_schedules");
      const q = query(schedulesRef, where("status", "==", "scheduled"), orderBy("scheduledTime", "asc"));
      const snapshot = await getDocs(q);
      
      const schedules = [];
      snapshot.forEach((doc) => {
        schedules.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      this.displaySchedules(schedules);
      
    } catch (error) {
      console.error("❌ Error loading schedules:", error);
    }
  }

  /**
   * Display scheduled payslips
   */
  displaySchedules(schedules) {
    const scheduleList = document.getElementById('scheduleList');
    if (!scheduleList) return;
    
    if (schedules.length === 0) {
      scheduleList.innerHTML = '<div class="empty-state">No scheduled payslips</div>';
      return;
    }
    
    scheduleList.innerHTML = '';
    
    schedules.forEach(schedule => {
      const scheduleCard = document.createElement('div');
      scheduleCard.className = 'schedule-card';
      
      const scheduledDate = schedule.scheduledTime.toDate();
      const methods = [];
      if (schedule.deliveryMethods.email) methods.push('📧 Email');
      if (schedule.deliveryMethods.whatsapp) methods.push('💬 WhatsApp');
      
      scheduleCard.innerHTML = `
        <div class="schedule-info">
          <strong>${scheduledDate.toLocaleString()}</strong>
          <div>${schedule.employeeIds.length} employees</div>
          <div>${methods.join(', ')}</div>
        </div>
        <button class="delete-schedule-btn" data-schedule-id="${schedule.id}">
          🗑️ Cancel
        </button>
      `;
      
      const deleteBtn = scheduleCard.querySelector('.delete-schedule-btn');
      deleteBtn.addEventListener('click', async () => {
        if (confirm('Cancel this scheduled payslip?')) {
          await this.cancelSchedule(schedule.id);
        }
      });
      
      scheduleList.appendChild(scheduleCard);
    });
  }

  /**
   * Cancel a scheduled payslip
   */
  async cancelSchedule(scheduleId) {
    try {
      await deleteDoc(doc(db, "businesses", this.businessId, "payslip_schedules", scheduleId));
      showNotification("Schedule cancelled successfully", "success");
      await this.loadSchedules();
    } catch (error) {
      console.error("❌ Error cancelling schedule:", error);
      showNotification("Failed to cancel schedule", "error");
    }
  }

  /**
   * Update delivery methods
   */
  updateDeliveryMethods() {
    const emailChecked = document.getElementById('deliveryEmail')?.checked;
    const whatsappChecked = document.getElementById('deliveryWhatsApp')?.checked;
    
    console.log('📬 Delivery methods updated:', { email: emailChecked, whatsapp: whatsappChecked });
  }
}

// Export the module
export default PayslipsModule;
