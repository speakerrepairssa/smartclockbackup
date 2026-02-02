// AiClock Data Connect Real Data Import Utility
// This script helps you import actual attendance data into your live Data Connect system

import { initializeApp } from 'firebase/app';
import { getDataConnect } from 'firebase/data-connect';

// Firebase configuration for production
const firebaseConfig = {
  projectId: 'aiclock-82608',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Data Connect for production
class ProductionDataImporter {
  constructor() {
    // Initialize Data Connect with production configuration
    this.dataConnect = getDataConnect(app, { 
      connector: 'aiclock-connector',
      location: 'us-central1',
      service: 'aiclock'
    });
  }

  // Import the SDK functions dynamically
  async initializeSDK() {
    if (!this.sdk) {
      this.sdk = await import('./src/dataconnect-generated/index.cjs.js');
    }
    return this.sdk;
  }

  // Generate UUID v4
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Generate UUID v4
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Create business in production
  async createBusiness(businessData) {
    const mutation = mutationRef(this.dataConnect, 'CreateBusiness');
    const businessId = this.generateUUID();
    
    try {
      const result = await executeMutation(mutation, {
        id: businessId,
        businessName: businessData.name,
        email: businessData.email,
        plan: businessData.plan || 'BASIC',
        slotsAllowed: businessData.maxEmployees || 50
      });
      
      console.log('✅ Business created:', businessId);
      return businessId;
    } catch (error) {
      console.error('❌ Failed to create business:', error);
      throw error;
    }
  }

  // Import employees from your existing data
  async importEmployees(businessId, employeesData) {
    const mutation = mutationRef(this.dataConnect, 'CreateEmployee');
    const importedEmployees = [];

    console.log(`📥 Importing ${employeesData.length} employees...`);

    for (const emp of employeesData) {
      try {
        const employeeId = this.generateUUID();
        
        await executeMutation(mutation, {
          id: employeeId,
          businessId: businessId,
          slotId: emp.slotId || emp.id,
          employeeId: emp.employeeId || emp.badgeNumber || `EMP${emp.slotId}`,
          employeeName: emp.name,
          badgeNumber: emp.badgeNumber || emp.employeeId,
          email: emp.email,
          phone: emp.phone,
          position: emp.position || emp.department
        });

        importedEmployees.push({
          id: employeeId,
          slotId: emp.slotId,
          name: emp.name
        });

        console.log(`✅ Employee imported: ${emp.name} (Slot ${emp.slotId})`);
        
        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to import employee ${emp.name}:`, error);
      }
    }

    console.log(`✅ Successfully imported ${importedEmployees.length} employees`);
    return importedEmployees;
  }

  // Import attendance events from your device/existing system
  async importAttendanceEvents(businessId, employeeMapping, eventsData) {
    const mutation = mutationRef(this.dataConnect, 'CreateAttendanceEvent');
    const importedEvents = [];

    console.log(`📥 Importing ${eventsData.length} attendance events...`);

    for (const event of eventsData) {
      try {
        // Find employee by slot ID or name
        const employee = employeeMapping.find(emp => 
          emp.slotId === event.employeeId || 
          emp.name === event.employeeName
        );

        if (!employee) {
          console.warn(`⚠️  No employee found for event: ${event.employeeId || event.employeeName}`);
          continue;
        }

        const eventId = this.generateUUID();
        
        await executeMutation(mutation, {
          id: eventId,
          businessId: businessId,
          employeeId: employee.id,
          eventType: this.mapEventType(event.eventType),
          eventTime: new Date(event.eventTime).toISOString(),
          deviceId: event.deviceId,
          confidence: parseFloat(event.confidence) || 95.0
        });

        importedEvents.push(eventId);

        // Add delay every 10 events
        if (importedEvents.length % 10 === 0) {
          console.log(`📊 Imported ${importedEvents.length} events...`);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`❌ Failed to import event:`, error);
      }
    }

    console.log(`✅ Successfully imported ${importedEvents.length} attendance events`);
    return importedEvents;
  }

  // Map your event types to Data Connect enum values
  mapEventType(eventType) {
    const mapping = {
      'in': 'CLOCK_IN',
      'out': 'CLOCK_OUT',
      'clock_in': 'CLOCK_IN',
      'clock_out': 'CLOCK_OUT',
      'entry': 'CLOCK_IN',
      'exit': 'CLOCK_OUT',
      'break_start': 'BREAK_START',
      'break_end': 'BREAK_END'
    };

    return mapping[eventType?.toLowerCase()] || 'CLOCK_IN';
  }

  // Import data from CSV file (you'll need to parse CSV first)
  async importFromCSV(csvData) {
    // Example CSV structure:
    // Date,Time,EmployeeName,SlotId,Action,DeviceId,Confidence
    // 2026-01-31,09:00:00,John Doe,1,in,device1,98.5
    
    const events = [];
    const lines = csvData.split('\n').slice(1); // Skip header
    
    for (const line of lines) {
      const [date, time, employeeName, slotId, action, deviceId, confidence] = line.split(',');
      
      if (date && time && employeeName && action) {
        events.push({
          eventTime: `${date}T${time}Z`,
          employeeName: employeeName.trim(),
          employeeId: parseInt(slotId),
          eventType: action.trim(),
          deviceId: deviceId?.trim(),
          confidence: confidence?.trim()
        });
      }
    }
    
    return events;
  }

  // Test the production connection
  async testConnection() {
    try {
      console.log('🔌 Testing Data Connect production connection...');
      
      // Try to create a test mutation to verify the connection
      const mutation = mutationRef(this.dataConnect, 'CreateBusiness');
      
      // This will fail because we're not providing data, but it confirms the connection works
      try {
        await executeMutation(mutation, {});
      } catch (error) {
        // If we get a validation error about missing fields, that means the connection is working
        if (error.message.includes('missing') || error.message.includes('required')) {
          console.log('✅ Data Connect connection successful!');
          return true;
        }
        throw error;
      }
      
      console.log('✅ Data Connect connection successful!');
      return true;
    } catch (error) {
      console.error('❌ Data Connect connection failed:', error);
      return false;
    }
  }
}

// Usage Examples:

export async function importRealData() {
  const importer = new ProductionDataImporter();
  
  // Test connection first
  if (!(await importer.testConnection())) {
    console.error('Cannot connect to Data Connect. Check your configuration.');
    return;
  }

  try {
    // 1. Create your business
    const businessId = await importer.createBusiness({
      name: "AiClock Demo Company",
      email: "admin@aiclock.com",
      plan: "PRO",
      maxEmployees: 100
    });

    // 2. Import employees (replace with your actual employee data)
    const employees = [
      { slotId: 1, name: "John Doe", badgeNumber: "B001", email: "john@company.com", position: "Manager" },
      { slotId: 2, name: "Jane Smith", badgeNumber: "B002", email: "jane@company.com", position: "Developer" },
      { slotId: 3, name: "Mike Johnson", badgeNumber: "B003", email: "mike@company.com", position: "Designer" }
    ];
    
    const importedEmployees = await importer.importEmployees(businessId, employees);

    // 3. Import attendance events (replace with your actual event data)
    const events = [
      { 
        employeeId: 1, 
        eventType: 'in', 
        eventTime: '2026-01-31T09:00:00Z', 
        deviceId: 'device1',
        confidence: 98.5 
      },
      { 
        employeeId: 2, 
        eventType: 'in', 
        eventTime: '2026-01-31T09:15:00Z', 
        deviceId: 'device1',
        confidence: 97.2 
      }
    ];
    
    await importer.importAttendanceEvents(businessId, importedEmployees, events);

    console.log(`
🚀 Data Import Complete!

Business ID: ${businessId}
Employees: ${importedEmployees.length}
Events: ${events.length}

Your real data is now in the production Data Connect system!
You can view it in the Firebase Console:
https://console.firebase.google.com/project/aiclock-82608/dataconnect/locations/us-central1/services/aiclock/schema
    `);

  } catch (error) {
    console.error('Import failed:', error);
  }
}

// Export the importer class for custom usage
export { ProductionDataImporter };

// Uncomment the line below to run the import when this script is executed
// importRealData();