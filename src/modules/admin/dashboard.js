// Admin Dashboard Module
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
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

      // Get all businesses
      const businessesRef = collection(db, "businesses");
      const businessesSnap = await getDocs(businessesRef);

      // Collect all devices from all businesses
      for (const businessDoc of businessesSnap.docs) {
        const businessId = businessDoc.id;
        const businessData = businessDoc.data();

        // Get devices for this business
        const devicesRef = collection(db, "businesses", businessId, "devices");
        const devicesSnap = await getDocs(devicesRef);

        devicesSnap.forEach((deviceDoc) => {
          allDevices.push({
            id: deviceDoc.id,
            businessId: businessId,
            businessName: businessData.businessName,
            ...deviceDoc.data()
          });
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
        <td>${device.deviceType ? device.deviceType.replace(/_/g, ' ').toUpperCase() : 'N/A'}</td>
        <td>${device.serialNumber || 'N/A'}</td>
        <td>${device.macAddress || 'N/A'}</td>
        <td>${device.businessName}</td>
        <td>
          <span class="status-badge ${device.status}">
            ${device.status}
          </span>
        </td>
        <td>
          <button class="btn btn-small btn-secondary" onclick="adminDashboard.editDevice('${device.businessId}', '${device.id}')">
            Edit
          </button>
          <button class="btn btn-small btn-danger" onclick="adminDashboard.deleteDevice('${device.businessId}', '${device.id}')">
            Delete
          </button>
        </td>
      </tr>
    `).join("");
  }

  /**
   * Edit device
   * @param {string} businessId 
   * @param {string} deviceId 
   */
  async editDevice(businessId, deviceId) {
    const newStatus = prompt("Enter new status (active/inactive/maintenance):");
    if (!newStatus || !['active', 'inactive', 'maintenance'].includes(newStatus)) {
      return;
    }

    try {
      const deviceRef = doc(db, "businesses", businessId, "devices", deviceId);
      await updateDoc(deviceRef, { status: newStatus });
      showNotification("Device status updated", "success");
      await this.loadDevices();
    } catch (error) {
      console.error("Error updating device:", error);
      showNotification("Error updating device", "error");
    }
  }

  /**
   * Delete device
   * @param {string} businessId 
   * @param {string} deviceId 
   */
  async deleteDevice(businessId, deviceId) {
    if (!confirm("Are you sure you want to delete this device?")) {
      return;
    }

    try {
      showLoader();
      const deviceRef = doc(db, "businesses", businessId, "devices", deviceId);
      await deleteDoc(deviceRef);
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
}

// Initialize and export
let adminDashboard;
export function initAdminDashboard() {
  adminDashboard = new AdminDashboardController();
  window.adminDashboard = adminDashboard; // Make available globally for onclick handlers
  return adminDashboard;
}
