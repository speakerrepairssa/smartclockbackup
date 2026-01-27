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

      // Verify password
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
      throw new Error(error.message);
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
        slotsAllowed: 6,
        maxEmployees: 6,
        monthlyFee: 29.99,
        status: "active",
        approved: false,
        apiEnabled: false,
        breakDuration: 60,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log("Business document created");

      // Initialize business slots
      await this.initializeBusinessSlots(businessId, 6);
      console.log("Business slots initialized");

      return businessId;
    } catch (error) {
      console.error("Business registration error:", error);
      throw new Error(error.message);
    }
  }

  /**
   * Initialize empty slots for a business
   * @param {string} businessId 
   * @param {number} slotsAllowed 
   */
  async initializeBusinessSlots(businessId, slotsAllowed) {
    try {
      console.log("Initializing slots for:", businessId);
      
      const staffRef = collection(db, "businesses", businessId, "staff");
      for (let i = 1; i <= slotsAllowed; i++) {
        const slotRef = doc(staffRef, i.toString());
        await setDoc(slotRef, {
          employeeId: i.toString(),
          employeeName: `Employee ${i}`,
          badgeNumber: i.toString(),
          slotNumber: i,
          active: false,
          isActive: false,
          deviceId: "",
          assignedAt: null,
          createdAt: new Date().toISOString()
        });

        const statusRef = doc(collection(db, "businesses", businessId, "status"), i.toString());
        await setDoc(statusRef, {
          employeeId: i.toString(),
          employeeName: `Employee ${i}`,
          attendanceStatus: "out",
          lastClockTime: null,
          active: false,
          deviceId: ""
        });
      }
      
      console.log(`Created ${slotsAllowed} slots for business ${businessId}`);
    } catch (error) {
      console.error("Error initializing slots:", error);
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
}

// Export singleton instance
export default new AuthService();