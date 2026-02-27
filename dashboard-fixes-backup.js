// Admin Dashboard Module
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  query,
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "../../config/firebase.js";
import authService from "../auth/auth.service.js";
import { showNotification, showLoader, hideLoader } from "../shared/ui.js";

/**
 * Admin Dashboard Controller
 */
class AdminDashboardController {
  constructor() {
    this.businesses = [];
    this.isInitialized = false;
    this.init();
  }

  /**
   * Initialize dashboard
   */
  async init() {
    try {
      // Prevent multiple initializations
      if (this.isInitialized) {
        console.warn('Admin dashboard already initialized');
        return;
      }

      console.log('🔄 Loading Dashboard...');
      console.log('Initializing admin panel and loading businesses...');

      // Check authentication
      if (!authService.isAuthenticated() || authService.getUserRole() !== "admin") {
        console.log('Authentication failed, redirecting to login...');
        window.location.href = "/pages/login.html";
        return;
      }

      console.log('Authentication successful, proceeding with initialization...');

      // Mark as initialized early to prevent multiple attempts
      this.isInitialized = true;

      // Initialize event listeners (safe operation)
      this.initializeEventListeners();

      // Load data with individual error handling
      try {
        console.log('Loading businesses...');
        await this.loadBusinesses();
      } catch (error) {
        console.error('Failed to load businesses:', error);
        // Continue with other initialization steps
      }

      try {
        console.log('Loading devices...');
        await this.loadDevices();
      } catch (error) {
        console.error('Failed to load devices:', error);
        // Continue with other initialization steps
      }

      try {
        console.log('Displaying stats...');
        this.displayStats();
      } catch (error) {
        console.error('Failed to display stats:', error);
        // Continue - not critical
      }

      console.log('✅ Admin dashboard initialized successfully');

    } catch (error) {
      console.error('❌ Critical error during admin dashboard initialization:', error);

      // Still mark as initialized to prevent infinite retries
      this.isInitialized = true;

      showNotification('Failed to load dashboard: ' + error.message, 'error');
      hideLoader();

      // Don't throw - let the system continue working as much as possible
    }
  }

  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.handleLogout());
    }

    // Create business button
    const createBusinessBtn = document.getElementById("createBusinessBtn");
    if (createBusinessBtn) {
      createBusinessBtn.addEventListener("click", () => this.showCreateBusinessModal());
    }

    // Hard reset button
    const hardResetBtn = document.getElementById("hardResetBtn");
    if (hardResetBtn) {
      console.log('Hard reset button found, attaching event listener');
      hardResetBtn.addEventListener("click", () => {
        console.log('Hard reset button clicked');
        this.showHardResetModal();
      });
    } else {
      console.log('Hard reset button not found');
    }

    // Refresh button
    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.loadBusinesses());
    }

    // Add device button
    const addDeviceBtn = document.getElementById("addDeviceBtn");
    if (addDeviceBtn) {
      addDeviceBtn.addEventListener("click", () => this.openAddDeviceModal());
    }

    // Close modal button
    const closeModalBtn = document.getElementById("closeModalBtn");
    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", () => this.closeAddDeviceModal());
    }

    // Cancel modal button
    const cancelModalBtn = document.getElementById("cancelModalBtn");
    if (cancelModalBtn) {
      cancelModalBtn.addEventListener("click", () => this.closeAddDeviceModal());
    }

    // Register device button
    const registerDeviceBtn = document.getElementById("registerDeviceBtn");
    if (registerDeviceBtn) {
      registerDeviceBtn.addEventListener("click", () => this.registerDevice());
    }

    // Edit device modal handlers
    const closeEditModalBtn = document.getElementById("closeEditModalBtn");
    if (closeEditModalBtn) {
      closeEditModalBtn.addEventListener("click", () => this.closeEditDeviceModal());
    }

    const cancelEditModalBtn = document.getElementById("cancelEditModalBtn");
    if (cancelEditModalBtn) {
      cancelEditModalBtn.addEventListener("click", () => this.closeEditDeviceModal());
    }

    const updateDeviceBtn = document.getElementById("updateDeviceBtn");
    if (updateDeviceBtn) {
      updateDeviceBtn.addEventListener("click", () => this.updateDevice());
    }

    // Delegate edit and delete buttons
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("device-edit-btn")) {
        const deviceId = e.target.dataset.deviceId;
        this.openEditDeviceModal(deviceId);
      }
      if (e.target.classList.contains("device-delete-btn")) {
        const deviceId = e.target.dataset.deviceId;
        this.deleteDevice(deviceId);
      }
    });

    // Close modal on outside click
    const modal = document.getElementById("addDeviceModal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.closeAddDeviceModal();
        }
      });
    }

    // Close admin tool modals on outside click
    const restoreModal = document.getElementById("restoreEmployeeModal");
    if (restoreModal) {
      restoreModal.addEventListener("click", (e) => {
        if (e.target === restoreModal) {
          this.closeRestoreEmployeeModal();
        }
      });
    }

    const recalcModal = document.getElementById("recalculateAssessmentModal");
    if (recalcModal) {
      recalcModal.addEventListener("click", (e) => {
        if (e.target === recalcModal) {
          this.closeRecalculateModal();
        }
      });
    }

    const shiftModal = document.getElementById("viewShiftModal");
    if (shiftModal) {
      shiftModal.addEventListener("click", (e) => {
        if (e.target === shiftModal) {
          this.closeShiftModal();
        }
      });
    }

    const debugModal = document.getElementById("debugCollectionsModal");
    if (debugModal) {
      debugModal.addEventListener("click", (e) => {
        if (e.target === debugModal) {
          this.closeDebugModal();
        }
      });
    }

    // Admin Tools Event Listeners
    // Restore Employee Status
    const restoreEmployeeStatusBtn = document.getElementById("restoreEmployeeStatusBtn");
    if (restoreEmployeeStatusBtn) {
      console.log('Restore Employee Status button found');
      restoreEmployeeStatusBtn.addEventListener("click", () => {
        console.log('Restore Employee Status button clicked');
        this.openRestoreEmployeeModal();
      });
    } else {
      console.log('Restore Employee Status button NOT found');
    }

    const closeRestoreEmployeeModalBtn = document.getElementById("closeRestoreEmployeeModalBtn");
    if (closeRestoreEmployeeModalBtn) {
      closeRestoreEmployeeModalBtn.addEventListener("click", () => this.closeRestoreEmployeeModal());
    }

    const cancelRestoreEmployeeBtn = document.getElementById("cancelRestoreEmployeeBtn");
    if (cancelRestoreEmployeeBtn) {
      cancelRestoreEmployeeBtn.addEventListener("click", () => this.closeRestoreEmployeeModal());
    }

    const runRestoreEmployeeBtn = document.getElementById("runRestoreEmployeeBtn");
    if (runRestoreEmployeeBtn) {
      runRestoreEmployeeBtn.addEventListener("click", () => this.restoreEmployeeStatus());
    }

    // Recalculate Assessment
    const recalculateAssessmentBtn = document.getElementById("recalculateAssessmentBtn");
    if (recalculateAssessmentBtn) {
      console.log('Recalculate Assessment button found');
      recalculateAssessmentBtn.addEventListener("click", () => {
        console.log('Recalculate Assessment button clicked');
        this.openRecalculateModal();
      });
    } else {
      console.log('Recalculate Assessment button NOT found');
    }

    const closeRecalculateModalBtn = document.getElementById("closeRecalculateModalBtn");
    if (closeRecalculateModalBtn) {
      closeRecalculateModalBtn.addEventListener("click", () => this.closeRecalculateModal());
    }

    const cancelRecalcBtn = document.getElementById("cancelRecalcBtn");
    if (cancelRecalcBtn) {
      cancelRecalcBtn.addEventListener("click", () => this.closeRecalculateModal());
    }

    const runRecalcBtn = document.getElementById("runRecalcBtn");
    if (runRecalcBtn) {
      runRecalcBtn.addEventListener("click", () => this.recalculateAssessment());
    }

    // View Shift Config
    const viewShiftConfigBtn = document.getElementById("viewShiftConfigBtn");
    if (viewShiftConfigBtn) {
      console.log('View Shift Config button found');
      viewShiftConfigBtn.addEventListener("click", () => {
        console.log('View Shift Config button clicked');
        this.openShiftModal();
      });
    } else {
      console.log('View Shift Config button NOT found');
    }

    const closeShiftModalBtn = document.getElementById("closeShiftModalBtn");
    if (closeShiftModalBtn) {
      closeShiftModalBtn.addEventListener("click", () => this.closeShiftModal());
    }

    const closeShiftBtn = document.getElementById("closeShiftBtn");
    if (closeShiftBtn) {
      closeShiftBtn.addEventListener("click", () => this.closeShiftModal());
    }

    const loadShiftConfigBtn = document.getElementById("loadShiftConfigBtn");
    if (loadShiftConfigBtn) {
      loadShiftConfigBtn.addEventListener("click", () => this.loadShiftConfig());
    }

    // Debug Collections
    const debugCollectionsBtn = document.getElementById("debugCollectionsBtn");
    if (debugCollectionsBtn) {
      console.log('Debug Collections button found');
      debugCollectionsBtn.addEventListener("click", () => {
        console.log('Debug Collections button clicked');
        this.openDebugModal();
      });
    } else {
      console.log('Debug Collections button NOT found');
    }

    const closeDebugModalBtn = document.getElementById("closeDebugModalBtn");
    if (closeDebugModalBtn) {
      closeDebugModalBtn.addEventListener("click", () => this.closeDebugModal());
    }

    const closeDebugBtn = document.getElementById("closeDebugBtn");
    if (closeDebugBtn) {
      closeDebugBtn.addEventListener("click", () => this.closeDebugModal());
    }

    const loadDebugBtn = document.getElementById("loadDebugBtn");
    if (loadDebugBtn) {
      loadDebugBtn.addEventListener("click", () => this.loadDebugCollections());
    }
  }

  /**
   * Load all businesses
   */
  async loadBusinesses() {
    try {
      showLoader();

      const businessesRef = collection(db, "businesses");
      const q = query(businessesRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      this.businesses = [];
      querySnapshot.forEach((doc) => {
        this.businesses.push({
          id: doc.id,
          ...doc.data()
        });
      });

      this.displayBusinesses();
      
      // Load businesses into permissions selector
      this.loadBusinessesForPermissions();
      
      hideLoader();

    } catch (error) {
      console.error("Error loading businesses:", error);
      showNotification("Error loading businesses", "error");
      hideLoader();
    }
  }

  /**
   * Display businesses in table
   */
  displayBusinesses() {
    const tbody = document.getElementById("businessesTableBody");
    if (!tbody) return;

    if (this.businesses.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem;">
            No businesses registered yet
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.businesses.map(business => `
      <tr>
        <td style="font-family: monospace; color: #3b82f6; font-weight: 600;">${business.id}</td>
        <td>${business.businessName}</td>
        <td>${business.email}</td>
        <td>${business.plan}</td>
        <td>${business.slotsAllowed || 'Unlimited'}</td>
        <td>
          <span class="status-badge ${business.status}">
            ${business.status}
          </span>
        </td>
        <td>
          <button class="btn btn-small" onclick="adminDashboard.viewBusiness('${business.id}')">
            View
          </button>
          <button class="btn btn-small btn-secondary" onclick="adminDashboard.editBusiness('${business.id}')">
            Edit
          </button>

          <button class="btn btn-small btn-danger" onclick="adminDashboard.deleteBusiness('${business.id}')">
            Delete
          </button>
        </td>
      </tr>
    `).join("");
  }

  /**
   * Display statistics
   */
  displayStats() {
    const totalBusinesses = this.businesses.length;
    const activeBusinesses = this.businesses.filter(b => b.status === "active").length;
    const totalSlots = this.businesses
      .reduce((sum, b) => sum + (b.slotsAllowed || 0), 0);

    // Count total devices
    let totalDevices = 0;
    this.businesses.forEach(b => {
      if (b.devicesCount) {
        totalDevices += b.devicesCount;
      }
    });

    // Update stats cards with null checks
    const totalBusinessesEl = document.getElementById("totalBusinesses");
    if (totalBusinessesEl) {
      totalBusinessesEl.textContent = totalBusinesses;
    }

    const activeBusinessesEl = document.getElementById("activeBusinesses");
    if (activeBusinessesEl) {
      activeBusinessesEl.textContent = activeBusinesses;
    }

    const totalSlotsEl = document.getElementById("totalSlots");
    if (totalSlotsEl) {
      totalSlotsEl.textContent = totalSlots;
    }

    const totalDevicesEl = document.getElementById("totalDevices");
    if (totalDevicesEl) {
      totalDevicesEl.textContent = totalDevices;
    }
  }

  /**
   * View business details
   * @param {string} businessId 
   */
  async viewBusiness(businessId) {
    try {
      showLoader();

      const businessRef = doc(db, "businesses", businessId);
      const businessDoc = await getDoc(businessRef);

      if (!businessDoc.exists()) {
        throw new Error("Business not found");
      }

      const business = businessDoc.data();

      // Get staff count
      const staffRef = collection(db, "businesses", businessId, "staff");
      const staffSnapshot = await getDocs(staffRef);
      const activeStaff = staffSnapshot.docs.filter(
        doc => doc.data().active === true
      ).length;

      hideLoader();

      // Show modal with business details
      const modal = `
        <div class="modal-overlay" onclick="this.remove()">
          <div class="modal" onclick="event.stopPropagation()">
            <h2>${business.businessName}</h2>
            <div class="business-details">
              <p><strong>Email:</strong> ${business.email}</p>
              <p><strong>Plan:</strong> ${business.plan}</p>
              <p><strong>Slots Allowed:</strong> ${business.slotsAllowed || 'Unlimited'}</p>
              <p><strong>Active Staff:</strong> ${activeStaff} / ${business.slotsAllowed || '∞'}</p>
              <p><strong>Device ID:</strong> ${business.deviceId || "Not set"}</p>
              <p><strong>Status:</strong> ${business.status}</p>
              <p><strong>Created:</strong> ${new Date(business.createdAt).toLocaleDateString()}</p>
            </div>
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">Close</button>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML("beforeend", modal);

    } catch (error) {
      console.error("Error viewing business:", error);
      showNotification(error.message, "error");
      hideLoader();
    }
  }

  /**
   * Edit business
   * @param {string} businessId 
   */
  editBusiness(businessId) {
    // Navigate to edit page or show edit modal
    window.location.href = `/pages/edit-business.html?id=${businessId}`;
  }

  /**
   * Delete business
   * @param {string} businessId 
   */
  async deleteBusiness(businessId) {
    if (!confirm("Are you sure you want to delete this business? This action cannot be undone.")) {
      return;
    }

    try {
      showLoader();

      const businessRef = doc(db, "businesses", businessId);
      await deleteDoc(businessRef);

      showNotification("Business deleted successfully", "success");
      await this.loadBusinesses();
      this.displayStats();

      hideLoader();

    } catch (error) {
      console.error("Error deleting business:", error);
      showNotification("Error deleting business", "error");
      hideLoader();
    }
  }

  /**
   * Show create business modal
   */
  showCreateBusinessModal() {
    window.location.href = "/pages/admin-register.html";
  }

  /**
   * Handle logout
   */
  async handleLogout() {
    try {
      await authService.logout();
      window.location.href = "/pages/login.html";
    } catch (error) {
      console.error("Logout error:", error);
      showNotification("Error logging out", "error");
    }
  }

  /**
   * Load all devices from all businesses
   */
  async loadDevices() {
    try {
      const allDevices = [];

      // Get all devices from global collection
      const devicesRef = collection(db, "devices");
      const devicesSnap = await getDocs(devicesRef);

      // Get all businesses to check which ones use each device
      const businessesRef = collection(db, "businesses");
      const businessesSnap = await getDocs(businessesRef);
      const businessesMap = {};
      
      businessesSnap.forEach((businessDoc) => {
        const businessData = businessDoc.data();
        businessesMap[businessDoc.id] = businessData.businessName || businessDoc.id;
      });

      // Collect all devices and check which businesses use them by checking their devices subcollections
      for (const deviceDoc of devicesSnap.docs) {
        const deviceData = deviceDoc.data();
        const deviceId = deviceDoc.id;
        
        // Find which businesses have this device in their devices subcollection
        const linkedBusinesses = [];
        for (const businessDoc of businessesSnap.docs) {
          const businessDeviceRef = doc(db, "businesses", businessDoc.id, "devices", deviceId);
          const businessDeviceSnap = await getDoc(businessDeviceRef);
          
          if (businessDeviceSnap.exists()) {
            linkedBusinesses.push(businessesMap[businessDoc.id]);
          }
        }

        allDevices.push({
          id: deviceId,
          linkedBusinesses: linkedBusinesses.length > 0 ? linkedBusinesses.join(', ') : 'Not assigned',
          ...deviceData
        });
      }

      this.devices = allDevices;
      this.displayDevices();

    } catch (error) {
      console.error("Error loading devices:", error);
      showNotification("Error loading devices", "error");
    }
  }

  /**
   * Display devices in table
   */
  displayDevices() {
    const tbody = document.getElementById("devicesTableBody");
    if (!tbody) return;

    if (this.devices.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2rem;">
            No devices registered yet
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.devices.map(device => `
      <tr>
        <td>${device.id}</td>
        <td>${device.deviceName}</td>
        <td>${device.deviceType ? device.deviceType.replace(/_/g, ' ') : 'N/A'}</td>
        <td>${device.serialNumber || 'N/A'}</td>
        <td>${device.ipAddress || 'N/A'}</td>
        <td>${device.linkedBusinesses || 'Not assigned'}</td>
        <td>
          <span class="status-badge ${device.status}">
            ${device.status}
          </span>
        </td>
        <td>
          <button class="btn btn-small btn-secondary device-edit-btn" data-device-id="${device.id}">
            Edit
          </button>
          <button class="btn btn-small btn-danger device-delete-btn" data-device-id="${device.id}">
            Delete
          </button>
        </td>
      </tr>
    `).join("");
  }

  /**
   * Open edit device modal
   * @param {string} deviceId 
   */
  async openEditDeviceModal(deviceId) {
    try {
      // Get device data from global collection
      const deviceRef = doc(db, "devices", deviceId);
      const deviceSnap = await getDoc(deviceRef);
      
      if (!deviceSnap.exists()) {
        showNotification("Device not found", "error");
        return;
      }
      
      const device = deviceSnap.data();
      
      // Populate form fields
      document.getElementById("editDeviceId").value = deviceId;
      document.getElementById("editDeviceName").value = device.deviceName || "";
      document.getElementById("editDeviceType").value = device.deviceType || "";
      document.getElementById("editSerialNumber").value = device.serialNumber || "";
      document.getElementById("editIpAddress").value = device.ipAddress || "";
      document.getElementById("editDeviceUsername").value = device.username || "";
      document.getElementById("editDevicePassword").value = ""; // Don't show existing password
      document.getElementById("editDeviceStatus").value = device.status || "Active";
      
      // Clear connection status
      const statusElement = document.getElementById("editConnectionStatus");
      if (statusElement) {
        statusElement.textContent = "";
      }
      
      // Show modal
      document.getElementById("editDeviceModal").style.display = "flex";

      // Add test connection button listener (remove old listener first)
      const testEditConnectionBtn = document.getElementById('testEditConnectionBtn');
      if (testEditConnectionBtn) {
        // Remove old listener by cloning
        const newBtn = testEditConnectionBtn.cloneNode(true);
        testEditConnectionBtn.parentNode.replaceChild(newBtn, testEditConnectionBtn);
        // Add new listener
        newBtn.addEventListener('click', () => this.testDeviceConnection(true));
      }
    } catch (error) {
      console.error("Error opening edit modal:", error);
      showNotification("Error loading device data", "error");
    }
  }
  
  /**
   * Close edit device modal
   */
  closeEditDeviceModal() {
    document.getElementById("editDeviceModal").style.display = "none";
    document.getElementById("editDeviceForm").reset();
  }
  
  /**
   * Update device
   */
  async updateDevice() {
    const deviceId = document.getElementById("editDeviceId").value;
    const deviceName = document.getElementById("editDeviceName").value.trim();
    const deviceType = document.getElementById("editDeviceType").value;
    const serialNumber = document.getElementById("editSerialNumber").value.trim();
    const ipAddress = document.getElementById("editIpAddress").value.trim();
    const username = document.getElementById("editDeviceUsername").value.trim();
    const password = document.getElementById("editDevicePassword").value.trim();
    const status = document.getElementById("editDeviceStatus").value;
    
    if (!deviceName || !deviceType || !ipAddress) {
      showNotification("Please fill in all required fields", "error");
      return;
    }
    
    try {
      showLoader();
      
      // Prepare device data
      const deviceData = {
        deviceId: deviceId,
        deviceName: deviceName,
        deviceType: deviceType,
        serialNumber: serialNumber,
        ipAddress: ipAddress,
        username: username,
        status: status,
        lastSync: new Date().toISOString()
      };
      
      // Only update password if provided
      if (password) {
        deviceData.password = password;
      }
      
      // Update device in global collection
      const deviceRef = doc(db, "devices", deviceId);
      
      // If no new password provided, don't update the password field
      if (!password) {
        delete deviceData.password;
      }
      
      await updateDoc(deviceRef, deviceData);
      
      showNotification("Device updated successfully", "success");
      this.closeEditDeviceModal();
      await this.loadDevices();
      hideLoader();
    } catch (error) {
      console.error("Error updating device:", error);
      showNotification("Error updating device: " + error.message, "error");
      hideLoader();
    }
  }

  /**
   * Delete device
   * @param {string} deviceId 
   */
  async deleteDevice(deviceId) {
    if (!confirm("Are you sure you want to delete this device? This will also remove it from any businesses using it.")) {
      return;
    }

    try {
      showLoader();
      const deviceRef = doc(db, "devices", deviceId);
      await deleteDoc(deviceRef);
      
      // Also remove device reference from any businesses using it
      const businessesRef = collection(db, "businesses");
      const businessesSnap = await getDocs(businessesRef);
      
      for (const businessDoc of businessesSnap.docs) {
        const businessData = businessDoc.data();
        if (businessData.deviceId === deviceId) {
          await updateDoc(doc(db, "businesses", businessDoc.id), {
            deviceId: ""
          });
        }
      }
      
      showNotification("Device deleted successfully", "success");
      await this.loadDevices();
      hideLoader();
    } catch (error) {
      console.error("Error deleting device:", error);
      showNotification("Error deleting device", "error");
      hideLoader();
    }
  }

  /**
   * Manage devices for a business
   * @param {string} businessId 
   */
  manageDevices(businessId) {
    window.location.href = `/pages/device-manager.html?businessId=${businessId}`;
  }

  /**
   * Open add device modal
   */
  openAddDeviceModal() {
    // Clear connection status
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
      statusElement.textContent = '';
    }

    // Show modal
    document.getElementById('addDeviceModal').style.display = 'flex';

    // Add test connection button listener (remove old listener first)
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    if (testConnectionBtn) {
      // Remove old listener by cloning
      const newBtn = testConnectionBtn.cloneNode(true);
      testConnectionBtn.parentNode.replaceChild(newBtn, testConnectionBtn);
      // Add new listener
      newBtn.addEventListener('click', () => this.testDeviceConnection(false));
    }
  }

  /**
   * Close add device modal
   */
  closeAddDeviceModal() {
    document.getElementById('addDeviceModal').style.display = 'none';
    document.getElementById('addDeviceForm').reset();
  }

  /**
   * Test device connection
   * @param {boolean} isEdit - Whether this is from edit modal
   */
  async testDeviceConnection(isEdit = false) {
    try {
      const prefix = isEdit ? 'edit' : '';
      const ipAddressId = isEdit ? 'editIpAddress' : 'ipAddress';
      const usernameId = isEdit ? 'editDeviceUsername' : 'deviceUsername';
      const passwordId = isEdit ? 'editDevicePassword' : 'devicePassword';
      const statusId = isEdit ? 'editConnectionStatus' : 'connectionStatus';
      
      const ipAddress = document.getElementById(ipAddressId).value.trim();
      const username = document.getElementById(usernameId).value.trim();
      const password = document.getElementById(passwordId).value.trim();
      const statusElement = document.getElementById(statusId);

      if (!ipAddress) {
        statusElement.textContent = '❌ Please enter an IP address';
        statusElement.style.color = '#ef4444';
        return;
      }

      // Validate IP address format
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(ipAddress)) {
        statusElement.textContent = '❌ Invalid IP address format';
        statusElement.style.color = '#ef4444';
        return;
      }

      statusElement.textContent = '🔄 Testing connection...';
      statusElement.style.color = '#3b82f6';

      // Simulate device connection test
      // In a real implementation, you would call a Cloud Function to test the connection
      const connectionUrl = `http://${ipAddress}`;
      
      // Try to ping the device (this is a simulation)
      const testResult = await this.simulateDeviceConnection(ipAddress, username, password);
      
      if (testResult.success) {
        statusElement.textContent = `✅ Connection successful! Device is reachable (${testResult.responseTime}ms)`;
        statusElement.style.color = '#10b981';
      } else {
        statusElement.textContent = `❌ Connection failed: ${testResult.error}`;
        statusElement.style.color = '#ef4444';
      }

    } catch (error) {
      console.error('Error testing connection:', error);
      const statusId = isEdit ? 'editConnectionStatus' : 'connectionStatus';
      const statusElement = document.getElementById(statusId);
      statusElement.textContent = `❌ Error: ${error.message}`;
      statusElement.style.color = '#ef4444';
    }
  }

  /**
   * Simulate device connection (replace with actual API call to Cloud Function)
   * @param {string} ipAddress 
   * @param {string} username 
   * @param {string} password 
   */
  async simulateDeviceConnection(ipAddress, username, password) {
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        // In production, this should call a Cloud Function that:
        // 1. Attempts to connect to the device at the IP address
        // 2. Authenticates with username/password if provided
        // 3. Checks if the device API is accessible
        // 4. Returns connection status and device info
        
        // For now, simulate based on IP format
        const responseTime = Math.floor(Math.random() * 100) + 50;
        
        // Simulate 80% success rate for demonstration
        const isSuccess = Math.random() > 0.2;
        
        if (isSuccess) {
          resolve({
            success: true,
            responseTime: responseTime,
            deviceInfo: {
              model: 'ZKTeco F18',
              firmware: '6.5.0'
            }
          });
        } else {
          resolve({
            success: false,
            error: 'Device not responding or unreachable'
          });
        }
      }, 1500);
    });
  }

  /**
   * Register new device
   */
  async registerDevice() {
    try {
      const form = document.getElementById('addDeviceForm');
      const formData = new FormData(form);
      
      const deviceData = {
        deviceId: document.getElementById('deviceId').value.trim(),
        deviceName: document.getElementById('deviceName').value.trim(),
        deviceType: document.getElementById('deviceType').value,
        serialNumber: document.getElementById('serialNumber').value.trim(),
        ipAddress: document.getElementById('ipAddress').value.trim(),
        username: document.getElementById('deviceUsername').value.trim(),
        password: document.getElementById('devicePassword').value.trim(),
        status: document.getElementById('deviceStatus').value || 'Active',
        registeredAt: new Date().toISOString(),
        registeredBy: 'admin'
      };

      // Validate required fields
      if (!deviceData.deviceId || !deviceData.deviceName || !deviceData.deviceType || !deviceData.ipAddress) {
        showNotification('Please fill in all required fields', 'error');
        return;
      }

      // Validate IP address format
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(deviceData.ipAddress)) {
        showNotification('Please enter a valid IP address', 'error');
        return;
      }

      showLoader();

      // Check if device ID already exists
      const deviceRef = doc(db, "devices", deviceData.deviceId);
      const existingDevice = await getDoc(deviceRef);
      
      if (existingDevice.exists()) {
        hideLoader();
        showNotification('Device ID already exists', 'error');
        return;
      }

      // Add device to global devices collection
      await setDoc(deviceRef, deviceData);

      hideLoader();
      showNotification('Device registered successfully!', 'success');
      
      this.closeAddDeviceModal();
      await this.loadDevices();

    } catch (error) {
      hideLoader();
      console.error('Error registering device:', error);
      showNotification('Error registering device: ' + error.message, 'error');
    }
  }

  /**
   * Check if device ID already exists (deprecated - now using direct check)
   */
  async checkDeviceExists(deviceId) {
    try {
      const deviceRef = doc(db, "devices", deviceId);
      const deviceDoc = await getDoc(deviceRef);
      return deviceDoc.exists() ? deviceDoc.data() : null;
    } catch (error) {
      console.error('Error checking device existence:', error);
      return null;
    }
  }
  /**
   * Show hard reset business modal
   */
  showHardResetModal() {
    if (this.businesses.length === 0) {
      showNotification('No businesses found. Load businesses first.', 'error');
      return;
    }

    const businessOptions = this.businesses.map(business => 
      `<option value="${business.id}">${business.businessName} (${business.id})</option>`
    ).join('');

    const modalHTML = `
      <div class="modal-overlay" id="hardResetModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>🔄 Hard Reset Business Data</h3>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
          </div>
          <div class="modal-body" style="padding: 1.5rem;">
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 1rem; margin-bottom: 1rem;">
              <h4 style="color: #856404; margin: 0 0 0.5rem 0;">⚠️ Warning</h4>
              <p style="color: #856404; margin: 0; font-size: 0.9rem;">
                This will completely delete ALL business data including employees, attendance records, and timecards. 
                It will then recreate clean slot structure. This action cannot be undone!
              </p>
            </div>
            
            <div class="form-group">
              <label for="resetBusinessId">Select Business to Reset:</label>
              <select id="resetBusinessId" class="form-control" required>
                <option value="">Choose a business...</option>
                ${businessOptions}
              </select>
            </div>
            
            <div class="form-group">
              <label for="resetAdminKey">Admin Reset Key:</label>
              <input type="password" id="resetAdminKey" class="form-control" 
                     placeholder="Enter admin reset key" required>
              <small style="color: #666; font-size: 0.8rem;">Contact admin for the reset key</small>
            </div>
            
            <div class="form-group">
              <label>
                <input type="checkbox" id="resetConfirmation" required>
                I understand this will permanently delete all business data
              </label>
            </div>
          </div>
          <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; display: flex; gap: 1rem; justify-content: flex-end;">
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
              Cancel
            </button>
            <button class="btn" style="background: #dc3545; color: white;" onclick="adminDashboard.executeHardReset()">
              🔄 Execute Hard Reset
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  /**
   * Execute hard reset of business data
   */
  async executeHardReset() {
    const businessId = document.getElementById('resetBusinessId')?.value;
    const adminKey = document.getElementById('resetAdminKey')?.value;
    const confirmed = document.getElementById('resetConfirmation')?.checked;

    if (!businessId || !adminKey || !confirmed) {
      showNotification('Please fill all fields and confirm the action', 'error');
      return;
    }

    try {
      showLoader('Executing hard reset... This may take a moment');

      const response = await fetch('https://us-central1-aiclock-82608.cloudfunctions.net/hardResetBusinessData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId,
          adminKey
        })
      });

      const result = await response.json();
      hideLoader();

      if (result.success) {
        showNotification(`Hard reset completed successfully for ${businessId}! 
                         ${result.summary.slotsRecreated} slots recreated, 
                         ${result.summary.documentsDeleted} documents deleted.`, 'success');
        
        // Close modal
        document.getElementById('hardResetModal')?.remove();
        
        // Refresh the businesses list
        await this.loadBusinesses();
      } else {
        showNotification(`Hard reset failed: ${result.error || result.message}`, 'error');
      }

    } catch (error) {
      hideLoader();
      console.error('Hard reset error:', error);
      showNotification(`Hard reset failed: ${error.message}`, 'error');
    }
  }

  // ===== Admin Tools Methods =====

  /**
   * Open Restore Employee Status Modal
   */
  openRestoreEmployeeModal() {
    console.log('openRestoreEmployeeModal called');
    const modal = document.getElementById('restoreEmployeeModal');
    console.log('Modal element:', modal);
    if (modal) {
      modal.style.display = 'flex';
      //Pre-fill with srcomponents if empty
      const businessIdInput = document.getElementById('restoreBusinessId');
      if (businessIdInput && !businessIdInput.value) {
        businessIdInput.value = 'srcomponents';
      }
      // Hide results
      document.getElementById('restoreResults').style.display = 'none';
    }
  }

  /**
   * Close Restore Employee Status Modal
   */
  closeRestoreEmployeeModal() {
    const modal = document.getElementById('restoreEmployeeModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Restore Employee Status
   */
  async restoreEmployeeStatus() {
    const businessId = document.getElementById('restoreBusinessId')?.value?.trim();

    if (!businessId) {
      showNotification('Please enter a business ID', 'error');
      return;
    }

    try {
      showLoader('Restoring employee status...');

      const businessRef = doc(db, 'businesses', businessId);
      const businessSnap = await getDoc(businessRef);

      if (!businessSnap.exists()) {
        hideLoader();
        showNotification(`Business ${businessId} not found`, 'error');
        return;
      }

      // Try 'staff', 'slots', and 'employees' collections
      let slotsSnap = await getDocs(collection(db, 'businesses', businessId, 'staff'));
      let collectionName = 'staff';

      if (slotsSnap.size === 0) {
        slotsSnap = await getDocs(collection(db, 'businesses', businessId, 'slots'));
        collectionName = 'slots';
      }

      if (slotsSnap.size === 0) {
        slotsSnap = await getDocs(collection(db, 'businesses', businessId, 'employees'));
        collectionName = 'employees';
      }

      if (slotsSnap.size === 0) {
        hideLoader();
        showNotification(`No employees found in business ${businessId}`, 'error');

        const resultsDiv = document.getElementById('restoreResults');
        const resultsContent = document.getElementById('restoreResultsContent');
        resultsContent.innerHTML = `
          <p style="margin: 0.5rem 0;"><strong>Business:</strong> ${businessId}</p>
          <p style="margin: 0.5rem 0; color: #dc3545;"><strong>Error:</strong> No employees found in 'staff', 'slots', or 'employees' collections</p>
        `;
        resultsDiv.style.display = 'block';
        return;
      }

      let fixed = 0;
      let skipped = 0;
      const now = new Date().toISOString();

      for (const slotDoc of slotsSnap.docs) {
        const slotData = slotDoc.data();

        // Check if lastClockTime is invalid
        if (slotData.lastClockTime) {
          const testDate = new Date(slotData.lastClockTime);
          if (isNaN(testDate.getTime())) {
            // Invalid date - fix it
            await updateDoc(slotDoc.ref, {
              lastClockTime: now,
              clockStatus: 'out'
            });
            fixed++;
          } else {
            skipped++;
          }
        } else {
          // No lastClockTime - set it
          await updateDoc(slotDoc.ref, {
            lastClockTime: now,
            clockStatus: 'out'
          });
          fixed++;
        }
      }

      hideLoader();

      const resultsDiv = document.getElementById('restoreResults');
      const resultsContent = document.getElementById('restoreResultsContent');

      resultsContent.innerHTML = `
        <p style="margin: 0.5rem 0;"><strong>Business:</strong> ${businessId}</p>
        <p style="margin: 0.5rem 0;"><strong>Collection:</strong> ${collectionName}</p>
        <p style="margin: 0.5rem 0;"><strong>Total employees processed:</strong> ${slotsSnap.size}</p>
        <p style="margin: 0.5rem 0; color: #16a34a;"><strong>Fixed:</strong> ${fixed}</p>
        <p style="margin: 0.5rem 0; color: #6b7280;"><strong>Already valid:</strong> ${skipped}</p>
      `;
      resultsDiv.style.display = 'block';

      showNotification(`Successfully restored ${fixed} employee status records`, 'success');

    } catch (error) {
      hideLoader();
      console.error('Restore employee status error:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  }

  /**
   * Open Recalculate Assessment Modal
   */
  openRecalculateModal() {
    const modal = document.getElementById('recalculateAssessmentModal');
    if (modal) {
      modal.style.display = 'flex';
      // Pre-fill with srcomponents and current month
      const businessIdInput = document.getElementById('recalcBusinessId');
      if (businessIdInput && !businessIdInput.value) {
        businessIdInput.value = 'srcomponents';
      }
      const monthInput = document.getElementById('recalcMonth');
      if (monthInput && !monthInput.value) {
        const now = new Date();
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
      // Hide results
      document.getElementById('recalcResults').style.display = 'none';
    }
  }

  /**
   * Close Recalculate Assessment Modal
   */
  closeRecalculateModal() {
    const modal = document.getElementById('recalculateAssessmentModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Recalculate Assessment Cache
   */
  async recalculateAssessment() {
    const businessId = document.getElementById('recalcBusinessId')?.value?.trim();
    const month = document.getElementById('recalcMonth')?.value;

    if (!businessId || !month) {
      showNotification('Please enter business ID and select a month', 'error');
      return;
    }

    try {
      showLoader('Recalculating assessment cache...');

      // Call the cloud function to recalculate
      const response = await fetch('https://us-central1-aiclock-82608.cloudfunctions.net/recalculateAssessmentCache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId,
          month
        })
      });

      const result = await response.json();
      hideLoader();

      if (result.success) {
        const resultsDiv = document.getElementById('recalcResults');
        const resultsContent = document.getElementById('recalcResultsContent');

        resultsContent.innerHTML = `
          <p style="margin: 0.5rem 0;"><strong>Business:</strong> ${businessId}</p>
          <p style="margin: 0.5rem 0;"><strong>Month:</strong> ${month}</p>
          <p style="margin: 0.5rem 0; color: #16a34a;"><strong>Status:</strong> Cache recalculated successfully</p>
          ${result.employeesProcessed ? `<p style="margin: 0.5rem 0;"><strong>Employees processed:</strong> ${result.employeesProcessed}</p>` : ''}
        `;
        resultsDiv.style.display = 'block';

        showNotification('Assessment cache recalculated successfully', 'success');
      } else {
        showNotification(`Recalculation failed: ${result.error || 'Unknown error'}`, 'error');
      }

    } catch (error) {
      hideLoader();
      console.error('Recalculate assessment error:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  }

  /**
   * Open View Shift Config Modal
   */
  openShiftModal() {
    const modal = document.getElementById('viewShiftModal');
    if (modal) {
      modal.style.display = 'flex';
      // Pre-fill with srcomponents
      const businessIdInput = document.getElementById('shiftBusinessId');
      if (businessIdInput && !businessIdInput.value) {
        businessIdInput.value = 'srcomponents';
      }
      // Hide results
      document.getElementById('shiftConfigResults').style.display = 'none';
    }
  }

  /**
   * Close View Shift Config Modal
   */
  closeShiftModal() {
    const modal = document.getElementById('viewShiftModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Load Shift Configuration
   */
  async loadShiftConfig() {
    const businessId = document.getElementById('shiftBusinessId')?.value?.trim();

    if (!businessId) {
      showNotification('Please enter a business ID', 'error');
      return;
    }

    try {
      showLoader('Loading shift configuration...');

      const businessRef = doc(db, 'businesses', businessId);
      const businessSnap = await getDoc(businessRef);

      if (!businessSnap.exists()) {
        hideLoader();
        showNotification(`Business ${businessId} not found`, 'error');
        return;
      }

      const businessData = businessSnap.data();
      const shifts = businessData.shifts || {};

      hideLoader();

      const resultsDiv = document.getElementById('shiftConfigResults');
      const resultsContent = document.getElementById('shiftConfigContent');

      let html = `<h4 style="margin: 1rem 0 0.5rem 0;">Shifts for ${businessId}</h4>`;

      if (Object.keys(shifts).length === 0) {
        html += '<p style="color: #6b7280;">No shifts configured</p>';
      } else {
        Object.entries(shifts).forEach(([shiftId, shift]) => {
          html += `
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 1rem; margin: 1rem 0;">
              <h5 style="margin: 0 0 0.5rem 0; color: #1f2937;">${shift.name || shiftId}</h5>
              <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="padding: 0.5rem; text-align: left; border: 1px solid #e5e7eb;">Day</th>
                    <th style="padding: 0.5rem; text-align: left; border: 1px solid #e5e7eb;">Start</th>
                    <th style="padding: 0.5rem; text-align: left; border: 1px solid #e5e7eb;">End</th>
                    <th style="padding: 0.5rem; text-align: left; border: 1px solid #e5e7eb;">Break (min)</th>
                    <th style="padding: 0.5rem; text-align: left; border: 1px solid #e5e7eb;">Net Hours</th>
                  </tr>
                </thead>
                <tbody>
          `;

          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          days.forEach(day => {
            const schedule = shift.schedule?.[day];
            if (schedule && schedule.isWorkingDay) {
              const breakMin = schedule.breakDuration || shift.defaultBreakDuration || 0;
              const startDate = new Date(`2000-01-01T${schedule.startTime || '00:00'}:00`);
              const endDate = new Date(`2000-01-01T${schedule.endTime || '00:00'}:00`);
              const totalHours = (endDate - startDate) / (1000 * 60 * 60);
              const netHours = Math.max(0, totalHours - (breakMin / 60));

              html += `
                <tr>
                  <td style="padding: 0.5rem; border: 1px solid #e5e7eb; text-transform: capitalize;">${day}</td>
                  <td style="padding: 0.5rem; border: 1px solid #e5e7eb;">${schedule.startTime || 'N/A'}</td>
                  <td style="padding: 0.5rem; border: 1px solid #e5e7eb;">${schedule.endTime || 'N/A'}</td>
                  <td style="padding: 0.5rem; border: 1px solid #e5e7eb;">${breakMin}</td>
                  <td style="padding: 0.5rem; border: 1px solid #e5e7eb; font-weight: 600;">${netHours.toFixed(2)}h</td>
                </tr>
              `;
            }
          });

          html += `
                </tbody>
              </table>
            </div>
          `;
        });
      }

      resultsContent.innerHTML = html;
      resultsDiv.style.display = 'block';

    } catch (error) {
      hideLoader();
      console.error('Load shift config error:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  }

  /**
   * Open Debug Collections Modal
   */
  openDebugModal() {
    const modal = document.getElementById('debugCollectionsModal');
    if (modal) {
      modal.style.display = 'flex';
      // Pre-fill with biz_srcomponents
      const businessIdInput = document.getElementById('debugBusinessId');
      if (businessIdInput && !businessIdInput.value) {
        businessIdInput.value = 'biz_srcomponents';
      }
      // Hide results
      document.getElementById('debugResults').style.display = 'none';
    }
  }

  /**
   * Close Debug Collections Modal
   */
  closeDebugModal() {
    const modal = document.getElementById('debugCollectionsModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Load Debug Collections
   */
  async loadDebugCollections() {
    const businessId = document.getElementById('debugBusinessId')?.value?.trim();

    if (!businessId) {
      showNotification('Please enter a business ID', 'error');
      return;
    }

    try {
      showLoader('Loading collections...');

      // Try common collection names
      const collectionsToCheck = [
        'staff',
        'slots',
        'employees',
        'attendance_events',
        'assessment_cache',
        'shifts',
        'devices'
      ];

      let html = `<h4 style="margin: 1rem 0 0.5rem 0;">Collections for ${businessId}</h4>`;
      html += '<div style="background: #f9fafb; padding: 1rem; border-radius: 6px;">';

      for (const collectionName of collectionsToCheck) {
        try {
          const collectionRef = collection(db, 'businesses', businessId, collectionName);
          const snapshot = await getDocs(collectionRef);

          if (snapshot.size > 0) {
            html += `
              <div style="margin: 0.5rem 0; padding: 0.75rem; background: white; border-left: 4px solid #16a34a; border-radius: 4px;">
                <strong style="color: #16a34a;">${collectionName}</strong>
                <span style="color: #6b7280; margin-left: 0.5rem;">(${snapshot.size} documents)</span>
                <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #374151;">
                  Sample document IDs: ${snapshot.docs.slice(0, 3).map(d => d.id).join(', ')}
                </div>
              </div>
            `;
          } else {
            html += `
              <div style="margin: 0.5rem 0; padding: 0.75rem; background: white; border-left: 4px solid #9ca3af; border-radius: 4px;">
                <strong style="color: #6b7280;">${collectionName}</strong>
                <span style="color: #9ca3af; margin-left: 0.5rem;">(empty)</span>
              </div>
            `;
          }
        } catch (err) {
          html += `
            <div style="margin: 0.5rem 0; padding: 0.75rem; background: white; border-left: 4px solid #dc3545; border-radius: 4px;">
              <strong style="color: #dc3545;">${collectionName}</strong>
              <span style="color: #dc3545; margin-left: 0.5rem;">(error: ${err.message})</span>
            </div>
          `;
        }
      }

      html += '</div>';

      hideLoader();

      const resultsDiv = document.getElementById('debugResults');
      const resultsContent = document.getElementById('debugContent');

      resultsContent.innerHTML = html;
      resultsDiv.style.display = 'block';

    } catch (error) {
      hideLoader();
      console.error('Load debug collections error:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  }

  /**
   * Load businesses into permissions selector
   */
  loadBusinessesForPermissions() {
    const selector = document.getElementById('businessSelector');
    if (!selector) {
      console.warn('Business selector not found');
      return;
    }
    
    selector.innerHTML = '<option value="">-- Select a Business --</option>';
    
    if (this.businesses.length === 0) {
      selector.innerHTML += '<option value="" disabled>No businesses available</option>';
      return;
    }
    
    this.businesses.forEach(biz => {
      const option = document.createElement('option');
      option.value = biz.id;
      option.textContent = `${biz.businessName || biz.id} (${biz.id})`;
      selector.appendChild(option);
    });
    
    console.log(`Loaded ${this.businesses.length} businesses into permissions selector`);
  }
}

// Initialize and export
let adminDashboard;
let initializationInProgress = false;

export function initAdminDashboard() {
  // Prevent multiple initializations
  if (adminDashboard) {
    console.warn('Admin dashboard instance already exists, returning existing instance...');
    return adminDashboard;
  }

  if (initializationInProgress) {
    console.warn('Admin dashboard initialization already in progress, skipping...');
    return null;
  }

  try {
    initializationInProgress = true;
    console.log('Creating new AdminDashboardController...');
    adminDashboard = new AdminDashboardController();
    window.adminDashboard = adminDashboard; // Make available globally for onclick handlers
    return adminDashboard;
  } catch (error) {
    console.error('Failed to create AdminDashboardController:', error);
    adminDashboard = null;
    throw error;
  } finally {
    initializationInProgress = false;
  }
}

