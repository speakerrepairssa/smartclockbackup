// Authentication Service Module
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "../../config/firebase.js";

/**
 * Authentication Service
 * Handles all authentication operations
 */
class AuthService {
  constructor() {
    this.currentUser = null;
    this.userRole = null;
  }

  /**
   * Admin Owner Login
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>} User data with role
   */
  async adminLogin(email, password) {
    try {
      // Check if this is the admin owner
      const adminEmail = "info@simplewebhost.co.za";
      const adminPassword = "Azam198419880001#";
      
      if (email !== adminEmail) {
        throw new Error("Unauthorized: Admin access only");
      }

      if (password !== adminPassword) {
        throw new Error("Invalid password");
      }

      // Set role
      this.currentUser = {
        uid: "admin_owner",
        email: adminEmail
      };
      this.userRole = "admin";

      // Store in session
      sessionStorage.setItem("userRole", "admin");
      sessionStorage.setItem("userId", "admin_owner");
      sessionStorage.setItem("userEmail", adminEmail);

      return {
        user: this.currentUser,
        role: "admin",
        email: adminEmail
      };
    } catch (error) {
      console.error("Admin login error:", error);
      throw new Error(error.message || "Login failed");
    }
  }

  /**
   * Business User Login
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>} Business user data
   */
  async businessLogin(email, password) {
    try {
      console.log("Starting business login for:", email);
      
      // Query Firestore for business account
      const businessesRef = collection(db, "businesses");
      console.log("Businesses collection reference created");
      
      const q = query(businessesRef, where("email", "==", email));
      console.log("Query created");
      
      const querySnapshot = await getDocs(q);
      console.log("Query executed, found documents:", querySnapshot.size);

      if (querySnapshot.empty) {
        throw new Error("Business account not found");
      }

      const businessDoc = querySnapshot.docs[0];
      const businessData = businessDoc.data();

      // Verify password (in production, use Firebase Auth)
      if (businessData.password !== password) {
        throw new Error("Invalid password");
      }

      // Check if business is active
      if (businessData.status !== "active") {
        throw new Error("Business account is not active");
      }

      // Set user data
      this.currentUser = {
        uid: businessDoc.id,
        email: businessData.email,
        businessName: businessData.businessName
      };
      this.userRole = "business";

      // Store in session
      sessionStorage.setItem("userRole", "business");
      sessionStorage.setItem("businessId", businessDoc.id);
      sessionStorage.setItem("businessName", businessData.businessName);

      return {
        businessId: businessDoc.id,
        businessName: businessData.businessName,
        email: businessData.email,
        plan: businessData.plan,
        slotsAllowed: businessData.slotsAllowed,
        role: "business"
      };
    } catch (error) {
      console.error("Business login error:", error);
      throw new Error(this.getErrorMessage(error.code) || error.message);
    }
  }

  /**
   * Register New Business
   * @param {Object} businessData 
   * @returns {Promise<string>} Business ID
   */
  async registerBusiness(businessData) {
    try {
      const { businessName, email, password, deviceId } = businessData;
      console.log("Starting business registration:", { businessName, email });

      // Check if business already exists
      const businessesRef = collection(db, "businesses");
      const q = query(businessesRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        throw new Error("Business with this email already exists");
      }

      // Generate business ID
      const businessId = `biz_${businessName.toLowerCase().replace(/\s+/g, '_')}`;
      console.log("Generated business ID:", businessId);

      // Create business document
      const businessRef = doc(db, "businesses", businessId);
      await setDoc(businessRef, {
        businessName,
        email,
        password, // In production, hash this
        deviceId: deviceId || "",
        plan: "Basic",
        slotsAllowed: 6, // Default to 6 slots
        monthlyFee: 29.99,
        status: "active",
        approved: false, // Needs admin approval
        apiEnabled: false, // Admin enables after device setup
        breakDuration: 60, // Default 1 hour break
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log("Business document created");

      // Initialize business slots and collections
      await this.initializeBusinessSlots(businessId, 6);
      console.log("Business slots initialized");

      return businessId;
    } catch (error) {
      console.error("Business registration error:", error);
      throw new Error(error.message);
    }
  }

  /**
   * Initialize empty slots and all collections for a business
   * @param {string} businessId 
   * @param {number} slotsAllowed 
   */
  async initializeBusinessSlots(businessId, slotsAllowed) {
    try {
      console.log("Initializing complete collection structure for:", businessId);
      
      // 1. Create Staff Collection with numbered slots
      const staffRef = collection(db, "businesses", businessId, "staff");
      for (let i = 1; i <= slotsAllowed; i++) {
        const slotRef = doc(staffRef, i.toString());
        await setDoc(slotRef, {
          employeeId: i.toString(),
          employeeName: `Employee ${i}`,
          badgeNumber: i.toString(),
          slotNumber: i,
          isActive: false,
          deviceId: "", // Blank - admin will set manually
          assignedAt: null,
          createdAt: new Date().toISOString()
        });
      }
      
      // 2. Create Status Collection with numbered slots
      const statusRef = collection(db, "businesses", businessId, "status");
      for (let i = 1; i <= slotsAllowed; i++) {
        const statusSlotRef = doc(statusRef, i.toString());
        await setDoc(statusSlotRef, {
          employeeId: i.toString(),
          employeeName: `Employee ${i}`,
          currentStatus: "out",
          lastUpdate: new Date().toISOString(),
          isActive: false,
          slotNumber: i,
          deviceId: "" // Blank - admin will set manually
        });
      }
      
      // 3. Create Employee Last Attendance Collection with numbered slots
      const lastAttendanceRef = collection(db, "businesses", businessId, "employee_last_attendance");
      for (let i = 1; i <= slotsAllowed; i++) {
        const lastAttendanceSlotRef = doc(lastAttendanceRef, i.toString());
        await setDoc(lastAttendanceSlotRef, {
          employeeId: i.toString(),
          employeeName: `Employee ${i}`,
          lastClockIn: null,
          lastClockOut: null,
          currentStatus: "out",
          lastUpdate: new Date().toISOString(),
          deviceId: "" // Blank - admin will set manually
        });
      }
      
      console.log(`✅ Created complete collection structure for ${businessId} with ${slotsAllowed} slots`);
      console.log("📋 Collections created: staff, status, employee_last_attendance");
      console.log("🔧 Device fields left blank for manual admin assignment");
      
    } catch (error) {
      console.error("Error initializing business collections:", error);
      throw error;
    }
  }

      console.log(`Successfully initialized ${slotsAllowed} slots for ${businessId}`);
    } catch (error) {
      console.error("Error initializing slots:", error);
      throw error;
    }
  }

