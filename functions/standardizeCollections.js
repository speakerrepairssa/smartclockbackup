const admin = require('firebase-admin');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Standard collection structure for all businesses
const STANDARD_COLLECTIONS = {
  employees: {
    // employeeId, name, email, role, etc.
  },
  attendance_events: {
    // All attendance events in flat structure with proper indexing
    // Fields: employeeId, timestamp, type, deviceId, location, etc.
  },
  devices: {
    // deviceId, name, location, status, etc.
  },
  schedules: {
    // employeeId, day, startTime, endTime, etc.
  },
  timecards: {
    // Calculated timecards from attendance events
  },
  settings: {
    // Business-specific settings
  }
};

async function standardizeAllBusinesses() {
  try {
    console.log('Starting collection standardization...');
    
    // Get all businesses
    const businessesSnapshot = await db.collection('businesses').get();
    console.log(`Found ${businessesSnapshot.size} businesses to standardize`);
    
    const results = [];
    
    for (const businessDoc of businessesSnapshot.docs) {
      const businessId = businessDoc.id;
      const businessData = businessDoc.data();
      
      console.log(`\n=== Processing Business: ${businessId} (${businessData.businessName || 'Unknown'}) ===`);
      
      try {
        const result = await standardizeBusiness(businessId);
        results.push({ businessId, success: true, ...result });
      } catch (error) {
        console.error(`Failed to standardize business ${businessId}:`, error);
        results.push({ businessId, success: false, error: error.message });
      }
    }
    
    // Summary
    console.log('\n=== STANDARDIZATION COMPLETE ===');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Successfully standardized: ${successful} businesses`);
    console.log(`❌ Failed: ${failed} businesses`);
    
    if (failed > 0) {
      console.log('\nFailed businesses:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.businessId}: ${r.error}`);
      });
    }
    
    return results;
    
  } catch (error) {
    console.error('Fatal error during standardization:', error);
    throw error;
  }
}

async function standardizeBusiness(businessId) {
  const businessRef = db.collection('businesses').doc(businessId);
  
  console.log(`Analyzing collections for business: ${businessId}`);
  
  // Analyze current structure
  const currentStructure = await analyzeBusinessStructure(businessId);
  console.log('Current structure:', JSON.stringify(currentStructure, null, 2));
  
  const migrationStats = {
    employees: 0,
    attendanceEvents: 0,
    devices: 0,
    collectionsCreated: [],
    collectionsRemoved: [],
    errors: []
  };
  
  // 1. Standardize employees collection
  await standardizeEmployees(businessId, currentStructure, migrationStats);
  
  // 2. Standardize attendance events (most complex)
  await standardizeAttendanceEvents(businessId, currentStructure, migrationStats);
  
  // 3. Standardize devices collection
  await standardizeDevices(businessId, currentStructure, migrationStats);
  
  // 4. Ensure standard collections exist
  await ensureStandardCollections(businessId, migrationStats);
  
  // 5. Clean up old collections (optional - commented out for safety)
  // await cleanupOldCollections(businessId, currentStructure, migrationStats);
  
  console.log(`Migration stats for ${businessId}:`, migrationStats);
  return migrationStats;
}

