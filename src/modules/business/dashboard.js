// Business Dashboard Module
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  where,
  orderBy,
  limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "../../config/firebase.js";
import authService from "../auth/auth.service.js";
import { showNotification, showLoader, hideLoader } from "../shared/ui.js";

/**
 * Business Dashboard Controller
 */
class BusinessDashboardController {
  constructor() {
    this.businessId = null;
    this.businessData = null;
    this.staff = [];
    this.statusData = [];
    this.pollingInterval = null;
    this.init();
  }

  /**
   * Initialize dashboard
   */
  async init() {
    // Check authentication
    if (!authService.isAuthenticated() || authService.getUserRole() !== "business") {
      window.location.href = "login.html";
      return;
    }

    this.businessId = authService.getBusinessId();
    this.initializeEventListeners();
    await this.loadBusinessData();
    await this.loadStaff();
    await this.loadStatus();
    this.startPolling();
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

    // Refresh button
    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.refreshData());
    }

    // View toggle buttons
    const monitorViewBtn = document.getElementById("monitorViewBtn");
    const staffViewBtn = document.getElementById("staffViewBtn");

    if (monitorViewBtn) {
      monitorViewBtn.addEventListener("click", () => this.showMonitorView());
    }
    if (staffViewBtn) {
      staffViewBtn.addEventListener("click", () => this.showStaffView());
    }
  }

  /**
   * Load business data
   */
  async loadBusinessData() {
    try {
      const businessRef = doc(db, "businesses", this.businessId);
      const businessDoc = await getDoc(businessRef);

      if (!businessDoc.exists()) {
        throw new Error("Business not found");
      }

      this.businessData = businessDoc.data();
      this.displayBusinessInfo();

    } catch (error) {
      console.error("Error loading business data:", error);
      showNotification("Error loading business information", "error");
    }
  }

  /**
   * Display business information
   */
  displayBusinessInfo() {
    document.getElementById("businessName").textContent = this.businessData.businessName;
    document.getElementById("planName").textContent = this.businessData.plan;
    document.getElementById("slotsUsed").textContent = 
      `${this.staff.filter(s => s.active).length} / ${this.businessData.slotsAllowed || '∞'}`;
  }

  /**
   * Load staff data
   */
  async loadStaff() {
    try {
      const staffRef = collection(db, "businesses", this.businessId, "staff");
      const querySnapshot = await getDocs(staffRef);

      this.staff = [];
      querySnapshot.forEach((doc) => {
        this.staff.push({
          id: doc.id,
          ...doc.data()
        });
      });

      this.staff.sort((a, b) => a.slot - b.slot);
      this.displayStaff();

    } catch (error) {
      console.error("Error loading staff:", error);
      showNotification("Error loading staff", "error");
    }
  }

  /**
   * Display staff list
   */
  displayStaff() {
    const tbody = document.getElementById("staffTableBody");
    if (!tbody) return;

    if (this.staff.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem;">
            No staff members added yet
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.staff.map(employee => `
      <tr class="${!employee.active ? 'inactive' : ''}">
        <td>${employee.slot}</td>
        <td>${employee.employeeName}</td>
        <td>${employee.badgeNumber}</td>
        <td>
          <span class="status-badge ${employee.active ? 'active' : 'inactive'}">
            ${employee.active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>
          ${employee.active ? `
            <button class="btn btn-small" onclick="businessDashboard.viewEmployee('${employee.id}')">
              View
            </button>
          ` : 'Not assigned yet'}
        </td>
      </tr>
    `).join("");
  }

  /**
   * Load current status of all employees
   */
  async loadStatus() {
    try {
      const statusRef = collection(db, "businesses", this.businessId, "status");
      const querySnapshot = await getDocs(statusRef);

      this.statusData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.active) {
          this.statusData.push({
            id: doc.id,
            ...data
          });
        }
      });

      this.displayMonitor();

    } catch (error) {
      console.error("Error loading status:", error);
    }
  }

  /**
   * Display real-time monitor
   */
  displayMonitor() {
    const monitorGrid = document.getElementById("monitorGrid");
    if (!monitorGrid) return;

    if (this.statusData.length === 0) {
      monitorGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2rem;">
          No active employees. Add employees on the device first.
        </div>
      `;
      return;
    }

    monitorGrid.innerHTML = this.statusData.map(employee => {
      const isIn = employee.attendanceStatus === "in";
      const lastTime = employee.lastClockTime 
        ? new Date(employee.lastClockTime).toLocaleTimeString()
        : "N/A";

      return `
        <div class="monitor-card ${isIn ? 'status-in' : 'status-out'}">
          <div class="monitor-badge">
            <span class="badge-number">${employee.badgeNumber}</span>
          </div>
          <div class="monitor-info">
            <h3>${employee.employeeName}</h3>
            <p class="monitor-status">
              <span class="status-indicator ${isIn ? 'in' : 'out'}"></span>
              ${isIn ? 'IN' : 'OUT'}
            </p>
            <p class="monitor-time">Last: ${lastTime}</p>
          </div>
        </div>
      `;
    }).join("");
  }

  /**
   * Start polling for updates
   */
  startPolling() {
    // Poll every 30 seconds
    this.pollingInterval = setInterval(() => {
      this.loadStatus();
    }, 30000);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Refresh all data
   */
  async refreshData() {
    showLoader();
    await Promise.all([
      this.loadBusinessData(),
      this.loadStaff(),
      this.loadStatus()
    ]);
    hideLoader();
    showNotification("Data refreshed", "success");
  }

  /**
   * Show monitor view
   */
  showMonitorView() {
    document.getElementById("monitorView").style.display = "block";
    document.getElementById("staffView").style.display = "none";
    document.getElementById("monitorViewBtn").classList.add("active");
    document.getElementById("staffViewBtn").classList.remove("active");
  }

  /**
   * Show staff view
   */
  showStaffView() {
    document.getElementById("monitorView").style.display = "none";
    document.getElementById("staffView").style.display = "block";
    document.getElementById("monitorViewBtn").classList.remove("active");
    document.getElementById("staffViewBtn").classList.add("active");
  }

  /**
   * View employee details
   * @param {string} employeeId 
   */
  async viewEmployee(employeeId) {
    try {
      showLoader();

      // Get employee data
      const staffRef = doc(db, "businesses", this.businessId, "staff", employeeId);
      const staffDoc = await getDoc(staffRef);

      if (!staffDoc.exists()) {
        throw new Error("Employee not found");
      }

      const employee = staffDoc.data();

      // Get recent attendance events
      const today = new Date().toISOString().split('T')[0];
      const eventsRef = collection(
        db, 
        "businesses", 
        this.businessId, 
        "attendance_events", 
        today, 
        "events"
      );
      const q = query(
        eventsRef, 
        where("employeeId", "==", employee.employeeId),
        orderBy("timestamp", "desc"),
        limit(10)
      );
      const eventsSnapshot = await getDocs(q);

      const events = [];
      eventsSnapshot.forEach(doc => {
        events.push(doc.data());
      });

      hideLoader();

      // Show modal
      this.showEmployeeModal(employee, events);

    } catch (error) {
      console.error("Error viewing employee:", error);
      showNotification("Error loading employee details", "error");
      hideLoader();
    }
  }

  /**
   * Show employee details modal
   * @param {Object} employee 
   * @param {Array} events 
   */
  showEmployeeModal(employee, events) {
    const eventsHtml = events.length > 0 
      ? events.map(event => `
          <div class="event-item">
            <span>${new Date(event.timestamp).toLocaleString()}</span>
            <span class="event-type ${event.eventType}">${event.eventType}</span>
          </div>
        `).join("")
      : "<p>No recent events</p>";

    const modal = `
      <div class="modal-overlay" onclick="this.remove()">
        <div class="modal" onclick="event.stopPropagation()">
          <h2>${employee.employeeName}</h2>
          <div class="employee-details">
            <p><strong>Badge Number:</strong> ${employee.badgeNumber}</p>
            <p><strong>Employee ID:</strong> ${employee.employeeId}</p>
            <p><strong>Slot:</strong> ${employee.slot}</p>
            <p><strong>Device ID:</strong> ${employee.deviceId}</p>
            <p><strong>Status:</strong> ${employee.active ? 'Active' : 'Inactive'}</p>
            ${employee.assignedAt ? `<p><strong>Assigned:</strong> ${new Date(employee.assignedAt).toLocaleString()}</p>` : ''}
          </div>
          <h3>Recent Events (Today)</h3>
          <div class="events-list">
            ${eventsHtml}
          </div>
          <button class="btn" onclick="this.closest('.modal-overlay').remove()">Close</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modal);
  }

  /**
   * Handle logout
   */
  async handleLogout() {
    this.stopPolling();
    try {
      await authService.logout();
      window.location.href = "login.html";
    } catch (error) {
      console.error("Logout error:", error);
      showNotification("Error logging out", "error");
    }
  }
}

// Initialize and export
let businessDashboard;
export function initBusinessDashboard() {
  businessDashboard = new BusinessDashboardController();
  window.businessDashboard = businessDashboard; // Make available globally
  return businessDashboard;
}
