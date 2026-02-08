// Shift Management Module
import { db } from "../../config/firebase.js";
import authService from "../auth/auth.service.js";
import { showNotification, showLoader, hideLoader } from "../shared/ui.js";

/**
 * Shift Manager Controller
 * Manages work shifts for the business
 */
class ShiftManagerController {
  constructor() {
    this.businessId = null;
    this.shifts = [];
    this.currentShift = null; // For editing
    this.init();
  }

  /**
   * Initialize shift manager
   */
  async init() {
    // Check authentication
    if (!authService.isAuthenticated() || authService.getUserRole() !== "business") {
      window.location.href = "/pages/login.html";
      return;
    }

    this.businessId = authService.getBusinessId();
    this.initializeEventListeners();
    await this.loadShifts();
  }

  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    // Create new shift button
    const createShiftBtn = document.getElementById("createShiftBtn");
    if (createShiftBtn) {
      createShiftBtn.addEventListener("click", () => this.openCreateShiftModal());
    }

    // Save shift button in modal
    const saveShiftBtn = document.getElementById("saveShiftBtn");
    if (saveShiftBtn) {
      saveShiftBtn.addEventListener("click", () => this.saveShift());
    }

    // Close modal buttons
    const closeModalBtns = document.querySelectorAll(".shift-modal-close, .shift-modal-cancel");
    closeModalBtns.forEach(btn => {
      btn.addEventListener("click", () => this.closeShiftModal());
    });

