/**
 * Employee Self-Service Credentials UI Module
 * 
 * This module provides UI components for managing employee portal credentials
 * Can be integrated into the business dashboard
 */

import employeeCredentialsManager from './employee-credentials.js';

export class EmployeeCredentialsUI {
  constructor(businessId) {
    this.businessId = businessId;
    employeeCredentialsManager.init(businessId);
  }

  /**
   * Render the credentials management panel
   * @returns {string} HTML string
   */
  renderCredentialsPanel() {
    return `
      <div class="credentials-management-panel">
        <style>
          .credentials-management-panel {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin: 2rem 0;
          }
          
          .credentials-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #f0f0f0;
          }
          
          .credentials-header h2 {
            margin: 0;
            color: #333;
            font-size: 1.5rem;
          }
          
          .credentials-actions {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
          }
          
          .cred-btn {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.95rem;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
          }
          
          .cred-btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          
          .cred-btn-secondary {
            background: #f0f9ff;
            color: #667eea;
            border: 2px solid #667eea;
          }
          
          .cred-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          
          .credentials-list {
            margin-top: 1.5rem;
          }
          
          .credential-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            margin-bottom: 0.75rem;
            transition: all 0.3s ease;
          }
          
          .credential-item:hover {
            background: #f9f9f9;
            border-color: #667eea;
          }
          
          .employee-info {
            flex: 1;
          }
          
          .employee-name {
            font-weight: 600;
            color: #333;
            margin-bottom: 0.25rem;
          }
          
          .employee-details {
            font-size: 0.85rem;
            color: #666;
          }
          
          .credential-status {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.4rem 0.8rem;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 600;
          }
          
          .status-active {
            background: #d4edda;
            color: #155724;
          }
          
          .status-pending {
            background: #fff3cd;
            color: #856404;
          }
          
          .credential-actions {
            display: flex;
            gap: 0.5rem;
          }
          
          .action-btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 600;
            transition: all 0.2s ease;
          }
          
          .action-btn-whatsapp {
            background: #25D366;
            color: white;
          }
          
          .action-btn-email {
            background: #4285F4;
            color: white;
          }
          
          .action-btn-generate {
            background: #FFA500;
            color: white;
          }
          
          .action-btn-edit {
            background: #667eea;
            color: white;
          }
          
          .action-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
          
          .action-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .alert {
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }
          
          .alert-success {
            background: #d4edda;
            color: #155724;
            border-left: 4px solid #28a745;
          }
          
          .alert-error {
            background: #f8d7da;
            color: #721c24;
            border-left: 4px solid #dc3545;
          }
          
          .alert-info {
            background: #d1ecf1;
            color: #0c5460;
            border-left: 4px solid #17a2b8;
          }
        </style>
        
        <div class="credentials-header">
          <h2>🔐 Employee Portal Credentials</h2>
          <div class="credentials-actions">
            <button class="cred-btn cred-btn-primary" onclick="employeeCredentialsUI.loadEmployees()">
              🔄 Refresh List
            </button>
            <button class="cred-btn cred-btn-secondary" onclick="employeeCredentialsUI.showBulkSendDialog()">
              📨 Bulk Send
            </button>
          </div>
        </div>
        
        <div id="credentials-alert-container"></div>
        
        <div class="credentials-list" id="credentials-employee-list">
          <div style="text-align: center; padding: 2rem; color: #999;">
            <div class="loading-spinner" style="margin: 0 auto 1rem;"></div>
            <p>Loading employees...</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Load and display all employees with credential status
   */
  async loadEmployees() {
    try {
      const listContainer = document.getElementById('credentials-employee-list');
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #999;">
          <div class="loading-spinner" style="margin: 0 auto 1rem;"></div>
          <p>Loading employees...</p>
        </div>
      `;

      const employees = await employeeCredentialsManager.getAllEmployeesWithCredentials();

      if (employees.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: #999;">
            <p>No employees found</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = employees.map(emp => this.renderEmployeeItem(emp)).join('');
    } catch (error) {
      this.showAlert('error', 'Failed to load employees: ' + error.message);
    }
  }

