const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function createMissingCollections() {
  const businessId = "biz_srcomponents";
  const slotsAllowed = 20; // Match biz_machine_2
  
  console.log("Creating missing collections for", businessId);
  
  try {
    // 4. Create DEVICES collection (if missing)
    console.log("Creating devices collection...");
    const devicesRef = db.collection("businesses").doc(businessId).collection("devices");
    await devicesRef.doc("admin").set({
      deviceId: "admin",
      deviceName: "Admin Device",
      deviceType: "hikvision",
      status: "active",
      isPlaceholder: false,
      note: "Main attendance device for SR Components",
      createdAt: new Date().toISOString()
    });

    // 5. Create ASSESSMENT_CACHE collection 
    console.log("Creating assessment_cache collection...");
    const assessmentCacheRef = db.collection("businesses").doc(businessId).collection("assessment_cache");
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    await assessmentCacheRef.doc(currentMonth).set({
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

    // 6. Create ASSESSMENTS_REALTIME collection
    console.log("Creating assessments_realtime collection...");
    const assessmentsRealtimeRef = db.collection("businesses").doc(businessId).collection("assessments_realtime");
    await assessmentsRealtimeRef.doc(currentMonth).set({
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

    // 7. Create SETTINGS collection
    console.log("Creating settings collection...");
    const settingsRef = db.collection("businesses").doc(businessId).collection("settings");
    await settingsRef.doc("general").set({
      businessName: "SR Components",
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

    // 8. Create SHIFTS collection placeholder
    console.log("Creating shifts collection...");
    const shiftsRef = db.collection("businesses").doc(businessId).collection("shifts");
    await shiftsRef.doc("_placeholder").set({
      shiftName: "No shifts configured yet",
      isPlaceholder: true,
      note: "Create shifts in the admin panel",
      createdAt: new Date().toISOString()
    });

    // 9. Create WHATSAPP_TEMPLATES collection
    console.log("Creating whatsapp_templates collection...");
    const whatsappTemplatesRef = db.collection("businesses").doc(businessId).collection("whatsapp_templates");
    await whatsappTemplatesRef.doc("clock_out_template").set({
      trigger: "clock-out",
      recipient: "employee", 
      active: false,
      message: "Hi {{employeeName}}, you've clocked out. Today's hours: {{hoursWorked}}. Have a great day!",
      createdAt: new Date().toISOString(),
      note: "Configure WhatsApp settings to enable notifications"
    });

    // Update staff slots to 20 to match biz_machine_2
    console.log("Updating staff slots to 20...");
    const staffRef = db.collection("businesses").doc(businessId).collection("staff");
    for (let i = 6; i <= slotsAllowed; i++) {
      await staffRef.doc(i.toString()).set({
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

    // Update status slots to 20 to match biz_machine_2
    console.log("Updating status slots to 20...");
    const statusRef = db.collection("businesses").doc(businessId).collection("status");
    for (let i = 6; i <= slotsAllowed; i++) {
      await statusRef.doc(i.toString()).set({
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

    console.log("✅ Successfully created missing collections and aligned structure");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

createMissingCollections().then(() => {
  console.log("\n🎯 biz_srcomponents now aligned with biz_machine_2 structure");
  process.exit(0);
}).catch(console.error);