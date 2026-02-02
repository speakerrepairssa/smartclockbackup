// Firebase Data Connect Migration Script
// This script helps migrate data from Firestore to Data Connect

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { aiClockDataService } from './dataconnect-usage-example.js';

// Your Firebase config
const firebaseConfig = {
  // Add your Firebase config here
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class DataMigrator {
  
  async migrateBusinesses() {
    console.log('🏢 Starting business migration...');
    
    try {
      const businessesSnapshot = await getDocs(collection(db, 'businesses'));
      const businesses = [];
      
      for (const doc of businessesSnapshot.docs) {
        const data = doc.data();
        
        // Map Firestore business to Data Connect format
        const businessData = {
          businessName: data.businessName,
          email: data.email,
          plan: data.plan || 'FREE',
          slotsAllowed: data.slotsAllowed || 10,
          status: 'ACTIVE'
        };
        
        try {
          const newBusiness = await aiClockDataService.createBusiness(businessData);
          businesses.push({
            oldId: doc.id,
            newId: newBusiness.id,
            businessName: businessData.businessName
          });
          console.log(`✅ Migrated business: ${businessData.businessName}`);
        } catch (error) {
          console.error(`❌ Error migrating business ${businessData.businessName}:`, error);
        }
      }
      
      console.log(`🎉 Migrated ${businesses.length} businesses`);
      return businesses;
      
    } catch (error) {
      console.error('❌ Error migrating businesses:', error);
      return [];
    }
  }
  
  async migrateEmployees(businessMappings) {
    console.log('👥 Starting employee migration...');
    const employees = [];
    
    for (const business of businessMappings) {
      try {
        const staffSnapshot = await getDocs(collection(db, `businesses/${business.oldId}/staff`));
        
        for (const doc of staffSnapshot.docs) {
          const data = doc.data();
          
          // Map Firestore employee to Data Connect format
          const employeeData = {
            slotId: data.slotId,
            employeeId: data.employeeId || doc.id,
            employeeName: data.employeeName,
            badgeNumber: data.badgeNumber || data.slotId.toString(),
            active: data.active !== false,
            phone: data.phone,
            email: data.email,
            position: data.position,
            department: data.department,
            hireDate: data.hireDate,
            hourlyRate: data.hourlyRate
          };
          
          try {
            const newEmployee = await aiClockDataService.addEmployee(business.newId, employeeData);
            employees.push({
              oldId: doc.id,
              newId: newEmployee.id,
              businessId: business.newId,
              employeeName: employeeData.employeeName
            });
            console.log(`✅ Migrated employee: ${employeeData.employeeName} (${business.businessName})`);
          } catch (error) {
            console.error(`❌ Error migrating employee ${employeeData.employeeName}:`, error);
          }
        }
      } catch (error) {
        console.error(`❌ Error migrating employees for business ${business.businessName}:`, error);
      }
    }
    
    console.log(`🎉 Migrated ${employees.length} employees`);
    return employees;
  }
  
  async migrateAttendanceEvents(businessMappings, employeeMappings) {
    console.log('📊 Starting attendance events migration...');
    let totalEvents = 0;
    
    for (const business of businessMappings) {
      try {
        const eventsSnapshot = await getDocs(collection(db, `businesses/${business.oldId}/attendance_events`));
        const events = [];
        
        for (const doc of eventsSnapshot.docs) {
          const data = doc.data();
          
          // Find corresponding employee mapping
          const employee = employeeMappings.find(emp => 
            emp.businessId === business.newId && 
            (emp.oldId === data.employeeId || emp.employeeName === data.employeeName)
          );
          
          if (employee) {
            // Map Firestore event to Data Connect format
            const eventData = {
              employeeId: employee.newId,
              eventType: this.mapEventType(data.eventType),
              eventTime: data.timestamp?.toDate?.()?.toISOString() || new Date(data.timestamp).toISOString(),
              deviceId: data.deviceId,
              deviceName: data.deviceName,
              confidence: data.confidence,
              biometricData: data.biometricData ? JSON.stringify(data.biometricData) : null,
              notes: data.notes
            };
            
            events.push(eventData);
          } else {
            console.warn(`⚠️  Could not find employee mapping for event: ${data.employeeName}`);
          }
        }
        
        if (events.length > 0) {
          try {
            await aiClockDataService.importAttendanceEvents(business.newId, events);
            totalEvents += events.length;
            console.log(`✅ Migrated ${events.length} events for ${business.businessName}`);
          } catch (error) {
            console.error(`❌ Error migrating events for ${business.businessName}:`, error);
          }
        }
      } catch (error) {
        console.error(`❌ Error migrating events for business ${business.businessName}:`, error);
      }
    }
    
    console.log(`🎉 Migrated ${totalEvents} attendance events`);
    return totalEvents;
  }
  
  mapEventType(firestoreEventType) {
    const mapping = {
      'clock_in': 'CLOCK_IN',
      'clock_out': 'CLOCK_OUT',
      'break_start': 'BREAK_START',
      'break_end': 'BREAK_END',
      'manual_in': 'MANUAL_IN',
      'manual_out': 'MANUAL_OUT',
      'auto': 'SYSTEM_AUTO'
    };
    
    return mapping[firestoreEventType?.toLowerCase()] || 'CLOCK_IN';
  }
  
  async runFullMigration() {
    console.log('🚀 Starting full data migration from Firestore to Data Connect');
    console.log('================================================');
    
    try {
      // Step 1: Migrate businesses
      const businesses = await this.migrateBusinesses();
      if (businesses.length === 0) {
        console.log('❌ No businesses to migrate. Stopping migration.');
        return;
      }
      
      // Step 2: Migrate employees
      const employees = await this.migrateEmployees(businesses);
      
      // Step 3: Migrate attendance events
      const eventCount = await this.migrateAttendanceEvents(businesses, employees);
      
      console.log('================================================');
      console.log('🎉 Migration completed successfully!');
      console.log(`   Businesses: ${businesses.length}`);
      console.log(`   Employees: ${employees.length}`);
      console.log(`   Events: ${eventCount}`);
      console.log('================================================');
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
    }
  }
}

// Export for use
export const dataMigrator = new DataMigrator();

// Uncomment to run migration
// dataMigrator.runFullMigration();