  /**
   * Sync staff slots when admin changes slotsAllowed
   * @param {string} businessId 
   * @param {number} newSlotsAllowed 
   */
  async syncBusinessSlots(businessId, newSlotsAllowed) {
    try {
      console.log(`🔄 Syncing slots for ${businessId}: ${newSlotsAllowed} slots`);
      const staffRef = collection(db, "businesses", businessId, "staff");
      
      // Get current slots
      const currentSlots = await getDocs(staffRef);
      const currentSlotCount = currentSlots.size;
      
      console.log(`Current slots: ${currentSlotCount}, New slots: ${newSlotsAllowed}`);

      if (newSlotsAllowed > currentSlotCount) {
        // Add new slots
        for (let i = currentSlotCount + 1; i <= newSlotsAllowed; i++) {
          const slotRef = doc(staffRef, i.toString());
          await setDoc(slotRef, {
            employeeId: i.toString(),
            employeeName: `Employee ${i}`,
            badgeNumber: i.toString(),
            deviceId: i.toString(),
            slot: i,
            active: false,
            assignedAt: null,
            createdAt: new Date().toISOString(),
            status: "empty"
          });
        }
        console.log(`✅ Added ${newSlotsAllowed - currentSlotCount} new slots`);
        
      } else if (newSlotsAllowed < currentSlotCount) {
        // Remove excess slots (only if they're empty/inactive)
        for (let i = currentSlotCount; i > newSlotsAllowed; i--) {
          const slotDoc = currentSlots.docs.find(doc => doc.id === i.toString());
          if (slotDoc) {
            const slotData = slotDoc.data();
            // Only remove if slot is not active (no employee assigned)
            if (!slotData.active && (!slotData.employeeName || slotData.employeeName.startsWith('Employee '))) {
              await deleteDoc(doc(staffRef, i.toString()));
              console.log(`🗑️ Removed empty slot ${i}`);
            } else {
              console.log(`⚠️ Keeping slot ${i} - has active employee: ${slotData.employeeName}`);
            }
          }
        }
      }

      console.log(`✅ Successfully synced slots for ${businessId}`);
    } catch (error) {
      console.error("❌ Error syncing slots:", error);
      throw error;
    }
  }

  /**
   * Logout current user
   */
  async logout() {
    try {
      this.currentUser = null;
      this.userRole = null;
      sessionStorage.clear();
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    const role = sessionStorage.getItem("userRole");
    return role !== null;
  }

  /**
   * Get current user role
   * @returns {string|null}
   */
  getUserRole() {
    return sessionStorage.getItem("userRole");
  }

  /**
   * Get business ID (for business users)
   * @returns {string|null}
   */
  getBusinessId() {
    return sessionStorage.getItem("businessId");
  }

  /**
   * Get user-friendly error messages
   * @param {string} errorCode 
   * @returns {string}
   */
  getErrorMessage(errorCode) {
    const errorMessages = {
      "invalid-email": "Invalid email address",
      "user-disabled": "This account has been disabled",
      "user-not-found": "No account found with this email",
      "wrong-password": "Incorrect password",
      "email-already-in-use": "Email already in use",
      "weak-password": "Password should be at least 6 characters",
      "network-request-failed": "Network error. Please check your connection"
    };

    return errorMessages[errorCode] || "An error occurred. Please try again.";
  }
}

// Export singleton instance
export default new AuthService();
