// Add this to index.js - Align Collections Function
exports.alignBusinessCollections = onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const { businessId, templateBusinessId } = req.query;
    const targetBusiness = businessId || "biz_srcomponents";
    const templateBusiness = templateBusinessId || "biz_machine_2";
    
    logger.info("🔧 Aligning business collections", { targetBusiness, templateBusiness });

    // Standard collections that every business should have
    const standardCollections = [
      "assessment_cache",
      "assessments_realtime", 
      "attendance_events",
      "devices",
      "settings",
      "shifts",
      "staff",
      "status",
      "whatsapp_templates"
    ];

    const slotsAllowed = 20; // Standard 20 slots
    const currentMonth = new Date().toISOString().substring(0, 7);

    // Create missing collections for target business
    for (const collectionName of standardCollections) {
      const collectionRef = db.collection('businesses').doc(targetBusiness).collection(collectionName);
      
      try {
        switch (collectionName) {
          case 'devices':
            const deviceDoc = await collectionRef.doc('admin').get();
            if (!deviceDoc.exists) {
              await collectionRef.doc('admin').set({
                deviceId: "admin",
                deviceName: "Admin Device", 
                deviceType: "hikvision",
                status: "active",
                isPlaceholder: false,
                createdAt: new Date().toISOString()
              });
            }
            break;

          case 'assessment_cache':
            const cacheDoc = await collectionRef.doc(currentMonth).get();
            if (!cacheDoc.exists) {
              await collectionRef.doc(currentMonth).set({
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
                calculationVersion: "1.0"
              });
            }
            break;

          case 'assessments_realtime':
            const realtimeDoc = await collectionRef.doc(currentMonth).get();
            if (!realtimeDoc.exists) {
              await collectionRef.doc(currentMonth).set({
                summary: {
                  total: slotsAllowed,
                  present: 0,
                  percentage: 0,
                  last_calculated: Date.now(),
                  status: "ready"
                },
                employees: {},
                lastUpdated: new Date().toISOString()
              });
            }
            break;

          case 'settings':
            const settingsDoc = await collectionRef.doc('general').get();
            if (!settingsDoc.exists) {
              await collectionRef.doc('general').set({
                businessName: targetBusiness === "biz_srcomponents" ? "SR Components" : "Business Name",
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
            }
            break;

          case 'shifts':
            const shiftsSnapshot = await collectionRef.limit(1).get();
            if (shiftsSnapshot.empty) {
              await collectionRef.doc('_placeholder').set({
                shiftName: "No shifts configured yet",
                isPlaceholder: true,
                note: "Create shifts in the admin panel",
                createdAt: new Date().toISOString()
              });
            }
            break;

          case 'whatsapp_templates':
            const templateDoc = await collectionRef.doc('clock_out_template').get();
            if (!templateDoc.exists) {
              await collectionRef.doc('clock_out_template').set({
                trigger: "clock-out",
                recipient: "employee",
                active: false,
                message: "Hi {{employeeName}}, you've clocked out. Today's hours: {{hoursWorked}}. Have a great day!",
                createdAt: new Date().toISOString()
              });
            }
            break;

          case 'attendance_events':
            const eventsDoc = await collectionRef.doc('_system_ready').get();
            if (!eventsDoc.exists) {
              await collectionRef.doc('_system_ready').set({
                message: "Attendance events collection ready",
                businessId: targetBusiness,
                maxEmployees: slotsAllowed,
                createdAt: new Date().toISOString(),
                structure: "unified_attendance_events_v1"
              });
            }
            break;

          case 'staff':
            // Ensure we have 20 staff slots
            const staffSnapshot = await collectionRef.get();
            const existingSlots = staffSnapshot.docs.length;
            
            for (let i = 1; i <= slotsAllowed; i++) {
              const slotDoc = await collectionRef.doc(i.toString()).get();
              if (!slotDoc.exists) {
                await collectionRef.doc(i.toString()).set({
                  employeeId: i.toString(),
                  employeeName: `Employee ${i}`,
                  badgeNumber: i.toString(),
                  slotNumber: i,
                  slot: i,
                  active: false,
                  isActive: false,
                  deviceId: "",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                });
              }
            }
            break;

          case 'status':
            // Ensure we have 20 status slots
            for (let i = 1; i <= slotsAllowed; i++) {
              const statusDoc = await collectionRef.doc(i.toString()).get();
              if (!statusDoc.exists) {
                await collectionRef.doc(i.toString()).set({
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
            }
            break;
        }
        
        logger.info(`✅ Processed collection: ${collectionName}`);
      } catch (error) {
        logger.warn(`⚠️ Error processing ${collectionName}:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `Collections aligned for ${targetBusiness}`,
      collectionsProcessed: standardCollections,
      slotsCreated: slotsAllowed,
      templateBusiness: templateBusiness
    });

  } catch (error) {
    logger.error("Error aligning collections:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});