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
   * Employee Login
   * @param {string} businessId
   * @param {string} username - Employee username or badge number
   * @param {string} password
   * @returns {Promise<Object>} Employee data with role
   */
  async employeeLogin(businessId, username, password) {
    try {
      console.log("Starting employee login for username:", username, "in business:", businessId);
      
      // Check if business exists
      const businessRef = doc(db, "businesses", businessId);
      const businessSnap = await getDoc(businessRef);
      
      if (!businessSnap.exists()) {
        throw new Error("Invalid Business ID. Please check your credentials.");
      }

      // Find employee in staff collection by username or badgeNumber
      const staffRef = collection(db, "businesses", businessId, "staff");
      const staffSnapshot = await getDocs(staffRef);

      let employeeSlot = null;
      let employeeData = null;

      // Search through staff slots for matching username or badgeNumber
      staffSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.username === username || data.badgeNumber === username || data.employeeId === username) {
          employeeSlot = doc.id;
          employeeData = data;
        }
      });

      if (!employeeData) {
        throw new Error("Invalid username. Please check your credentials.");
      }

      // Verify password (check if password field exists on employee record)
      if (!employeeData.password) {
        throw new Error("Account not configured. Please contact your administrator.");
      }

      if (employeeData.password !== password) {
        throw new Error("Invalid password. Please try again.");
      }

      // Check if employee is active
      if (employeeData.active === false || employeeData.status === "inactive") {
        throw new Error("Your account is not active. Please contact your administrator.");
      }

      // Set user data
      this.currentUser = {
        uid: employeeSlot,
        username: employeeData.username || employeeData.badgeNumber,
        name: employeeData.employeeName,
        businessId: businessId
      };
      this.userRole = "employee";

      // Store in session
      sessionStorage.setItem("userRole", "employee");
      sessionStorage.setItem("employeeId", employeeSlot);
      sessionStorage.setItem("businessId", businessId);
      sessionStorage.setItem("employeeUsername", employeeData.username || employeeData.badgeNumber);
      sessionStorage.setItem("employeeName", employeeData.employeeName);
      sessionStorage.setItem("employeeEmail", employeeData.email || "");

      return {
        employeeId: employeeSlot,
        username: employeeData.username || employeeData.badgeNumber,
        name: employeeData.employeeName,
        email: employeeData.email,
        businessId: businessId,
        role: "employee"
      };
    } catch (error) {
      console.error("Employee login error:", error);
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
      const { businessName, email, contactNumber, address, password, deviceId } = businessData;
      console.log("Starting business registration:", { businessName, email, contactNumber, address });

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

      // Default modules access for new registrations
      const defaultModulesAccess = {
        dashboard: true,
        employees: true,
        monitor: true,
        assessment: true,
        shifts: true,
        timecards: true,
        punches: true,
        whatsapp: true,
        // Disabled by default
        reports: false,
        payroll: false,
        settings: false,
        devices: false,
        credentials: false,
        locationTracking: false
      };

      // Create business document
      const businessRef = doc(db, "businesses", businessId);
      await setDoc(businessRef, {
        businessName,
        email,
        contactNumber,
        address,
        password, // In production, hash this
        deviceId: deviceId || "",
        plan: "Free Trial",
        slotsAllowed: 10,
        maxEmployees: 10,
        monthlyFee: 0,
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        status: "active",
        approved: true,
        apiEnabled: true,
        breakDuration: 60,
        modulesAccess: defaultModulesAccess,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log("Business document created with 10 employee slots and default module access");

      // Initialize business slots
      await this.initializeBusinessSlots(businessId, 10);
      console.log("Business slots initialized");

      return businessId;
    } catch (error) {
      console.error("Business registration error:", error);
      throw new Error(error.message);
    }
  }

  /**
   * Initialize empty slots for a business and create all required collections
   * @param {string} businessId 
   * @param {number} slotsAllowed 
   */
  async initializeBusinessSlots(businessId, slotsAllowed) {
    try {
      console.log("Initializing complete business structure for:", businessId);
      
      // 1. Create STAFF collection (Employee Management)
      console.log("Creating staff collection...");
      const staffRef = collection(db, "businesses", businessId, "staff");
      for (let i = 1; i <= slotsAllowed; i++) {
        const slotRef = doc(staffRef, i.toString());
        await setDoc(slotRef, {
          employeeId: i.toString(),
          employeeName: `Employee ${i}`,
          badgeNumber: i.toString(),
          slotNumber: i,
          slot: i,
          active: false,
          isActive: false,
          deviceId: "",
          phone: "",
          email: "",
          position: "",
          payRate: 0,
          hourlyRate: 0,
          assignedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // 2. Create STATUS collection (Real-time Monitoring)
      console.log("Creating status collection...");
      const statusCollectionRef = collection(db, "businesses", businessId, "status");
      for (let i = 1; i <= slotsAllowed; i++) {
        const statusRef = doc(statusCollectionRef, i.toString());
        await setDoc(statusRef, {
          employeeId: i.toString(),
          employeeName: `Employee ${i}`,
          badgeNumber: i.toString(),
          attendanceStatus: "out",
          lastClockStatus: "out",
          lastClockTime: new Date().toISOString(),
          lastEventType: "checkout",
          active: false,
          isActive: false,
          slotNumber: i,
          deviceId: "",
          updatedAt: new Date().toISOString()
        });
      }

      // 3. Create ATTENDANCE_EVENTS collection (Event Storage)
      console.log("Creating attendance_events collection...");
      const attendanceEventsRef = collection(db, "businesses", businessId, "attendance_events");
      const readyMarkerRef = doc(attendanceEventsRef, "_system_ready");
      await setDoc(readyMarkerRef, {
        message: "Attendance events collection ready for business operations",
        businessId: businessId,
        maxEmployees: slotsAllowed,
        createdAt: new Date().toISOString(),
        structure: "unified_attendance_events_v1",
        note: "This placeholder ensures the collection is always visible in Firebase console"
      });

      // 4. Create DEVICES collection (Device Management)
      console.log("Creating devices collection...");
      const devicesRef = collection(db, "businesses", businessId, "devices");
      const placeholderDeviceRef = doc(devicesRef, "_placeholder_device");
      await setDoc(placeholderDeviceRef, {
        deviceId: "_placeholder_device",
        deviceName: "No devices configured yet",
        deviceType: "placeholder",
        status: "inactive",
        isPlaceholder: true,
        note: "Configure your first Hikvision device to replace this placeholder",
        createdAt: new Date().toISOString()
      });

      // 5. Create ASSESSMENT_CACHE collection (Performance Analytics)
      console.log("Creating assessment_cache collection...");
      const assessmentCacheRef = collection(db, "businesses", businessId, "assessment_cache");
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      const cacheRef = doc(assessmentCacheRef, currentMonth);
      await setDoc(cacheRef, {
        summary: {
          totalEmployees: 0,
          totalHoursWorked: 0,
          totalHoursShort: 0,
          totalAmountDue: 0,
          averageAttendance: 0,
          calculatedAt: new Date().toISOString()
        },
        employees: [],
        lastUpdated: new Date().toISOString(),
        calculationVersion: "1.0",
        note: "Assessment cache will populate when employees start clocking in/out"
      });

      // 6. Create ASSESSMENTS_REALTIME collection (Live Data)
      console.log("Creating assessments_realtime collection...");
      const assessmentsRealtimeRef = collection(db, "businesses", businessId, "assessments_realtime");
      const realtimeRef = doc(assessmentsRealtimeRef, currentMonth);
      await setDoc(realtimeRef, {
        summary: {
          total: slotsAllowed,
          present: 0,
          percentage: 0,
          last_calculated: Date.now(),
          status: "ready"
        },
        employees: {},
        lastUpdated: new Date().toISOString(),
        note: "Real-time assessment data will populate automatically"
      });

      // 7. Create SETTINGS collection (Business Configuration)
      console.log("Creating settings collection...");
      const settingsRef = collection(db, "businesses", businessId, "settings");
      const generalSettingsRef = doc(settingsRef, "general");
      await setDoc(generalSettingsRef, {
        businessName: "", // Will be filled from parent business doc
        workStartTime: "08:30",
        workEndTime: "17:30",
        saturdayStartTime: "08:30",
        saturdayEndTime: "14:30",
        breakDuration: 60,
        timezone: "Africa/Johannesburg",
        currency: "R",
        overtimeRate: 1.5,
        createdAt: new Date().toISOString()
      });

      // 8. Create WHATSAPP_TEMPLATES collection (Notifications)
      console.log("Creating whatsapp_templates collection...");
      const whatsappTemplatesRef = collection(db, "businesses", businessId, "whatsapp_templates");
      const clockOutTemplateRef = doc(whatsappTemplatesRef, "clock_out_template");
      await setDoc(clockOutTemplateRef, {
        trigger: "clock-out",
        recipient: "employee",
        active: false,
        message: "Hi {{employeeName}}, you've clocked out. Today's hours: {{hoursWorked}}. Have a great day!",
        createdAt: new Date().toISOString(),
        note: "Configure WhatsApp settings to enable notifications"
      });
      
      console.log(`✅ Created complete business structure with ${slotsAllowed} employee slots for business ${businessId}`);
      console.log("📊 Collections created: staff, status, attendance_events, devices, assessment_cache, assessments_realtime, settings, whatsapp_templates");
    } catch (error) {
      console.error("Error initializing business structure:", error);
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