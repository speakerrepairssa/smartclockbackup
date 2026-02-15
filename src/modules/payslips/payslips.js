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
import { VisualPayslipEditor } from "./visualEditor.js";

/**
 * Payslips Module Class
 * Manages payslip templates, generation, and distribution with visual editor
 */
class PayslipsModule {
  constructor(businessId) {
    this.businessId = businessId;
    this.currentTemplate = null;
    this.selectedEmployees = [];
    this.scheduleConfig = null;
    this.visualEditor = new VisualPayslipEditor(businessId);
    
    console.log('💰 Payslips module initialized for business:', this.businessId);
  }

  /**
   * Initialize the payslips module
   */
  async init() {
    try {
      console.log('📊 Initializing Payslips module');
      
      await this.loadTemplates();
      await this.loadEmployees();
      await this.visualEditor.init();
      this.setupEventListeners();
      this.setupDesignControls();
      
      console.log('✅ Payslips module initialized successfully');
    } catch (error) {
      console.error("❌ Error initializing payslips module:", error);
      showNotification("Failed to initialize payslips module", "error");
    }
  }

  /**
   * Setup event listeners for UI interactions
   */
  setupEventListeners() {
    console.log('Setting up payslips event listeners...');
    
    // Template management
    const createTemplateBtn = document.getElementById('createTemplateBtn');
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    const deleteTemplateBtn = document.getElementById('deleteTemplateBtn');
    
    console.log('Found elements:', {
      createTemplateBtn: !!createTemplateBtn,
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
      const templateSubject = document.getElementById('templateSubject');
      const templateSelect = document.getElementById('templateSelect');
      
      // Template content fields
      const companyAddress = document.getElementById('companyAddress');
      const companyContact = document.getElementById('companyContact');
      const customMessage = document.getElementById('customMessage');
      const payslipFooter = document.getElementById('payslipFooter');
      const taxNumber = document.getElementById('taxNumber');
      
      if (templateName) templateName.value = '';
      if (templateSubject) templateSubject.value = 'Your Payslip for {{month}} {{year}}';
      if (templateSelect) templateSelect.value = '';
      
      // Set default template content
      if (companyAddress) companyAddress.value = '';
      if (companyContact) companyContact.value = 'Tel: (XXX) XXX-XXXX | Email: payroll@company.com';
      if (customMessage) customMessage.value = 'Thank you for your hard work and dedication this month.';
      if (payslipFooter) payslipFooter.value = 'This is a computer-generated payslip. No signature is required.';
      if (taxNumber) taxNumber.value = '';
      
      console.log('✅ New template created successfully');
      showNotification("New template created - customize and save", "success");
    } catch (error) {
      console.error('❌ Error creating template:', error);
      showNotification("Error creating template", "error");
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
      
      document.getElementById('templateName').value = template.name || '';
      document.getElementById('templateSubject').value = template.subject || '';
      
      // Load template content fields
      if (document.getElementById('companyAddress')) {
        document.getElementById('companyAddress').value = template.companyAddress || '';
      }
      if (document.getElementById('companyContact')) {
        document.getElementById('companyContact').value = template.companyContact || '';
      }
      if (document.getElementById('customMessage')) {
        document.getElementById('customMessage').value = template.customMessage || '';
      }
      if (document.getElementById('payslipFooter')) {
        document.getElementById('payslipFooter').value = template.payslipFooter || 'This is a computer-generated payslip. No signature is required.';
      }
      if (document.getElementById('taxNumber')) {
        document.getElementById('taxNumber').value = template.taxNumber || '';
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
      const subject = document.getElementById('templateSubject').value.trim();
      
      // Get template content fields
      const companyAddress = document.getElementById('companyAddress')?.value.trim() || '';
      const companyContact = document.getElementById('companyContact')?.value.trim() || '';
      const customMessage = document.getElementById('customMessage')?.value.trim() || '';
      const payslipFooter = document.getElementById('payslipFooter')?.value.trim() || 'This is a computer-generated payslip. No signature is required.';
      const taxNumber = document.getElementById('taxNumber')?.value.trim() || '';
      
      if (!name) {
        showNotification("Please enter a template name", "warning");
        return;
      }
      
      const templateData = {
        name,
        subject,
        companyAddress,
        companyContact,
        customMessage,
        payslipFooter,
        taxNumber,
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
      
      // Get template customization data
      const templateData = {
        companyAddress: document.getElementById('companyAddress')?.value.trim() || '',
        companyContact: document.getElementById('companyContact')?.value.trim() || '',
        customMessage: document.getElementById('customMessage')?.value.trim() || '',
        payslipFooter: document.getElementById('payslipFooter')?.value.trim() || 'This is a computer-generated payslip. No signature is required.',
        taxNumber: document.getElementById('taxNumber')?.value.trim() || ''
      };
      
      // Generate professional HTML using visual editor
      const payslipHTML = this.visualEditor.generatePayslipHTML(payslipData, templateData);
      
      // Display in modal with iframe for proper styling
      const modal = document.getElementById('previewModal');
      const previewContent = document.getElementById('previewContent');
      
      if (modal && previewContent) {
        // Use iframe to render the complete HTML with styles
        previewContent.innerHTML = `<iframe id="payslipPreviewFrame" style="width: 100%; height: 800px; border: none; background: white;"></iframe>`;
        
        const iframe = document.getElementById('payslipPreviewFrame');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(payslipHTML);
        iframeDoc.close();
        
        modal.style.display = 'block';
      }
      
    } catch (error) {
      console.error("❌ Error previewing payslip:", error);
      showNotification("Failed to generate preview", "error");
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
    
    if (!this.currentTemplate || !this.currentTemplate.content) {
      showNotification("Please select or create a template first", "warning");
      return;
    }
    
    if (!confirm(`Send payslips to ${this.selectedEmployees.length} employee(s)?`)) {
      return;
    }
    
    try {
      showNotification(`Sending payslips to ${this.selectedEmployees.length} employees...`, "info");
      
      // Call Cloud Function to send payslips
      const response = await fetch('https://us-central1-aiclock-82608.cloudfunctions.net/sendPayslips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          businessId: this.businessId,
          employeeIds: this.selectedEmployees,
          templateId: this.currentTemplate.id,
          template: this.currentTemplate.content,
          subject: this.currentTemplate.subject || 'Your Payslip',
          deliveryMethods: {
            email: sendEmail,
            whatsapp: sendWhatsApp
          }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        showNotification(`Payslips sent successfully! ${result.sent} sent, ${result.failed} failed`, "success");
      } else {
        showNotification(`Failed to send payslips: ${result.message}`, "error");
      }
      
    } catch (error) {
      console.error("❌ Error sending payslips:", error);
      showNotification("Failed to send payslips", "error");
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
    
    if (!this.currentTemplate || !this.currentTemplate.content) {
      showNotification("Please select or create a template first", "warning");
      return;
    }
    
    try {
      // Save schedule configuration
      const scheduleData = {
        businessId: this.businessId,
        employeeIds: this.selectedEmployees,
        templateId: this.currentTemplate.id,
        subject: this.currentTemplate.subject,
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
