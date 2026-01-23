// Shared Utility Functions

/**
 * Storage utilities
 */
export const storage = {
  set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },

  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  clear() {
    localStorage.clear();
  }
};

/**
 * Session storage utilities
 */
export const session = {
  set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      sessionStorage.setItem(key, serialized);
    } catch (error) {
      console.error('Session set error:', error);
    }
  },

  get(key, defaultValue = null) {
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Session get error:', error);
      return defaultValue;
    }
  },

  remove(key) {
    sessionStorage.removeItem(key);
  },

  clear() {
    sessionStorage.clear();
  }
};

/**
 * Deep clone object
 * @param {Object} obj 
 * @returns {Object}
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge objects
 * @param {Object} target 
 * @param {Object} source 
 * @returns {Object}
 */
export function merge(target, source) {
  return Object.assign({}, target, source);
}

/**
 * Group array by key
 * @param {Array} array 
 * @param {string} key 
 * @returns {Object}
 */
export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
}

/**
 * Sort array by key
 * @param {Array} array 
 * @param {string} key 
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array}
 */
export function sortBy(array, key, order = 'asc') {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Filter array by search term
 * @param {Array} array 
 * @param {string} searchTerm 
 * @param {Array} keys 
 * @returns {Array}
 */
export function searchFilter(array, searchTerm, keys) {
  if (!searchTerm) return array;
  
  const term = searchTerm.toLowerCase();
  return array.filter(item => {
    return keys.some(key => {
      const value = item[key];
      return value && value.toString().toLowerCase().includes(term);
    });
  });
}

/**
 * Paginate array
 * @param {Array} array 
 * @param {number} page 
 * @param {number} pageSize 
 * @returns {Object}
 */
export function paginate(array, page = 1, pageSize = 10) {
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  return {
    data: array.slice(startIndex, endIndex),
    page,
    pageSize,
    totalPages: Math.ceil(array.length / pageSize),
    totalItems: array.length,
    hasNext: endIndex < array.length,
    hasPrev: page > 1
  };
}

/**
 * Calculate statistics
 * @param {Array} array 
 * @param {string} key 
 * @returns {Object}
 */
export function calculateStats(array, key) {
  if (!array || array.length === 0) {
    return { sum: 0, avg: 0, min: 0, max: 0, count: 0 };
  }

  const values = array.map(item => Number(item[key]) || 0);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const count = values.length;
  const avg = sum / count;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return { sum, avg, min, max, count };
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn 
 * @param {number} maxRetries 
 * @param {number} delay 
 * @returns {Promise}
 */
export async function retry(fn, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
}

/**
 * Throttle function
 * @param {Function} func 
 * @param {number} limit 
 * @returns {Function}
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Format bytes to human readable
 * @param {number} bytes 
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate URL with query params
 * @param {string} baseUrl 
 * @param {Object} params 
 * @returns {string}
 */
export function buildUrl(baseUrl, params) {
  const url = new URL(baseUrl);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });
  return url.toString();
}

/**
 * Parse query string to object
 * @param {string} queryString 
 * @returns {Object}
 */
export function parseQueryString(queryString) {
  const params = new URLSearchParams(queryString);
  const result = {};
  
  for (const [key, value] of params) {
    result[key] = value;
  }
  
  return result;
}

/**
 * Capitalize first letter
 * @param {string} string 
 * @returns {string}
 */
export function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Truncate string
 * @param {string} string 
 * @param {number} length 
 * @returns {string}
 */
export function truncate(string, length = 50) {
  if (string.length <= length) return string;
  return string.substring(0, length) + '...';
}

/**
 * Check if object is empty
 * @param {Object} obj 
 * @returns {boolean}
 */
export function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

/**
 * Wait for specified time
 * @param {number} ms 
 * @returns {Promise}
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
