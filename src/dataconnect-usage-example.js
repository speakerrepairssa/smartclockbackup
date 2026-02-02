// AiClock Data Connect Example Usage
// This file demonstrates how to use Firebase Data Connect with your AiClock app

import { getDataConnect, connectDataConnectEmulator } from 'firebase/data-connect';
import { initializeApp } from 'firebase/app';

// Import generated SDK
import { 
  getBusinessWithEmployees,
  getBusinessStats,
  createBusiness,
  createEmployee,
  createAttendanceEvent,
  clockIn,
  clockOut
} from './dataconnect-generated';

// Firebase config (use your actual config)
const firebaseConfig = {
  // Your Firebase config
};

const app = initializeApp(firebaseConfig);
const dataConnect = getDataConnect(app, {
  connector: 'aiclock-connector',
  location: 'us-central1',
  service: 'aiclock'
});

// For development, you can connect to the Data Connect emulator
if (location.hostname === 'localhost') {
  connectDataConnectEmulator(dataConnect, 'localhost', 9399);
}

// Example usage functions
export class AiClockDataService {
  
  // Create a new business
  async createBusiness(businessData) {
    try {
      const result = await createBusiness(dataConnect, {
        businessData: {
          businessName: businessData.businessName,
          email: businessData.email,
          plan: businessData.plan || 'FREE',
          slotsAllowed: businessData.slotsAllowed || 10,
          status: 'ACTIVE'
        }
      });
      console.log('Business created:', result.data);
      return result.data;
    } catch (error) {
      console.error('Error creating business:', error);
      throw error;
    }
  }

  // Add employee to business
  async addEmployee(businessId, employeeData) {
    try {
      const result = await createEmployee(dataConnect, {
        employeeData: {
          businessId,
          slotId: employeeData.slotId,
          employeeId: employeeData.employeeId,
          employeeName: employeeData.employeeName,
          badgeNumber: employeeData.badgeNumber,
          active: true,
          phone: employeeData.phone,
          email: employeeData.email,
          position: employeeData.position,
          department: employeeData.department
        }
      });
      console.log('Employee created:', result.data);
      return result.data;
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  }

  // Record clock-in event
  async employeeClockIn(businessId, employeeId, deviceId = null) {
    try {
      const eventTime = new Date().toISOString();
      const result = await clockIn(dataConnect, {
        businessId,
        employeeId,
        eventTime,
        deviceId
      });
      console.log('Clock-in recorded:', result.data);
      return result.data;
    } catch (error) {
      console.error('Error recording clock-in:', error);
      throw error;
    }
  }

  // Record clock-out event
  async employeeClockOut(businessId, employeeId, deviceId = null) {
    try {
      const eventTime = new Date().toISOString();
      const result = await clockOut(dataConnect, {
        businessId,
        employeeId,
        eventTime,
        deviceId
      });
      console.log('Clock-out recorded:', result.data);
      return result.data;
    } catch (error) {
      console.error('Error recording clock-out:', error);
      throw error;
    }
  }

  // Get business with all employees
  async getBusinessData(businessId) {
    try {
      const result = await getBusinessWithEmployees(dataConnect, { businessId });
      console.log('Business data:', result.data);
      return result.data;
    } catch (error) {
      console.error('Error fetching business data:', error);
      throw error;
    }
  }

  // Get business statistics
  async getBusinessStats(businessId) {
    try {
      const result = await getBusinessStats(dataConnect, { businessId });
      console.log('Business stats:', result.data);
      return result.data;
    } catch (error) {
      console.error('Error fetching business stats:', error);
      throw error;
    }
  }

  // Bulk import attendance events (useful for device sync)
  async importAttendanceEvents(businessId, events) {
    try {
      const eventPromises = events.map(event => 
        createAttendanceEvent(dataConnect, {
          eventData: {
            businessId,
            employeeId: event.employeeId,
            eventType: event.eventType,
            eventTime: event.eventTime,
            deviceId: event.deviceId,
            deviceName: event.deviceName,
            confidence: event.confidence,
            biometricData: event.biometricData,
            notes: event.notes
          }
        })
      );
      
      const results = await Promise.all(eventPromises);
      console.log(`Imported ${results.length} attendance events`);
      return results;
    } catch (error) {
      console.error('Error importing attendance events:', error);
      throw error;
    }
  }
}

// Example initialization
export const aiClockDataService = new AiClockDataService();

// Usage example:
/*
// Create a business
const business = await aiClockDataService.createBusiness({
  businessName: "Tech Company Ltd",
  email: "admin@techcompany.com",
  plan: "PRO",
  slotsAllowed: 50
});

// Add employee
const employee = await aiClockDataService.addEmployee(business.id, {
  slotId: 1,
  employeeId: "EMP001",
  employeeName: "John Doe",
  badgeNumber: "12345",
  position: "Developer",
  department: "Engineering"
});

// Record clock-in
await aiClockDataService.employeeClockIn(business.id, employee.id, "DEVICE_001");

// Get business stats
const stats = await aiClockDataService.getBusinessStats(business.id);
*/