  /**
   * Render a single employee item
   */
  renderEmployeeItem(employee) {
    const hasCredentials = employee.username && employee.hasPassword;
    const statusBadge = hasCredentials 
      ? '<span class="credential-status status-active">✓ Active</span>' 
      : '<span class="credential-status status-pending">⚠ Not Set</span>';

    // Get current permissions (default all to true if not set)
    const permissions = employee.permissions || {
      overview: true,
      timecard: true,
      assessment: true,
      leave: true,
      applyFor: true
    };

    return `
      <div class="credential-item">
        <div class="employee-info">
          <div class="employee-name">${employee.name}</div>
          <div class="employee-details">
            Slot: ${employee.slot} | 
            ${employee.username ? `Username: ${employee.username}` : 'No username'} | 
            ${employee.phoneNumber || 'No phone'} | 
            ${employee.email || 'No email'}
          </div>
          
          <!-- Access Permissions -->
          ${hasCredentials ? `
            <div class="permissions-section" style="margin-top: 0.75rem; padding: 0.75rem; background: #f8f9fa; border-radius: 6px;">
              <div style="font-weight: 600; color: #495057; margin-bottom: 0.5rem; font-size: 0.9rem;">📋 Access Permissions:</div>
              <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                  <input type="checkbox" 
                         ${permissions.overview ? 'checked' : ''} 
                         onchange="employeeCredentialsUI.updatePermission('${employee.slot}', 'overview', this.checked)"
                         style="width: 16px; height: 16px; cursor: pointer;">
                  <span>Overview</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                  <input type="checkbox" 
                         ${permissions.timecard ? 'checked' : ''} 
                         onchange="employeeCredentialsUI.updatePermission('${employee.slot}', 'timecard', this.checked)"
                         style="width: 16px; height: 16px; cursor: pointer;">
                  <span>Timecard</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                  <input type="checkbox" 
                         ${permissions.assessment ? 'checked' : ''} 
                         onchange="employeeCredentialsUI.updatePermission('${employee.slot}', 'assessment', this.checked)"
                         style="width: 16px; height: 16px; cursor: pointer;">
                  <span>Assessment</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                  <input type="checkbox" 
                         ${permissions.leave ? 'checked' : ''} 
                         onchange="employeeCredentialsUI.updatePermission('${employee.slot}', 'leave', this.checked)"
                         style="width: 16px; height: 16px; cursor: pointer;">
                  <span>Leave</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                  <input type="checkbox" 
                         ${permissions.applyFor ? 'checked' : ''} 
                         onchange="employeeCredentialsUI.updatePermission('${employee.slot}', 'applyFor', this.checked)"
                         style="width: 16px; height: 16px; cursor: pointer;">
                  <span>Apply For</span>
                </label>
              </div>
            </div>
            
            <!-- Application Types -->
            <div class="application-types-section" style="margin-top: 0.75rem; padding: 0.75rem; background: #fff3cd; border-radius: 6px; border-left: 3px solid #ffc107;">
              <div style="font-weight: 600; color: #856404; margin-bottom: 0.5rem; font-size: 0.9rem;">📝 Application Types:</div>
              <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                  <input type="checkbox" 
                         ${(employee.applicationTypes?.leave !== false) ? 'checked' : ''} 
                         onchange="employeeCredentialsUI.updateApplicationType('${employee.slot}', 'leave', this.checked)"
                         style="width: 16px; height: 16px; cursor: pointer;">
                  <span>🏖️ Leave</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                  <input type="checkbox" 
                         ${(employee.applicationTypes?.sickleave !== false) ? 'checked' : ''} 
                         onchange="employeeCredentialsUI.updateApplicationType('${employee.slot}', 'sickleave', this.checked)"
                         style="width: 16px; height: 16px; cursor: pointer;">
                  <span>🤒 Sick Leave</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                  <input type="checkbox" 
                         ${(employee.applicationTypes?.cashadvance !== false) ? 'checked' : ''} 
                         onchange="employeeCredentialsUI.updateApplicationType('${employee.slot}', 'cashadvance', this.checked)"
                         style="width: 16px; height: 16px; cursor: pointer;">
                  <span>💰 Cash Advance</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                  <input type="checkbox" 
                         ${(employee.applicationTypes?.other !== false) ? 'checked' : ''} 
                         onchange="employeeCredentialsUI.updateApplicationType('${employee.slot}', 'other', this.checked)"
                         style="width: 16px; height: 16px; cursor: pointer;">
                  <span>📋 Other</span>
                </label>
              </div>
            </div>
          ` : ''}
        </div>
        
        ${statusBadge}
        
        <div class="credential-actions">
          ${!hasCredentials ? `
            <button class="action-btn action-btn-generate" 
                    onclick="employeeCredentialsUI.generateAndShow('${employee.slot}')">
              🔑 Generate
            </button>
          ` : `
            <button class="action-btn action-btn-edit" 
                    onclick="employeeCredentialsUI.editCredentials('${employee.slot}')">
              ✏️ Edit
            </button>
          `}
          
          ${hasCredentials && employee.phoneNumber ? `
            <button class="action-btn action-btn-whatsapp" 
                    onclick="employeeCredentialsUI.sendViaWhatsApp('${employee.slot}')">
              📱 WhatsApp
            </button>
          ` : ''}
          
          ${hasCredentials && employee.email ? `
            <button class="action-btn action-btn-email" 
                    onclick="employeeCredentialsUI.sendViaEmail('${employee.slot}')">
              📧 Email
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Generate credentials for an employee and show dialog
   */
  async generateAndShow(employeeSlot) {
    try {
      this.showAlert('info', 'Generating credentials...');
      
      const result = await employeeCredentialsManager.setEmployeeCredentials(employeeSlot);
      
      const credText = employeeCredentialsManager.generateCredentialsText(result);
      
      this.showCredentialsDialog(result, credText);
      
      // Reload list
      await this.loadEmployees();
      
      this.showAlert('success', 'Credentials generated successfully!');
    } catch (error) {
      this.showAlert('error', 'Failed to generate credentials: ' + error.message);
    }
  }

  /**
   * Edit existing credentials
   */
  async editCredentials(employeeSlot) {
    try {
      // Get current credentials
      const credInfo = await employeeCredentialsManager.getEmployeeCredentials(employeeSlot);
      
      // Show edit dialog
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;" onclick="this.remove()">
          <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%;" onclick="event.stopPropagation()">
            <h3 style="margin: 0 0 1rem 0;">✏️ Edit Employee Credentials</h3>
            <p style="color: #666; margin-bottom: 1.5rem;">Edit login credentials for ${credInfo.employeeName}</p>
            
            <div style="margin-bottom: 1rem;">
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Username</label>
              <input type="text" id="edit-username" value="${credInfo.username || ''}" 
                     style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;"
                     placeholder="Enter username">
            </div>
            
            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Password</label>
              <input type="text" id="edit-password" value="" 
                     style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;"
                     placeholder="Enter new password (leave blank to keep current)">
              <small style="color: #666; font-size: 0.85rem;">Leave blank to keep current password</small>
            </div>
            
            <div style="display: flex; gap: 1rem;">
              <button onclick="this.closest('div').parentElement.remove()" 
                      style="flex: 1; padding: 0.75rem; background: #f0f0f0; color: #333; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                Cancel
              </button>
              <button onclick="employeeCredentialsUI.saveCredentialEdit('${employeeSlot}')" 
                      style="flex: 1; padding: 0.75rem; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                💾 Save
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);
      
    } catch (error) {
      this.showAlert('error', 'Failed to load credentials: ' + error.message);
    }
  }

