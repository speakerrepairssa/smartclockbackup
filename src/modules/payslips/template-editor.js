/**
 * Payslip Template Editor Controller
 * Manages visual template editing with live preview
 */

import { DEFAULT_PAYSLIP_TEMPLATE, createPayslipTemplate } from './default-template.js';

export class TemplateEditor {
  constructor() {
    this.currentConfig = { ...DEFAULT_PAYSLIP_TEMPLATE };
    this.previewFrame = null;
    
    // Wait for next frame before initializing to ensure DOM is ready
    requestAnimationFrame(() => {
      console.log('🎨 TemplateEditor: Starting initialization...');
      this.init();
    });
  }

  init() {
    try {
      console.log('🎨 TemplateEditor: Setting up tabs...');
      this.setupTabSwitching();
      
      console.log('🎨 TemplateEditor: Setting up color pickers...');
      this.setupColorPickers();
      
      console.log('🎨 TemplateEditor: Setting up form listeners...');
      this.setupFormListeners();
      
      console.log('🎨 TemplateEditor: Getting preview frame...');
      this.previewFrame = document.getElementById('livePreviewFrame');
      
      if (!this.previewFrame) {
        console.error('❌ Preview frame not found!');
      } else {
        console.log('✅ Preview frame found');
      }
      
      console.log('🎨 TemplateEditor: Updating preview...');
      this.updatePreview();
      
      console.log('✅ TemplateEditor initialized successfully!');
    } catch (error) {
      console.error('❌ Error initializing TemplateEditor:', error);
      throw error;
    }
  }

