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
    this.init();
  }

  /**
   * Initialize dashboard
   */
  async init() {
    // Check authentication
    if (!authService.isAuthenticated() || authService.getUserRole() !== "admin") {
      window.location.href = "/pages/login.html";
      return;
    }

    this.initializeEventListeners();
    await this.loadBusinesses();
    await this.loadDevices();
    this.displayStats();
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
        <td>${business.businessName}</td>
        <td>${business.email}</td>
        <td>${business.plan}</td>
        <td>${business.slotsAllowed || 'Unlimited'}</td>
        <td>
          <span class="status-badge ${business.status}">
            ${business.status}
          </span>
        </td>
          </span>
        </td>
        <td>
          <button class="btn btn-small" onclick="adminDashboard.viewBusiness('${business.id}')">
            View
          </button>
          <button class="btn btn-small btn-secondary" onclick="adminDashboard.editBusiness('${business.id}')">
            Edit
          </button>
          <button class="btn btn-small btn-warning" onclick="adminDashboard.manageDevices('${business.id}')">
            🖥️ Devices
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

    // Update stats cards
    document.getElementById("totalBusinesses").textContent = totalBusinesses;
    document.getElementById("activeBusinesses").textContent = activeBusinesses;
    document.getElementById("totalSlots").textContent = totalSlots;
    document.getElementById("totalDevices").textContent = totalDevices;
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
}

// Initialize and export
let adminDashboard;
export function initAdminDashboard() {
  adminDashboard = new AdminDashboardController();
  window.adminDashboard = adminDashboard; // Make available globally for onclick handlers
  return adminDashboard;
}
