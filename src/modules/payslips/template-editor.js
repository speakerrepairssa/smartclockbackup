/**
 * Payslip Template Editor Controller
 * Manages visual template editing with live preview
 */

import { DEFAULT_PAYSLIP_TEMPLATE, createPayslipTemplate } from './default-template.js';

export class TemplateEditor {
  constructor() {
    this.currentConfig = { ...DEFAULT_PAYSLIP_TEMPLATE };
    this.previewFrame = null;
    this.init();
  }

  init() {
    this.setupTabSwitching();
    this.setupColorPickers();
    this.setupFormListeners();
    this.previewFrame = document.getElementById('livePreviewFrame');
    this.updatePreview();
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
      'sectionFooter'
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
      deductions: '460.00',
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