  /**
   * Setup tab switching
   */
  setupTabSwitching() {
    const tabs = document.querySelectorAll('.editor-tab');
    const contents = document.querySelectorAll('.editor-tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update active content
        contents.forEach(content => {
          if (content.dataset.content === targetTab) {
            content.classList.add('active');
          } else {
            content.classList.remove('active');
          }
        });
      });
    });
  }

  /**
   * Setup color picker synchronization
   */
  setupColorPickers() {
    const primaryColor = document.getElementById('editorPrimaryColor');
    const primaryColorText = document.getElementById('editorPrimaryColorText');
    const secondaryColor = document.getElementById('editorSecondaryColor');
    const secondaryColorText = document.getElementById('editorSecondaryColorText');

    // Sync color picker with text input
    primaryColor?.addEventListener('input', (e) => {
      primaryColorText.value = e.target.value;
      this.currentConfig.primaryColor = e.target.value;
      this.updatePreview();
    });

    primaryColorText?.addEventListener('input', (e) => {
      if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
        primaryColor.value = e.target.value;
        this.currentConfig.primaryColor = e.target.value;
        this.updatePreview();
      }
    });

    secondaryColor?.addEventListener('input', (e) => {
      secondaryColorText.value = e.target.value;
      this.currentConfig.secondaryColor = e.target.value;
      this.updatePreview();
    });

    secondaryColorText?.addEventListener('input', (e) => {
      if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
        secondaryColor.value = e.target.value;
        this.currentConfig.secondaryColor = e.target.value;
        this.updatePreview();
      }
    });
  }

  /**
   * Setup form field listeners
   */
  setupFormListeners() {
    // Company info fields
    const fields = [
      'editorCompanyName',
      'editorCompanyAddress', 
      'editorCompanyPhone',
      'editorCompanyEmail',
      'editorTaxNumber',
      'editorRegNumber',
      'editorCompanyLogo',
      'editorHeaderMessage',
      'editorFooterMessage',
      'editorEmailSubject'
    ];

    fields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      field?.addEventListener('input', () => {
        this.updateConfigFromForm();
        this.updatePreview();
      });
    });

    // Toggle switches
    const toggles = [
      'editorShowLogo',
      'editorShowCompanyDetails',
      'sectionEmployeeDetails',
      'sectionPayPeriod',
      'sectionEarnings',
      'sectionDeductions',
      'sectionSummary',
      'sectionFooter',
      // Deduction toggles
      'deductionUIF',
      'deductionPAYE',
      'deductionPension',
      'deductionMedicalAid',
      'deductionProvidentFund',
      'deductionOther'
    ];

    toggles.forEach(toggleId => {
      const toggle = document.getElementById(toggleId);
      toggle?.addEventListener('change', () => {
        this.updateConfigFromForm();
        this.updatePreview();
      });
    });

    // Refresh button
    document.getElementById('refreshPreviewBtn')?.addEventListener('click', () => {
      this.updatePreview();
    });
  }

  /**
   * Update config from form values
   */
  updateConfigFromForm() {
    // Company info
    this.currentConfig.companyName = document.getElementById('editorCompanyName')?.value || '';
    this.currentConfig.companyAddress = document.getElementById('editorCompanyAddress')?.value || '';
    this.currentConfig.companyPhone = document.getElementById('editorCompanyPhone')?.value || '';
    this.currentConfig.companyEmail = document.getElementById('editorCompanyEmail')?.value || '';
    this.currentConfig.taxNumber = document.getElementById('editorTaxNumber')?.value || '';
    this.currentConfig.registrationNumber = document.getElementById('editorRegNumber')?.value || '';
    this.currentConfig.companyLogo = document.getElementById('editorCompanyLogo')?.value || '';

    // Display options
    this.currentConfig.showLogo = document.getElementById('editorShowLogo')?.checked || false;
    this.currentConfig.showCompanyDetails = document.getElementById('editorShowCompanyDetails')?.checked || false;

    // Sections
    this.currentConfig.sections = {
      companyHeader: true, // Always enabled
      employeeDetails: document.getElementById('sectionEmployeeDetails')?.checked || false,
      payPeriod: document.getElementById('sectionPayPeriod')?.checked || false,
      earnings: document.getElementById('sectionEarnings')?.checked || false,
      deductions: document.getElementById('sectionDeductions')?.checked || false,
      summary: document.getElementById('sectionSummary')?.checked || false,
      footer: document.getElementById('sectionFooter')?.checked || false
    };

    // Deduction Types
    this.currentConfig.deductionTypes = {
      uif: {
        enabled: document.getElementById('deductionUIF')?.checked || false,
        label: "UIF (Unemployment Insurance Fund)",
        rate: 1.0,
        description: "1% of gross salary"
      },
      paye: {
        enabled: document.getElementById('deductionPAYE')?.checked || false,
        label: "PAYE (Income Tax)",
        rate: 0,
        description: "As per SARS tax tables"
      },
      pension: {
        enabled: document.getElementById('deductionPension')?.checked || false,
        label: "Pension Fund Contribution",
        rate: 7.5,
        description: "Retirement annuity contribution"
      },
      medicalAid: {
        enabled: document.getElementById('deductionMedicalAid')?.checked || false,
        label: "Medical Aid Contribution",
        rate: 0,
        description: "Monthly medical aid premium"
      },
      providentFund: {
        enabled: document.getElementById('deductionProvidentFund')?.checked || false,
        label: "Provident Fund",
        rate: 7.5,
        description: "Provident fund contribution"
      },
      other: {
        enabled: document.getElementById('deductionOther')?.checked || false,
        label: "Other Deductions",
        rate: 0,
        description: "Miscellaneous deductions"
      }
    };

    // Messages
    this.currentConfig.headerMessage = document.getElementById('editorHeaderMessage')?.value || '';
    this.currentConfig.footerMessage = document.getElementById('editorFooterMessage')?.value || '';
    this.currentConfig.subject = document.getElementById('editorEmailSubject')?.value || '';
  }

  /**
   * Load config into form
   */
  loadConfigIntoForm(config) {
    this.currentConfig = { ...DEFAULT_PAYSLIP_TEMPLATE, ...config };

    // Company info
    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value || '';
    };

    setValue('editorCompanyName', config.companyName);
    setValue('editorCompanyAddress', config.companyAddress);
    setValue('editorCompanyPhone', config.companyPhone);
    setValue('editorCompanyEmail', config.companyEmail);
    setValue('editorTaxNumber', config.taxNumber);
    setValue('editorRegNumber', config.registrationNumber);
    setValue('editorCompanyLogo', config.companyLogo);

    // Colors
    setValue('editorPrimaryColor', config.primaryColor);
    setValue('editorPrimaryColorText', config.primaryColor);
    setValue('editorSecondaryColor', config.secondaryColor);
    setValue('editorSecondaryColorText', config.secondaryColor);

    // Display options
    const setChecked = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.checked = value || false;
    };

    setChecked('editorShowLogo', config.showLogo);
    setChecked('editorShowCompanyDetails', config.showCompanyDetails);

    // Sections
    if (config.sections) {
      setChecked('sectionEmployeeDetails', config.sections.employeeDetails);
      setChecked('sectionPayPeriod', config.sections.payPeriod);
      setChecked('sectionEarnings', config.sections.earnings);
      setChecked('sectionDeductions', config.sections.deductions);
      setChecked('sectionSummary', config.sections.summary);
      setChecked('sectionFooter', config.sections.footer);
    }

    // Deduction Types
    if (config.deductionTypes) {
      setChecked('deductionUIF', config.deductionTypes.uif?.enabled);
      setChecked('deductionPAYE', config.deductionTypes.paye?.enabled);
      setChecked('deductionPension', config.deductionTypes.pension?.enabled);
      setChecked('deductionMedicalAid', config.deductionTypes.medicalAid?.enabled);
      setChecked('deductionProvidentFund', config.deductionTypes.providentFund?.enabled);
      setChecked('deductionOther', config.deductionTypes.other?.enabled);
    }

    // Messages
    setValue('editorHeaderMessage', config.headerMessage);
    setValue('editorFooterMessage', config.footerMessage);
    setValue('editorEmailSubject', config.subject);

    this.updatePreview();
  }

  /**
   * Update live preview with sample data
   */
  updatePreview() {
    if (!this.previewFrame) return;

    const sampleData = {
      employeeName: 'John Doe',
      position: 'Cashier',
      employeeId: 'EMP001',
      payRate: '25.00',
      overtimeRate: '37.50',
      month: 'February',
      year: '2026',
      period: '2026-02',
      payDate: '28 February 2026',
      hoursWorked: '176.00',
      regularHours: '160.00',
      overtimeHours: '16.00',
      regularPay: '4000.00',
      overtimePay: '600.00',
      grossPay: '4600.00',
      // Sample deductions
      uif: '46.00', // 1% of gross
      paye: '230.00', // Sample PAYE
      pension: '345.00', // 7.5% of gross
      medicalAid: '1200.00', // Sample fixed amount
      providentFund: '345.00', // 7.5% of gross
      otherDeductions: '50.00', // Sample other deductions
      deductions: '460.00', // Total (UIF + PAYE in this example)
      netPay: '4140.00',
      businessName: this.currentConfig.companyName || 'Your Company Name'
    };

    // Create template instance with current config
    const template = createPayslipTemplate(this.currentConfig);
    const html = template.generateHTML(sampleData);

    // Replace template variables with sample data
    let filledHtml = html;
    for (const [key, value] of Object.entries(sampleData)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      filledHtml = filledHtml.replace(regex, value);
    }

    // Update iframe
    const doc = this.previewFrame.contentDocument || this.previewFrame.contentWindow.document;
    doc.open();
    doc.write(filledHtml);
    doc.close();
  }

  /**
   * Get current configuration
   */
  getConfig() {
    this.updateConfigFromForm();
    return this.currentConfig;
  }

  /**
   * Export configuration as JSON
   */
  exportConfig() {
    this.updateConfigFromForm();
    return JSON.stringify(this.currentConfig, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfig(jsonString) {
    try {
      const config = JSON.parse(jsonString);
      this.loadConfigIntoForm(config);
      return true;
    } catch (error) {
      console.error('Failed to import config:', error);
      return false;
    }
  }
}

// Export for use in main payslips module
export default TemplateEditor;
