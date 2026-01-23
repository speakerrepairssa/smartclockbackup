// Shared UI Components and Utilities

/**
 * Show notification message
 * @param {string} message 
 * @param {string} type - 'success', 'error', 'info', 'warning'
 */
export function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existing = document.querySelector('.notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Trigger animation
  setTimeout(() => notification.classList.add('show'), 10);

  // Auto remove after 4 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

/**
 * Show loading overlay
 */
export function showLoader() {
  const existing = document.getElementById('loader');
  if (existing) return;

  const loader = document.createElement('div');
  loader.id = 'loader';
  loader.className = 'loader-overlay';
  loader.innerHTML = `
    <div class="loader-spinner"></div>
  `;

  document.body.appendChild(loader);
  setTimeout(() => loader.classList.add('show'), 10);
}

/**
 * Hide loading overlay
 */
export function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.remove('show');
    setTimeout(() => loader.remove(), 300);
  }
}

/**
 * Confirm dialog
 * @param {string} message 
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal confirm-modal">
        <p>${message}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary cancel-btn">Cancel</button>
          <button class="btn confirm-btn">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.cancel-btn').addEventListener('click', () => {
      modal.remove();
      resolve(false);
    });

    modal.querySelector('.confirm-btn').addEventListener('click', () => {
      modal.remove();
      resolve(true);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(false);
      }
    });
  });
}

/**
 * Format date to readable string
 * @param {string|Date} date 
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return 'N/A';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format time to readable string
 * @param {string|Date} time 
 * @returns {string}
 */
export function formatTime(time) {
  if (!time) return 'N/A';
  
  const t = typeof time === 'string' ? new Date(time) : time;
  
  return t.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Debounce function
 * @param {Function} func 
 * @param {number} wait 
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Create table from data
 * @param {Array} data 
 * @param {Array} columns 
 * @returns {string}
 */
export function createTable(data, columns) {
  if (!data || data.length === 0) {
    return '<p>No data available</p>';
  }

  const headers = columns.map(col => `<th>${col.label}</th>`).join('');
  const rows = data.map(row => {
    const cells = columns.map(col => {
      const value = col.format ? col.format(row[col.key]) : row[col.key];
      return `<td>${value}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <table class="data-table">
      <thead>
        <tr>${headers}</tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Validate email format
 * @param {string} email 
 * @returns {boolean}
 */
export function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Generate random ID
 * @param {number} length 
 * @returns {string}
 */
export function generateId(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Check if user is on mobile device
 * @returns {boolean}
 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Copy text to clipboard
 * @param {string} text 
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showNotification('Copied to clipboard', 'success');
  } catch (error) {
    console.error('Copy failed:', error);
    showNotification('Failed to copy', 'error');
  }
}

/**
 * Download data as JSON file
 * @param {Object} data 
 * @param {string} filename 
 */
export function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format currency
 * @param {number} amount 
 * @param {string} currency 
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/**
 * Get time difference in human readable format
 * @param {Date} date 
 * @returns {string}
 */
export function getTimeDifference(date) {
  const now = new Date();
  const diff = now - new Date(date);
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}