  /**
   * Save edited credentials
   */
  async saveCredentialEdit(employeeSlot) {
    try {
      const username = document.getElementById('edit-username').value.trim();
      const password = document.getElementById('edit-password').value.trim();
      
      if (!username) {
        alert('Username is required');
        return;
      }
      
      this.showAlert('info', 'Saving credentials...');
      
      // Update credentials
      const result = await employeeCredentialsManager.setEmployeeCredentials(
        employeeSlot, 
        username, 
        password || null
      );
      
      // Close dialog
      document.querySelectorAll('div[style*="position: fixed"]').forEach(el => el.remove());
      
      // Show credentials if password was changed
      if (password) {
        const credText = employeeCredentialsManager.generateCredentialsText(result);
        this.showCredentialsDialog(result, credText);
      }
      
      // Reload list
      await this.loadEmployees();
      
      this.showAlert('success', 'Credentials updated successfully!');
    } catch (error) {
      this.showAlert('error', 'Failed to save credentials: ' + error.message);
    }
  }

  /**
   * Send credentials via WhatsApp
   */
  async sendViaWhatsApp(employeeSlot) {
    if (!confirm('Send employee portal credentials via WhatsApp?')) return;
    
    try {
      this.showAlert('info', 'Sending via WhatsApp...');
      
      const credInfo = await employeeCredentialsManager.getEmployeeCredentials(employeeSlot);
      const credentials = {
        username: credInfo.username,
        password: '******', // Don't fetch actual password
        employeeName: credInfo.employeeName,
        phoneNumber: credInfo.phoneNumber
      };
      
      // Call cloud function directly
      const response = await fetch('https://employeeselfservice-sendcredentials-4q7htrps4q-uc.a.run.app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: this.businessId,
          employeeSlot,
          deliveryMethod: 'whatsapp'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.showAlert('success', '✅ Credentials sent via WhatsApp!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      this.showAlert('error', 'Failed to send via WhatsApp: ' + error.message);
    }
  }

  /**
   * Send credentials via Email
   */
  async sendViaEmail(employeeSlot) {
    if (!confirm('Send employee portal credentials via Email?')) return;
    
    try {
      this.showAlert('info', 'Sending via Email...');
      
      // Call cloud function directly
      const response = await fetch('https://employeeselfservice-sendcredentials-4q7htrps4q-uc.a.run.app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: this.businessId,
          employeeSlot,
          deliveryMethod: 'email'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.showAlert('success', '✅ Credentials email queued for delivery!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      this.showAlert('error', 'Failed to send email: ' + error.message);
    }
  }

  /**
   * Show credentials dialog
   */
  showCredentialsDialog(credentials, formattedText) {
    const dialog = document.createElement('div');
    dialog.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;" onclick="this.remove()">
        <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%;" onclick="event.stopPropagation()">
          <h3 style="margin: 0 0 1rem 0;">✅ Credentials Generated</h3>
          <div style="background: #f0f9ff; padding: 1rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid #667eea;">
            <pre style="white-space: pre-wrap; word-wrap: break-word; font-family: monospace; margin: 0;">${formattedText}</pre>
          </div>
          <p style="color: #666; font-size: 0.9rem;">Share these credentials with the employee securely.</p>
          <div style="display: flex; gap: 1rem; margin-top: 1rem;">
            <button onclick="navigator.clipboard.writeText(\`${formattedText.replace(/`/g, '\\`')}\`); alert('Copied to clipboard!')" style="flex: 1; padding: 0.75rem; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
              📋 Copy
            </button>
            <button onclick="this.closest('div').parentElement.remove()" style="flex: 1; padding: 0.75rem; background: #f0f0f0; color: #333; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
              Close
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
  }

  /**
   * Show alert message
   */
  showAlert(type, message) {
    const container = document.getElementById('credentials-alert-container');
    if (!container) return;
    
    container.innerHTML = `
      <div class="alert alert-${type}">
        ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} ${message}
      </div>
    `;
    
    setTimeout(() => {
      container.innerHTML = '';
    }, 5000);
  }

  /**
   * Update employee permission
   */
  async updatePermission(employeeSlot, permissionType, isEnabled) {
    try {
      // Import Firebase dynamically
      const { getFirestore, doc, updateDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      const db = getFirestore();
      
      // Find employee by slot
      const staffQuery = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      const { collection, query, where, getDocs } = staffQuery;
      
      const staffRef = collection(db, 'businesses', this.businessId, 'staff');
      const q = query(staffRef, where('slot', '==', parseInt(employeeSlot)));
      const staffSnap = await getDocs(q);
      
      if (staffSnap.empty) {
        throw new Error('Employee not found');
      }
      
      const employeeDoc = staffSnap.docs[0];
      const employeeData = employeeDoc.data();
      
      // Update permissions
      const currentPermissions = employeeData.permissions || {
        overview: true,
        timecard: true,
        assessment: true,
        leave: true,
        applyFor: true
      };
      
      currentPermissions[permissionType] = isEnabled;
      
      // Save to Firestore
      await updateDoc(doc(db, 'businesses', this.businessId, 'staff', employeeDoc.id), {
        permissions: currentPermissions
      });
      
      const statusText = isEnabled ? 'enabled' : 'disabled';
      this.showAlert('success', `✓ ${permissionType} access ${statusText} for ${employeeData.employeeName}`);
      
    } catch (error) {
      console.error('Error updating permission:', error);
      this.showAlert('error', 'Failed to update permission: ' + error.message);
    }
  }

  /**
   * Update employee application type
   */
  async updateApplicationType(employeeSlot, applicationType, isEnabled) {
    try {
      // Import Firebase dynamically
      const { getFirestore, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      const db = getFirestore();
      
      // Find employee by slot
      const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      
      const staffRef = collection(db, 'businesses', this.businessId, 'staff');
      const q = query(staffRef, where('slot', '==', parseInt(employeeSlot)));
      const staffSnap = await getDocs(q);
      
      if (staffSnap.empty) {
        throw new Error('Employee not found');
      }
      
      const employeeDoc = staffSnap.docs[0];
      const employeeData = employeeDoc.data();
      
      // Update application types (default all to true)
      const currentTypes = employeeData.applicationTypes || {
        leave: true,
        sickleave: true,
        cashadvance: true,
        other: true
      };
      
      currentTypes[applicationType] = isEnabled;
      
      // Save to Firestore
      await updateDoc(doc(db, 'businesses', this.businessId, 'staff', employeeDoc.id), {
        applicationTypes: currentTypes
      });
      
      const typeNames = {
        leave: 'Leave',
        sickleave: 'Sick Leave',
        cashadvance: 'Cash Advance',
        other: 'Other'
      };
      
      const statusText = isEnabled ? 'enabled' : 'disabled';
      this.showAlert('success', `✓ ${typeNames[applicationType]} application ${statusText} for ${employeeData.employeeName}`);
      
    } catch (error) {
      console.error('Error updating application type:', error);
      this.showAlert('error', 'Failed to update application type: ' + error.message);
    }
  }

  /**
   * Show bulk send dialog
   */
  showBulkSendDialog() {
    alert('Bulk send feature: Select multiple employees and send credentials to all at once. Coming soon!');
  }
}

// Make it globally available
window.EmployeeCredentialsUI = EmployeeCredentialsUI;