    // Day toggle listeners (will be set when modal opens)
    this.initializeDayToggles();
  }

  /**
   * Initialize day toggle checkboxes to enable/disable time inputs
   */
  initializeDayToggles() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    days.forEach(day => {
      const toggle = document.getElementById(`${day}Enabled`);
      const startTime = document.getElementById(`${day}StartTime`);
      const endTime = document.getElementById(`${day}EndTime`);
      const breakDuration = document.getElementById(`${day}BreakDuration`);
      const multiplier = document.getElementById(`${day}Multiplier`);

      if (toggle && startTime && endTime && breakDuration && multiplier) {
        toggle.addEventListener("change", (e) => {
          const enabled = e.target.checked;
          startTime.disabled = !enabled;
          endTime.disabled = !enabled;
          breakDuration.disabled = !enabled;
          multiplier.disabled = !enabled;

          // Clear values if disabling
          if (!enabled) {
            startTime.value = "";
            endTime.value = "";
            breakDuration.value = "";
          }
        });
      }
    });
  }

  /**
   * Load all shifts from backend
   */
  async loadShifts() {
    try {
      showLoader();

      const response = await fetch(
        `https://us-central1-aiclock-82608.cloudfunctions.net/getShifts?businessId=${this.businessId}`
      );

      const result = await response.json();

      if (result.success) {
        this.shifts = result.shifts || [];
        this.renderShifts();
      } else {
        throw new Error(result.error || 'Failed to load shifts');
      }

    } catch (error) {
      console.error("Error loading shifts:", error);
      showNotification("Error loading shifts", "error");
    } finally {
      hideLoader();
    }
  }

  /**
   * Render shifts in the UI
   */
  renderShifts() {
    const shiftsContainer = document.getElementById("shiftsContainer");
    if (!shiftsContainer) return;

    if (this.shifts.length === 0) {
      shiftsContainer.innerHTML = `
        <div class="empty-state">
          <h3>No Shifts Created Yet</h3>
          <p>Create your first work shift to assign custom schedules to employees</p>
          <button class="btn btn-primary" onclick="document.getElementById('createShiftBtn').click()">
            Create First Shift
          </button>
        </div>
      `;
      return;
    }

    shiftsContainer.innerHTML = this.shifts.map(shift => this.renderShiftCard(shift)).join('');

    // Add event listeners to action buttons
    this.attachShiftCardListeners();
  }

  /**
   * Render a single shift card
   */
  renderShiftCard(shift) {
    const enabledDays = this.getEnabledDaysText(shift.schedule);
    const defaultBadge = shift.isDefault ? '<span class="badge badge-default">Default</span>' : '';

    return `
      <div class="shift-card" style="border-left: 4px solid ${shift.color}">
        <div class="shift-card-header">
          <h3>${shift.shiftName} ${defaultBadge}</h3>
          <div class="shift-card-actions">
            <button class="btn-icon" data-shift-id="${shift.shiftId}" data-action="edit" title="Edit Shift">
              ✏️
            </button>
            <button class="btn-icon" data-shift-id="${shift.shiftId}" data-action="delete" title="Delete Shift">
              🗑️
            </button>
          </div>
        </div>
        <div class="shift-card-body">
          <p class="shift-description">${shift.description || 'No description'}</p>
          <div class="shift-info">
            <div class="shift-info-item">
              <strong>Working Days:</strong>
              <span>${enabledDays}</span>
            </div>
            <div class="shift-info-item">
              <strong>Break Duration:</strong>
              <span>${shift.defaultBreakDuration} minutes</span>
            </div>
          </div>
          <div class="shift-schedule-preview">
            ${this.renderSchedulePreview(shift.schedule)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get text description of enabled days
   */
  getEnabledDaysText(schedule) {
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const enabledDays = dayOrder.filter(day => schedule[day] && schedule[day].enabled);

    if (enabledDays.length === 0) return 'None';
    if (enabledDays.length === 7) return 'All Days';
    if (enabledDays.length === 5 && enabledDays.includes('monday') && enabledDays.includes('friday')) {
      return 'Mon-Fri';
    }

    return enabledDays.map(day => day.substring(0, 3).toUpperCase()).join(', ');
  }

  /**
   * Render schedule preview
   */
  renderSchedulePreview(schedule) {
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayLabels = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

    const rows = dayOrder.map(day => {
      const daySchedule = schedule[day];
      if (!daySchedule || !daySchedule.enabled) {
        return `<tr><td>${dayLabels[day]}</td><td colspan="3" class="text-muted">Off</td></tr>`;
      }

      return `
        <tr>
          <td>${dayLabels[day]}</td>
          <td>${daySchedule.startTime}</td>
          <td>${daySchedule.endTime}</td>
          <td>${daySchedule.breakDuration || 0}min</td>
        </tr>
      `;
    }).join('');

    return `
      <table class="schedule-preview-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Start</th>
            <th>End</th>
            <th>Break</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  /**
   * Attach event listeners to shift card buttons
   */
  attachShiftCardListeners() {
    document.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const shiftId = e.target.closest('[data-shift-id]').dataset.shiftId;
        this.openEditShiftModal(shiftId);
      });
    });

    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const shiftId = e.target.closest('[data-shift-id]').dataset.shiftId;
        this.deleteShift(shiftId);
      });
    });
  }

  /**
   * Open create shift modal
   */
  openCreateShiftModal() {
    this.currentShift = null;
    this.showShiftModal();
    this.resetShiftForm();
    document.getElementById("shiftModalTitle").textContent = "Create New Shift";
  }

  /**
   * Open edit shift modal
   */
  async openEditShiftModal(shiftId) {
    try {
      showLoader();

      const response = await fetch(
        `https://us-central1-aiclock-82608.cloudfunctions.net/getShift?businessId=${this.businessId}&shiftId=${shiftId}`
      );

      const result = await response.json();

      if (result.success && result.shift) {
        this.currentShift = result.shift;
        this.showShiftModal();
        this.populateShiftForm(result.shift);
        document.getElementById("shiftModalTitle").textContent = "Edit Shift";
      } else {
        throw new Error(result.error || 'Failed to load shift');
      }

    } catch (error) {
      console.error("Error loading shift:", error);
      showNotification("Error loading shift details", "error");
    } finally {
      hideLoader();
    }
  }

  /**
   * Show shift modal
   */
  showShiftModal() {
    const modal = document.getElementById("shiftModal");
    if (modal) {
      modal.style.display = "flex";
    }
  }

  /**
   * Close shift modal
   */
  closeShiftModal() {
    const modal = document.getElementById("shiftModal");
    if (modal) {
      modal.style.display = "none";
    }
    this.resetShiftForm();
  }

  /**
   * Reset shift form to default values
   */
  resetShiftForm() {
    document.getElementById("shiftName").value = "";
    document.getElementById("shiftDescription").value = "";
    document.getElementById("shiftColor").value = "#4CAF50";
    document.getElementById("defaultBreakDuration").value = "60";
    document.getElementById("isDefaultShift").checked = false;

    // Reset all days
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
      document.getElementById(`${day}Enabled`).checked = false;
      document.getElementById(`${day}StartTime`).value = "";
      document.getElementById(`${day}EndTime`).value = "";
      document.getElementById(`${day}BreakDuration`).value = "";
      document.getElementById(`${day}StartTime`).disabled = true;
      document.getElementById(`${day}EndTime`).disabled = true;
      document.getElementById(`${day}BreakDuration`).disabled = true;
    });
  }

  /**
   * Populate form with shift data for edit
   */
  populateShiftForm(shift) {
    document.getElementById("shiftName").value = shift.shiftName || "";
    document.getElementById("shiftDescription").value = shift.description || "";
    document.getElementById("shiftColor").value = shift.color || "#4CAF50";
    document.getElementById("defaultBreakDuration").value = shift.defaultBreakDuration || 60;
    document.getElementById("isDefaultShift").checked = shift.isDefault || false;

    // Populate schedule and multipliers
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dailyMultipliers = shift.dailyMultipliers || {};

    days.forEach(day => {
      const daySchedule = shift.schedule[day];
      const enabled = daySchedule && daySchedule.enabled;

      document.getElementById(`${day}Enabled`).checked = enabled;
      document.getElementById(`${day}StartTime`).disabled = !enabled;
      document.getElementById(`${day}EndTime`).disabled = !enabled;
      document.getElementById(`${day}BreakDuration`).disabled = !enabled;
      document.getElementById(`${day}Multiplier`).disabled = !enabled;

      if (enabled) {
        document.getElementById(`${day}StartTime`).value = daySchedule.startTime || "";
        document.getElementById(`${day}EndTime`).value = daySchedule.endTime || "";
        document.getElementById(`${day}BreakDuration`).value = daySchedule.breakDuration || "";
      }

      // Populate multiplier (always set value, but disabled if day not enabled)
      const multiplier = dailyMultipliers[day] || (day === 'saturday' ? 1.25 : (day === 'sunday' ? 1.5 : 1.0));
      document.getElementById(`${day}Multiplier`).value = multiplier;
    });
  }

  /**
   * Collect shift data from form
   */
  collectShiftData() {
    const shiftData = {
      shiftName: document.getElementById("shiftName").value.trim(),
      description: document.getElementById("shiftDescription").value.trim(),
      color: document.getElementById("shiftColor").value,
      defaultBreakDuration: parseInt(document.getElementById("defaultBreakDuration").value) || 60,
      isDefault: document.getElementById("isDefaultShift").checked,
      schedule: {},
      dailyMultipliers: {}
    };

    // Collect schedule and multipliers for each day
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
      const enabled = document.getElementById(`${day}Enabled`).checked;

      if (enabled) {
        shiftData.schedule[day] = {
          enabled: true,
          startTime: document.getElementById(`${day}StartTime`).value,
          endTime: document.getElementById(`${day}EndTime`).value,
          breakDuration: parseInt(document.getElementById(`${day}BreakDuration`).value) || shiftData.defaultBreakDuration
        };
      } else {
        shiftData.schedule[day] = {
          enabled: false
        };
      }

      // Collect multiplier for this day
      const multiplierInput = document.getElementById(`${day}Multiplier`);
      if (multiplierInput) {
        shiftData.dailyMultipliers[day] = parseFloat(multiplierInput.value) || 1.0;
      }
    });

    return shiftData;
  }

  /**
   * Validate shift data
   */
  validateShiftData(shiftData) {
    if (!shiftData.shiftName) {
      return "Shift name is required";
    }

    // Check if at least one day is enabled
    const hasEnabledDay = Object.values(shiftData.schedule).some(day => day.enabled);
    if (!hasEnabledDay) {
      return "At least one day must be enabled";
    }

    // Validate enabled days
    for (const [day, daySchedule] of Object.entries(shiftData.schedule)) {
      if (daySchedule.enabled) {
        if (!daySchedule.startTime || !daySchedule.endTime) {
          return `${day}: Start and end times are required`;
        }

        // Validate time format
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(daySchedule.startTime)) {
          return `${day}: Invalid start time format (use HH:MM)`;
        }
        if (!timeRegex.test(daySchedule.endTime)) {
          return `${day}: Invalid end time format (use HH:MM)`;
        }
      }
    }

    return null; // Valid
  }

  /**
   * Save shift (create or update)
   */
  async saveShift() {
    try {
      const shiftData = this.collectShiftData();

      // Validate
      const validationError = this.validateShiftData(shiftData);
      if (validationError) {
        showNotification(validationError, "error");
        return;
      }

      showLoader();

      let response;
      if (this.currentShift) {
        // Update existing shift
        response = await fetch(
          `https://us-central1-aiclock-82608.cloudfunctions.net/updateShift`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessId: this.businessId,
              shiftId: this.currentShift.shiftId,
              shiftData: shiftData
            })
          }
        );
      } else {
        // Create new shift
        response = await fetch(
          `https://us-central1-aiclock-82608.cloudfunctions.net/createShift`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessId: this.businessId,
              shiftData: shiftData
            })
          }
        );
      }

      const result = await response.json();

      if (result.success) {
        showNotification(
          this.currentShift ? "Shift updated successfully" : "Shift created successfully",
          "success"
        );
        this.closeShiftModal();
        await this.loadShifts(); // Reload shifts list
      } else {
        if (result.errors && result.errors.length > 0) {
          showNotification(result.errors.join(", "), "error");
        } else {
          throw new Error(result.error || 'Failed to save shift');
        }
      }

    } catch (error) {
      console.error("Error saving shift:", error);
      showNotification("Error saving shift", "error");
    } finally {
      hideLoader();
    }
  }

  /**
   * Delete a shift
   */
  async deleteShift(shiftId) {
    const shift = this.shifts.find(s => s.shiftId === shiftId);
    if (!shift) return;

    if (!confirm(`Are you sure you want to delete shift "${shift.shiftName}"?`)) {
      return;
    }

    try {
      showLoader();

      const response = await fetch(
        `https://us-central1-aiclock-82608.cloudfunctions.net/deleteShift`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: this.businessId,
            shiftId: shiftId
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        showNotification("Shift deleted successfully", "success");
        await this.loadShifts(); // Reload shifts list
      } else {
        if (result.count && result.count > 0) {
          const employeeList = result.employees.map(e => e.employeeName).join(', ');
          showNotification(
            `Cannot delete shift: ${result.count} employee(s) are using it (${employeeList}). Reassign them first.`,
            "error"
          );
        } else {
          throw new Error(result.error || 'Failed to delete shift');
        }
      }

    } catch (error) {
      console.error("Error deleting shift:", error);
      showNotification("Error deleting shift", "error");
    } finally {
      hideLoader();
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new ShiftManagerController();
  });
} else {
  new ShiftManagerController();
}

export default ShiftManagerController;