async function analyzeBusinessStructure(businessId) {
  const structure = {
    collections: {},
    totalDocuments: 0
  };
  
  const businessRef = db.collection('businesses').doc(businessId);
  
  // Get all collections for this business
  try {
    const collections = await businessRef.listCollections();
    console.log(`Found collections for ${businessId}:`, collections.map(c => c.id));
    
    for (const collection of collections) {
      const collName = collection.id;
      try {
        const snapshot = await collection.limit(5).get();
        
        structure.collections[collName] = {
          exists: true,
          documentCount: snapshot.size,
          sampleDocs: snapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
          }))
        };
        
        // For attendance_events, check if it has date-based documents
        if (collName === 'attendance_events' && !snapshot.empty) {
          console.log(`Checking attendance_events structure...`);
          for (const doc of snapshot.docs.slice(0, 2)) {
            const datePattern = /^\d{4}-\d{2}-\d{2}$/;
            if (datePattern.test(doc.id)) {
              console.log(`Found date document: ${doc.id}, checking for subcollections...`);
              
              // This is a date document, check for subcollections
              const subcollections = await doc.ref.listCollections();
              if (subcollections.length > 0) {
                structure.collections[collName].hasSubcollections = true;
                structure.collections[collName].subcollections = subcollections.map(sc => sc.id);
                console.log(`Date ${doc.id} has subcollections:`, subcollections.map(sc => sc.id));
                
                // Sample some data from subcollections
                for (const subcoll of subcollections.slice(0, 2)) {
                  const subDocs = await subcoll.limit(2).get();
                  console.log(`Subcollection ${subcoll.id} has ${subDocs.size} docs`);
                  subDocs.forEach(subDoc => {
                    console.log(`  Sample doc:`, subDoc.data());
                  });
                }
              }
            } else {
              // This is a regular event document
              console.log(`Found event document: ${doc.id}`, doc.data());
            }
          }
        }
        
        structure.totalDocuments += snapshot.size;
        
      } catch (error) {
        console.log(`Error analyzing collection ${collName}:`, error.message);
        structure.collections[collName] = {
          exists: false,
          error: error.message
        };
      }
    }
    
  } catch (error) {
    console.error(`Error getting collections for ${businessId}:`, error.message);
  }
  
  return structure;
}

