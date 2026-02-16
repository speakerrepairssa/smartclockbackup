/**
 * Employee Self-Service Credentials Management Module
 * 
 * Manages employee portal credentials including:
 * - Generating secure passwords
 * - Setting/updating employee usernames and passwords
 * - Sending credentials via WhatsApp
 * - Sending credentials via Email
 * - Managing credential delivery history
 */

import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "../../config/firebase.js";

class EmployeeCredentialsManager {
  constructor() {
    this.businessId = null;
  }

  /**
   * Initialize with business ID
   * @param {string} businessId 
   */
  init(businessId) {
    this.businessId = businessId;
  }

  /**
   * Generate a secure random password
   * @param {number} length - Password length (default: 8)
   * @returns {string} Generated password
   */
  generatePassword(length = 8) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%';
    
    const allChars = uppercase + lowercase + numbers + symbols;
    let password = '';
    
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Generate username from employee name if not exists
   * @param {string} employeeName 
   * @param {string} badgeNumber 
   * @returns {string} Generated username
   */
  generateUsername(employeeName, badgeNumber) {
    if (!employeeName && !badgeNumber) {
      return `emp${Date.now()}`;
    }
    
    if (badgeNumber) {
      return `emp${badgeNumber}`;
    }
    
    // Create username from name
    const nameParts = employeeName.toLowerCase().split(' ');
    return nameParts[0] + (nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) : '');
  }

  /**
   * Set employee credentials (username & password)
   * @param {string} employeeSlot - Staff slot number
   * @param {string} username - Optional custom username
   * @param {string} password - Optional custom password
   * @returns {Promise<Object>} Credentials object
   */
  async setEmployeeCredentials(employeeSlot, username = null, password = null) {
    try {
      if (!this.businessId) {
        throw new Error("Business ID not initialized");
      }

      // Get employee data
      const employeeRef = doc(db, "businesses", this.businessId, "staff", employeeSlot);
      const employeeSnap = await getDoc(employeeRef);
      
      if (!employeeSnap.exists()) {
        throw new Error("Employee not found");
      }

      const employeeData = employeeSnap.data();
      
      // Generate credentials if not provided
      const finalUsername = username || employeeData.username || this.generateUsername(
        employeeData.employeeName, 
        employeeData.badgeNumber
      );
      const finalPassword = password || this.generatePassword();

      // Update employee document with credentials
      await updateDoc(employeeRef, {
        username: finalUsername,
        password: finalPassword, // In production, consider hashing
        credentialsSetAt: serverTimestamp(),
        selfServiceEnabled: true
      });

      console.log("✅ Credentials set for employee:", employeeSlot);

      return {
        success: true,
        employeeSlot,
        username: finalUsername,
        password: finalPassword,
        employeeName: employeeData.employeeName,
        email: employeeData.email,
        phoneNumber: employeeData.phoneNumber
      };
    } catch (error) {
      console.error("❌ Error setting credentials:", error);
      throw error;
    }
  }

  /**
   * Get employee credentials
   * @param {string} employeeSlot 
   * @returns {Promise<Object>} Employee credentials info
   */
  async getEmployeeCredentials(employeeSlot) {
    try {
      if (!this.businessId) {
        throw new Error("Business ID not initialized");
      }

      const employeeRef = doc(db, "businesses", this.businessId, "staff", employeeSlot);
      const employeeSnap = await getDoc(employeeRef);
      
      if (!employeeSnap.exists()) {
        throw new Error("Employee not found");
      }

      const data = employeeSnap.data();
      
      return {
        employeeSlot,
        employeeName: data.employeeName,
        username: data.username || null,
        hasPassword: !!data.password,
        email: data.email || null,
        phoneNumber: data.phoneNumber || null,
        selfServiceEnabled: data.selfServiceEnabled || false,
        credentialsSetAt: data.credentialsSetAt || null
      };
    } catch (error) {
      console.error("❌ Error getting credentials:", error);
      throw error;
    }
  }

  /**
   * Send credentials via WhatsApp
   * @param {string} employeeSlot 
   * @param {Object} credentials 
   * @returns {Promise<Object>}
   */
  async sendCredentialsViaWhatsApp(employeeSlot, credentials) {
    try {
      if (!this.businessId) {
        throw new Error("Business ID not initialized");
      }

      // Get business info
      const businessRef = doc(db, "businesses", this.businessId);
      const businessSnap = await getDoc(businessRef);
      
      if (!businessSnap.exists()) {
        throw new Error("Business not found");
      }

      const businessData = businessSnap.data();

      // Call the isolated Cloud Function
      const response = await fetch('https://employeeselfservice-sendcredentials-4q7htrps4q-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          businessId: this.businessId,
          employeeSlot,
          deliveryMethod: 'whatsapp',
          credentials: {
            username: credentials.username,
            password: credentials.password,
            employeeName: credentials.employeeName,
            phoneNumber: credentials.phoneNumber,
            businessName: businessData.businessName
          }
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to send credentials');
      }

      // Log delivery
      await this.logCredentialDelivery(employeeSlot, 'whatsapp', result);

      return result;
    } catch (error) {
      console.error("❌ Error sending WhatsApp:", error);
      throw error;
    }
  }

  /**
   * Send credentials via Email
   * @param {string} employeeSlot 
   * @param {Object} credentials 
   * @returns {Promise<Object>}
   */
  async sendCredentialsViaEmail(employeeSlot, credentials) {
    try {
      if (!this.businessId) {
        throw new Error("Business ID not initialized");
      }

      // Get business info
      const businessRef = doc(db, "businesses", this.businessId);
      const businessSnap = await getDoc(businessRef);
      
      if (!businessSnap.exists()) {
        throw new Error("Business not found");
      }

      const businessData = businessSnap.data();

      // Call the isolated Cloud Function
      const response = await fetch('https://employeeselfservice-sendcredentials-4q7htrps4q-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          businessId: this.businessId,
          employeeSlot,
          deliveryMethod: 'email',
          credentials: {
            username: credentials.username,
            password: credentials.password,
            employeeName: credentials.employeeName,
            email: credentials.email,
            businessName: businessData.businessName
          }
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to send credentials');
      }

      // Log delivery
      await this.logCredentialDelivery(employeeSlot, 'email', result);

      return result;
    } catch (error) {
      console.error("❌ Error sending email:", error);
      throw error;
    }
  }

  /**
   * Log credential delivery
   * @param {string} employeeSlot 
   * @param {string} method - 'whatsapp' or 'email'
   * @param {Object} result 
   */
  async logCredentialDelivery(employeeSlot, method, result) {
    try {
      const logsRef = collection(db, "businesses", this.businessId, "credential_deliveries");
      
      await addDoc(logsRef, {
        employeeSlot,
        deliveryMethod: method,
        deliveredAt: serverTimestamp(),
        status: result.success ? 'sent' : 'failed',
        result: result
      });

      console.log("✅ Delivery logged:", method, employeeSlot);
    } catch (error) {
      console.error("⚠️ Error logging delivery:", error);
      // Don't throw, this is just logging
    }
  }

  /**
   * Get all employees with credential status
   * @returns {Promise<Array>} List of employees with credential status
   */
  async getAllEmployeesWithCredentials() {
    try {
      if (!this.businessId) {
        throw new Error("Business ID not initialized");
      }

      const staffRef = collection(db, "businesses", this.businessId, "staff");
      const staffSnapshot = await getDocs(staffRef);

      const employees = [];
      staffSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.employeeName) { // Only include active staff
          employees.push({
            slot: doc.id,
            name: data.employeeName,
            badgeNumber: data.badgeNumber,
            username: data.username || null,
            hasPassword: !!data.password,
            email: data.email || null,
            phoneNumber: data.phoneNumber || null,
            selfServiceEnabled: data.selfServiceEnabled || false,
            credentialsSetAt: data.credentialsSetAt || null
          });
        }
      });

      return employees.sort((a, b) => parseInt(a.slot) - parseInt(b.slot));
    } catch (error) {
      console.error("❌ Error getting employees:", error);
      throw error;
    }
  }

  /**
   * Reset employee password
   * @param {string} employeeSlot 
   * @returns {Promise<Object>} New credentials
   */
  async resetEmployeePassword(employeeSlot) {
    try {
      const newPassword = this.generatePassword();
      
      const employeeRef = doc(db, "businesses", this.businessId, "staff", employeeSlot);
      await updateDoc(employeeRef, {
        password: newPassword,
        passwordResetAt: serverTimestamp()
      });

      const employeeSnap = await getDoc(employeeRef);
      const data = employeeSnap.data();

      return {
        success: true,
        employeeSlot,
        username: data.username,
        password: newPassword,
        employeeName: data.employeeName,
        email: data.email,
        phoneNumber: data.phoneNumber
      };
    } catch (error) {
      console.error("❌ Error resetting password:", error);
      throw error;
    }
  }

  /**
   * Generate credentials display card/message
   * @param {Object} credentials 
   * @returns {string} Formatted credentials text
   */
  generateCredentialsText(credentials) {
    return `🔐 Employee Portal Access

Name: ${credentials.employeeName}
Business ID: ${this.businessId}
Username: ${credentials.username}
Password: ${credentials.password}

🌐 Login at: https://aiclock-3e78b.web.app/pages/employee-login.html

⚠️ Keep these credentials secure. You can change your password after logging in.`;
  }
}

// Export singleton instance
const employeeCredentialsManager = new EmployeeCredentialsManager();
export default employeeCredentialsManager;
