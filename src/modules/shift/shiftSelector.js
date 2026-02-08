// Shift Selector Component
// Reusable component for selecting shifts in forms

import { db } from "../../config/firebase.js";
import authService from "../auth/auth.service.js";

/**
 * Shift Selector Component
 * Provides a dropdown selector for shifts with preview functionality
 */
class ShiftSelector {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.businessId = authService.getBusinessId();
    this.shifts = [];
    this.selectedShiftId = options.selectedShiftId || null;
    this.onChange = options.onChange || (() => {});
    this.allowNone = options.allowNone !== false; // Default true
    this.init();
  }

  /**
   * Initialize the shift selector
   */
  async init() {
    await this.loadShifts();
    this.render();
    this.attachEventListeners();
  }

  /**
   * Load available shifts from backend
   */
  async loadShifts() {
    try {
      const response = await fetch(
        `https://us-central1-aiclock-82608.cloudfunctions.net/getShifts?businessId=${this.businessId}`
      );

      const result = await response.json();

      if (result.success) {
        this.shifts = result.shifts || [];
      } else {
        console.error("Failed to load shifts:", result.error);
        this.shifts = [];
      }

    } catch (error) {
      console.error("Error loading shifts:", error);
      this.shifts = [];
    }
  }

  /**
   * Render the shift selector
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container #${this.containerId} not found`);
      return;
    }

    const html = `
      <div class="shift-selector-wrapper">
        <select id="${this.containerId}_select" class="form-control shift-selector">
          ${this.allowNone ? '<option value="">Use Business Default Schedule</option>' : ''}
          ${this.shifts.map(shift => `
            <option value="${shift.shiftId}" ${shift.shiftId === this.selectedShiftId ? 'selected' : ''}>
              ${shift.shiftName}${shift.isDefault ? ' (Default)' : ''}
            </option>
          `).join('')}
        </select>
        <div id="${this.containerId}_preview" class="shift-preview-tooltip" style="display: none;"></div>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const select = document.getElementById(`${this.containerId}_select`);
    if (!select) return;

    // Change event
    select.addEventListener('change', (e) => {
      this.selectedShiftId = e.target.value;
      this.onChange(this.selectedShiftId);
    });

    // Hover to show preview (optional feature)
    select.addEventListener('mouseenter', () => {
      if (this.selectedShiftId) {
        this.showPreview(this.selectedShiftId);
      }
    });

    select.addEventListener('mouseleave', () => {
      this.hidePreview();
    });
  }

  /**
   * Show shift preview on hover
   */
  showPreview(shiftId) {
    const shift = this.shifts.find(s => s.shiftId === shiftId);
    if (!shift) return;

    const preview = document.getElementById(`${this.containerId}_preview`);
    if (!preview) return;

    preview.innerHTML = this.renderShiftPreview(shift);
    preview.style.display = 'block';
  }

  /**
   * Hide shift preview
   */
  hidePreview() {
    const preview = document.getElementById(`${this.containerId}_preview`);
    if (preview) {
      preview.style.display = 'none';
    }
  }

  /**
   * Render shift preview HTML
   */
  renderShiftPreview(shift) {
    const enabledDays = this.getEnabledDaysText(shift.schedule);

    return `
      <div class="shift-preview-card">
        <div class="shift-preview-header">
          <strong>${shift.shiftName}</strong>
          ${shift.isDefault ? '<span class="badge badge-default">Default</span>' : ''}
        </div>
        <div class="shift-preview-body">
          <p>${shift.description || 'No description'}</p>
          <div class="shift-preview-details">
            <div><strong>Days:</strong> ${enabledDays}</div>
            <div><strong>Break:</strong> ${shift.defaultBreakDuration} min</div>
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
   * Get currently selected shift ID
   */
  getValue() {
    return this.selectedShiftId;
  }

  /**
   * Get currently selected shift object
   */
  getSelectedShift() {
    if (!this.selectedShiftId) return null;
    return this.shifts.find(s => s.shiftId === this.selectedShiftId);
  }

  /**
   * Set selected shift
   */
  setValue(shiftId) {
    this.selectedShiftId = shiftId;
    const select = document.getElementById(`${this.containerId}_select`);
    if (select) {
      select.value = shiftId || '';
    }
  }

  /**
   * Reload shifts (useful after creating/updating shifts)
   */
  async reload() {
    await this.loadShifts();
    this.render();
    this.attachEventListeners();
  }

  /**
   * Get shift name by ID (for display purposes)
   */
  getShiftName(shiftId) {
    if (!shiftId) return null;
    const shift = this.shifts.find(s => s.shiftId === shiftId);
    return shift ? shift.shiftName : null;
  }
}

// Helper function to create a shift selector easily
export function createShiftSelector(containerId, options = {}) {
  return new ShiftSelector(containerId, options);
}

export default ShiftSelector;