async function standardizeEmployees(businessId, currentStructure, stats) {
  console.log('Standardizing employees...');
  
  const businessRef = db.collection('businesses').doc(businessId);
  const standardEmployeesRef = businessRef.collection('employees');
  
  // Check if standard employees collection already exists with data
  const existingEmployees = await standardEmployeesRef.get();
  
  if (existingEmployees.size > 0) {
    console.log(`✓ Employees collection already standardized (${existingEmployees.size} employees)`);
    stats.employees = existingEmployees.size;
    return;
  }
  
  // Look for employees in any existing collection
  let employees = [];
  
  // Check standard employees collection
  if (currentStructure.collections.employees) {
    const employeesSnapshot = await standardEmployeesRef.get();
    employeesSnapshot.forEach(doc => {
      employees.push({ id: doc.id, ...doc.data() });
    });
  }
  
  // If no employees found, create default structure
  if (employees.length === 0) {
    console.log('No employees found - creating empty collection structure');
    // Create a hidden document to establish the collection
    await standardEmployeesRef.doc('_structure').set({
      _created: admin.firestore.FieldValue.serverTimestamp(),
      _type: 'collection_marker'
    });
  } else {
    // Migrate employees to standard format
    const batch = db.batch();
    
    employees.forEach(employee => {
      const employeeRef = standardEmployeesRef.doc(employee.id);
      const standardEmployee = {
        employeeId: employee.employeeId || employee.id,
        name: employee.name || employee.employeeName || '',
        email: employee.email || '',
        role: employee.role || 'employee',
        status: employee.status || 'active',
        createdAt: employee.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      batch.set(employeeRef, standardEmployee);
    });
    
    await batch.commit();
    console.log(`✓ Migrated ${employees.length} employees to standard format`);
  }
  
  stats.employees = employees.length;
  stats.collectionsCreated.push('employees');
}

async function standardizeAttendanceEvents(businessId, currentStructure, stats) {
  console.log('Standardizing attendance events...');
  
  const businessRef = db.collection('businesses').doc(businessId);
  const standardEventsRef = businessRef.collection('attendance_events');
  
  let allEvents = [];
  
  // First, check if attendance_events exists and what structure it has
  try {
    const attendanceEventsSnapshot = await standardEventsRef.get();
    console.log(`attendance_events collection has ${attendanceEventsSnapshot.size} documents`);
    
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    let hasNestedStructure = false;
    let hasDirectEvents = false;
    
    for (const doc of attendanceEventsSnapshot.docs) {
      if (datePattern.test(doc.id)) {
        // This is a date document - check for subcollections
        console.log(`Found date document: ${doc.id}`);
        hasNestedStructure = true;
        
        try {
          const subcollections = await doc.ref.listCollections();
          console.log(`Date ${doc.id} has ${subcollections.length} subcollections`);
          
          for (const subcoll of subcollections) {
            const subDocs = await subcoll.get();
            console.log(`Processing ${subDocs.size} events from ${doc.id}/${subcoll.id}`);
            
            subDocs.forEach(subDoc => {
              const eventData = subDoc.data();
              const standardEvent = {
                employeeId: subcoll.id, // subcollection name is employee ID
                timestamp: eventData.timestamp || eventData.time || eventData.dateTime || admin.firestore.FieldValue.serverTimestamp(),
                type: eventData.type || eventData.action || eventData.event_type || 'unknown',
                deviceId: eventData.deviceId || eventData.device_id || '',
                location: eventData.location || '',
                date: doc.id, // use the date document ID
                originalData: eventData,
                migratedFrom: `attendance_events/${doc.id}/${subcoll.id}`,
                migrationDate: admin.firestore.FieldValue.serverTimestamp()
              };
              
              allEvents.push({
                id: `${doc.id}_${subcoll.id}_${subDoc.id}`,
                data: standardEvent
              });
            });
          }
        } catch (error) {
          console.log(`Error processing date ${doc.id}:`, error.message);
          stats.errors.push(`Date ${doc.id}: ${error.message}`);
        }
      } else if (doc.id !== '_structure') {
        // This is a direct event document
        console.log(`Found direct event: ${doc.id}`);
        hasDirectEvents = true;
        
        const eventData = doc.data();
        if (eventData.migrated) {
          console.log(`Event ${doc.id} already migrated, skipping`);
          allEvents.push({ id: doc.id, data: eventData });
        } else {
          console.log(`Event ${doc.id} needs standardization`);
          const standardEvent = {
            employeeId: eventData.employeeId || eventData.employee_id || '',
            timestamp: eventData.timestamp || eventData.time || admin.firestore.FieldValue.serverTimestamp(),
            type: eventData.type || eventData.action || 'unknown',
            deviceId: eventData.deviceId || eventData.device_id || '',
            location: eventData.location || '',
            date: eventData.date || (eventData.timestamp ? 
              new Date(eventData.timestamp.toDate ? eventData.timestamp.toDate() : eventData.timestamp)
                .toISOString().split('T')[0] : 
              new Date().toISOString().split('T')[0]),
            originalData: eventData,
            migratedFrom: 'attendance_events',
            migrationDate: admin.firestore.FieldValue.serverTimestamp()
          };
          
          allEvents.push({ id: doc.id, data: standardEvent });
        }
      }
    }
    
    console.log(`Found structure - Nested: ${hasNestedStructure}, Direct: ${hasDirectEvents}`);
    
  } catch (error) {
    console.log('Error analyzing attendance_events:', error.message);
    stats.errors.push(`Analyzing attendance_events: ${error.message}`);
  }
  
  // Get all other collections and check for event-related data
  try {
    const collections = await businessRef.listCollections();
    
    for (const collection of collections) {
      const collName = collection.id;
      
      // Skip the attendance_events (already processed) and standard collections
      if (collName === 'attendance_events' || 
          collName === 'employees' || 
          collName === 'devices' || 
          collName === 'schedules' || 
          collName === 'timecards' || 
          collName === 'settings') {
        continue;
      }
      
      // Check if this looks like an event collection
      if (collName.includes('event') || 
          collName.includes('attendance') || 
          collName.includes('device_') ||
          collName === 'events') {
        
        console.log(`Processing additional event collection: ${collName}`);
        
        try {
          const eventsSnapshot = await collection.get();
          console.log(`Collection ${collName} has ${eventsSnapshot.size} documents`);
          
          eventsSnapshot.forEach(doc => {
            const eventData = doc.data();
            
            const standardEvent = {
              employeeId: eventData.employeeId || eventData.employee_id || eventData.userId || '',
              timestamp: eventData.timestamp || eventData.time || eventData.dateTime || admin.firestore.FieldValue.serverTimestamp(),
              type: eventData.type || eventData.action || eventData.event_type || 'unknown',
              deviceId: eventData.deviceId || eventData.device_id || extractDeviceIdFromCollectionName(collName) || '',
              location: eventData.location || '',
              originalData: eventData,
              migratedFrom: collName,
              migrationDate: admin.firestore.FieldValue.serverTimestamp()
            };
            
            // Add date field
            if (standardEvent.timestamp) {
              try {
                const date = standardEvent.timestamp.toDate ? 
                  standardEvent.timestamp.toDate() : 
                  new Date(standardEvent.timestamp);
                standardEvent.date = date.toISOString().split('T')[0];
              } catch (error) {
                console.log('Error parsing date:', error.message);
                standardEvent.date = new Date().toISOString().split('T')[0];
              }
            }
            
            allEvents.push({
              id: `${collName}_${doc.id}`,
              data: standardEvent
            });
          });
          
        } catch (error) {
          console.error(`Error processing collection ${collName}:`, error);
          stats.errors.push(`Collection ${collName}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Error listing collections:', error);
    stats.errors.push(`Listing collections: ${error.message}`);
  }
  
  console.log(`Found ${allEvents.length} total events to process`);
  
  if (allEvents.length > 0) {
    // Clear the entire attendance_events collection to start fresh
    console.log('Clearing existing attendance_events collection...');
    
    try {
      // Delete all documents (both nested and direct)
      const existingSnapshot = await standardEventsRef.get();
      
      for (const doc of existingSnapshot.docs) {
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (datePattern.test(doc.id)) {
          // Delete nested structure
          try {
            const subcollections = await doc.ref.listCollections();
            for (const subcoll of subcollections) {
              const subDocs = await subcoll.get();
              for (const subDoc of subDocs.docs) {
                await subDoc.ref.delete();
              }
            }
          } catch (error) {
            console.log(`Error deleting subcollections for ${doc.id}:`, error.message);
          }
        }
        
        // Delete the document itself
        await doc.ref.delete();
      }
      
      console.log('✓ Cleared existing attendance_events collection');
    } catch (error) {
      console.error('Error clearing collection:', error);
      stats.errors.push(`Clearing collection: ${error.message}`);
    }
    
    // Now write all events as flat documents
    console.log('Writing standardized events...');
    const batchSize = 500;
    let batch = db.batch();
    let batchCount = 0;
    
    for (let i = 0; i < allEvents.length; i++) {
      const event = allEvents[i];
      const eventRef = standardEventsRef.doc(); // Auto-generate ID
      batch.set(eventRef, event.data);
      batchCount++;
      
      if (batchCount >= batchSize || i === allEvents.length - 1) {
        await batch.commit();
        console.log(`✓ Wrote batch of ${batchCount} events`);
        batch = db.batch();
        batchCount = 0;
      }
    }
    
    // Now clean up the old nested date structure
    console.log('Cleaning up old nested date structure...');
    
    try {
      // Get all documents in attendance_events to find date patterns
      const allDocs = await standardEventsRef.get();
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      
      for (const doc of allDocs.docs) {
        if (datePattern.test(doc.id)) {
          console.log(`Deleting old date document: ${doc.id}`);
          
          // First delete all subcollections
          try {
            const subcollections = await doc.ref.listCollections();
            for (const subcoll of subcollections) {
              console.log(`  Deleting subcollection: ${subcoll.id}`);
              const subDocs = await subcoll.get();
              for (const subDoc of subDocs.docs) {
                await subDoc.ref.delete();
              }
            }
          } catch (error) {
            console.log(`Error deleting subcollections for ${doc.id}:`, error.message);
          }
          
          // Then delete the date document itself
          await doc.ref.delete();
          console.log(`✓ Deleted date document: ${doc.id}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up nested structure:', error);
      stats.errors.push(`Cleanup: ${error.message}`);
    }
    
  } else {
    // Create empty collection structure
    await standardEventsRef.doc('_structure').set({
      _created: admin.firestore.FieldValue.serverTimestamp(),
      _type: 'collection_marker'
    });
    console.log('✓ Created empty attendance_events collection structure');
  }
  
  stats.attendanceEvents = allEvents.length;
  stats.collectionsCreated.push('attendance_events');
}

function extractDeviceIdFromCollectionName(collectionName) {
  // Extract device ID from collection names like "device_FC449999_events"
  const match = collectionName.match(/device_([^_]+)/);
  return match ? match[1] : '';
}

async function cleanupOldEventCollections(businessRef, collections, stats) {
  console.log('Cleaning up old event collections...');
  
  const collectionsToDelete = [];
  
  for (const collection of collections) {
    const collName = collection.id;
    
    // Mark old event collections for deletion
    if ((collName.includes('event') || 
         collName.includes('attendance') || 
         collName.includes('device_') ||
         collName === 'events') && 
         collName !== 'attendance_events') {
      
      collectionsToDelete.push(collName);
    }
  }
  
  console.log(`Collections marked for cleanup: ${collectionsToDelete.join(', ')}`);
  stats.collectionsRemoved = collectionsToDelete;
  
  // Actually delete collections (commented out for safety)
  /*
  for (const collName of collectionsToDelete) {
    try {
      const collRef = businessRef.collection(collName);
      const snapshot = await collRef.get();
      
      const batch = db.batch();
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      
      console.log(`✓ Deleted collection: ${collName}`);
    } catch (error) {
      console.error(`Error deleting collection ${collName}:`, error);
    }
  }
  */
}

async function standardizeDevices(businessId, currentStructure, stats) {
  console.log('Standardizing devices...');
  
  const businessRef = db.collection('businesses').doc(businessId);
  const standardDevicesRef = businessRef.collection('devices');
  
  // Check if devices collection exists
  const existingDevices = await standardDevicesRef.get();
  
  if (existingDevices.size > 0) {
    console.log(`✓ Devices collection already exists (${existingDevices.size} devices)`);
    stats.devices = existingDevices.size;
    return;
  }
  
  // Create empty devices collection structure
  await standardDevicesRef.doc('_structure').set({
    _created: admin.firestore.FieldValue.serverTimestamp(),
    _type: 'collection_marker'
  });
  
  console.log('✓ Created devices collection structure');
  stats.collectionsCreated.push('devices');
}

async function ensureStandardCollections(businessId, stats) {
  console.log('Ensuring all standard collections exist...');
  
  const businessRef = db.collection('businesses').doc(businessId);
  const standardCollections = ['employees', 'attendance_events', 'devices', 'schedules', 'timecards', 'settings'];
  
  for (const collName of standardCollections) {
    const collRef = businessRef.collection(collName);
    const snapshot = await collRef.limit(1).get();
    
    if (snapshot.empty) {
      // Create structure document
      await collRef.doc('_structure').set({
        _created: admin.firestore.FieldValue.serverTimestamp(),
        _type: 'collection_marker',
        _collection: collName
      });
      console.log(`✓ Created ${collName} collection structure`);
      
      if (!stats.collectionsCreated.includes(collName)) {
        stats.collectionsCreated.push(collName);
      }
    }
  }
}

// Export functions for Firebase Functions
exports.standardizeAllBusinesses = standardizeAllBusinesses;
exports.standardizeBusiness = standardizeBusiness;

// For direct execution
if (require.main === module) {
  standardizeAllBusinesses()
    .then(results => {
      console.log('Standardization completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Standardization failed:', error);
      process.exit(1);
    });
}