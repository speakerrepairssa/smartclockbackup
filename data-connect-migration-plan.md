# Firebase Data Connect Migration Plan for AiClock

## Overview
Migration from Firebase Firestore to Firebase Data Connect with PostgreSQL backend to enhance performance, enable complex analytics, and provide type-safe operations.

## Current vs Proposed Architecture

### Current (Firestore)
```javascript
/businesses/{businessId}/
├── staff/{slotId}                    // Employee Management
├── status/{slotId}                   // Real-time Monitoring  
└── attendance_events/{eventId}       // Flat attendance records
```

### Proposed (Data Connect + PostgreSQL)
```graphql
type Business @table {
  id: UUID! @default(expr: "gen_random_uuid()")
  businessName: String! @col(name: "business_name")
  email: String! @unique
  plan: BusinessPlan!
  slotsAllowed: Int! @col(name: "slots_allowed")
  status: BusinessStatus!
  deviceId: String? @col(name: "device_id")
  createdAt: Timestamp! @default(expr: "now()")
  updatedAt: Timestamp! @default(expr: "now()")
}

type Employee @table {
  id: UUID! @default(expr: "gen_random_uuid()")
  businessId: UUID! @col(name: "business_id")
  business: Business! @ref(fields: "businessId", references: "id")
  slotId: Int! @col(name: "slot_id")
  employeeId: String! @col(name: "employee_id")
  employeeName: String! @col(name: "employee_name")
  badgeNumber: String! @col(name: "badge_number")
  active: Boolean! @default(value: true)
  phone: String?
  email: String?
  position: String?
  department: String?
  idNumber: String? @col(name: "id_number")
  address: String?
  hireDate: Date? @col(name: "hire_date")
  hourlyRate: Float? @col(name: "hourly_rate")
  notes: String?
  createdAt: Timestamp! @default(expr: "now()")
  updatedAt: Timestamp! @default(expr: "now()")
}

type EmployeeStatus @table {
  id: UUID! @default(expr: "gen_random_uuid()")
  businessId: UUID! @col(name: "business_id")
  business: Business! @ref(fields: "businessId", references: "id")
  employeeId: UUID! @col(name: "employee_id")
  employee: Employee! @ref(fields: "employeeId", references: "id")
  attendanceStatus: AttendanceStatus! @col(name: "attendance_status")
  lastClockStatus: AttendanceStatus! @col(name: "last_clock_status")
  lastClockTime: Timestamp? @col(name: "last_clock_time")
  lastEventType: EventType? @col(name: "last_event_type")
  deviceId: String? @col(name: "device_id")
  updatedAt: Timestamp! @default(expr: "now()")
}

type AttendanceEvent @table {
  id: UUID! @default(expr: "gen_random_uuid()")
  businessId: UUID! @col(name: "business_id")
  business: Business! @ref(fields: "businessId", references: "id")
  employeeId: UUID! @col(name: "employee_id")
  employee: Employee! @ref(fields: "employeeId", references: "id")
  slotNumber: Int! @col(name: "slot_number")
  timestamp: Timestamp!
  attendanceStatus: AttendanceStatus! @col(name: "attendance_status")
  eventDate: Date! @col(name: "event_date")
  eventTime: String! @col(name: "event_time") # HH:MM:SS format
  deviceId: String! @col(name: "device_id")
  verifyNo: String? @col(name: "verify_no")
  source: EventSource! @default(value: WEBHOOK)
  eventType: EventType! @col(name: "event_type")
  isDuplicatePunch: Boolean! @col(name: "is_duplicate_punch") @default(value: false)
  mispunchType: String? @col(name: "mispunch_type")
  mispunchReason: String? @col(name: "mispunch_reason")
  manualNotes: String? @col(name: "manual_notes")
  isManual: Boolean! @col(name: "is_manual") @default(value: false)
  createdAt: Timestamp! @default(expr: "now()")
}

enum BusinessPlan {
  BASIC
  PREMIUM
  ENTERPRISE
}

enum BusinessStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum AttendanceStatus {
  IN
  OUT
}

enum EventType {
  CHECKIN
  CHECKOUT
  BREAK_OUT
  BREAK_IN
}

enum EventSource {
  WEBHOOK
  SYNC
  MANUAL
  IMPORT
}
```

## Migration Strategy

### Phase 1: Data Export from Firestore
```javascript
// Export current Firestore data
const exportFirestoreData = async () => {
  const businesses = [];
  const employees = [];
  const statuses = [];
  const events = [];
  
  // Export all businesses
  const businessesRef = collection(db, 'businesses');
  const businessSnapshot = await getDocs(businessesRef);
  
  for (const businessDoc of businessSnapshot.docs) {
    const businessData = businessDoc.data();
    const businessId = businessDoc.id;
    
    businesses.push({
      id: businessId,
      businessName: businessData.businessName,
      email: businessData.email,
      plan: businessData.plan?.toUpperCase() || 'BASIC',
      slotsAllowed: businessData.slotsAllowed || 6,
      status: businessData.status?.toUpperCase() || 'ACTIVE',
      deviceId: businessData.deviceId,
      createdAt: businessData.createdAt || new Date().toISOString(),
      updatedAt: businessData.updatedAt || new Date().toISOString()
    });
    
    // Export staff/employees
    const staffRef = collection(db, 'businesses', businessId, 'staff');
    const staffSnapshot = await getDocs(staffRef);
    
    for (const staffDoc of staffSnapshot.docs) {
      const staffData = staffDoc.data();
      employees.push({
        id: generateUUID(),
        businessId: businessId,
        slotId: parseInt(staffDoc.id),
        employeeId: staffData.employeeId || staffDoc.id,
        employeeName: staffData.employeeName || 'Unknown',
        badgeNumber: staffData.badgeNumber || staffDoc.id,
        active: staffData.active !== false,
        phone: staffData.phone,
        email: staffData.email,
        position: staffData.position,
        department: staffData.department,
        idNumber: staffData.idNumber,
        address: staffData.address,
        hireDate: staffData.hireDate,
        hourlyRate: staffData.hourlyRate,
        notes: staffData.notes,
        createdAt: staffData.createdAt || new Date().toISOString(),
        updatedAt: staffData.updatedAt || new Date().toISOString()
      });
    }
    
    // Export status
    const statusRef = collection(db, 'businesses', businessId, 'status');
    const statusSnapshot = await getDocs(statusRef);
    
    for (const statusDoc of statusSnapshot.docs) {
      const statusData = statusDoc.data();
      statuses.push({
        businessId: businessId,
        attendanceStatus: statusData.attendanceStatus?.toUpperCase() || 'OUT',
        lastClockStatus: statusData.lastClockStatus?.toUpperCase() || 'OUT',
        lastClockTime: statusData.lastClockTime,
        lastEventType: statusData.lastEventType?.toUpperCase() || 'CHECKOUT',
        deviceId: statusData.deviceId,
        updatedAt: statusData.updatedAt || new Date().toISOString()
      });
    }
    
    // Export attendance events
    const eventsRef = collection(db, 'businesses', businessId, 'attendance_events');
    const eventsSnapshot = await getDocs(eventsRef);
    
    for (const eventDoc of eventsSnapshot.docs) {
      const eventData = eventDoc.data();
      events.push({
        businessId: businessId,
        slotNumber: eventData.slotNumber || 1,
        timestamp: eventData.timestamp,
        attendanceStatus: eventData.attendanceStatus?.toUpperCase() || 'IN',
        eventDate: eventData.eventDate || eventData.timestamp?.split('T')[0],
        eventTime: eventData.eventTime || new Date(eventData.timestamp).toTimeString().split(' ')[0],
        deviceId: eventData.deviceId || 'unknown',
        verifyNo: eventData.verifyNo,
        source: eventData.source?.toUpperCase() || 'WEBHOOK',
        eventType: eventData.type?.toUpperCase() || 'CHECKIN',
        isDuplicatePunch: eventData.isDuplicatePunch || false,
        mispunchType: eventData.mispunchType,
        mispunchReason: eventData.mispunchReason,
        manualNotes: eventData.manualNotes,
        isManual: eventData.isManual || false,
        createdAt: eventData.recordedAt || eventData.timestamp
      });
    }
  }
  
  return { businesses, employees, statuses, events };
};
```

### Phase 2: Data Connect Setup
```bash
# Install Firebase CLI with Data Connect support
npm install -g firebase-tools@latest

# Initialize Data Connect in project
firebase init dataconnect

# Set up PostgreSQL instance
# This creates a Cloud SQL instance and configures Data Connect
firebase dataconnect:services:create --service-id=aiclock-service --location=us-central1
```

### Phase 3: Schema Deployment
```bash
# Deploy schema to Data Connect
firebase deploy --only dataconnect

# This will:
# 1. Create PostgreSQL tables based on GraphQL schema
# 2. Set up type-safe SDKs
# 3. Deploy GraphQL API endpoints
```

### Phase 4: Data Import to Data Connect
```javascript
// Import data using Data Connect Admin SDK
import { getDataConnect } from 'firebase-admin/data-connect';

const dc = getDataConnect({
  location: "us-central1",
  serviceId: "aiclock-service"
});

// Bulk import businesses
await dc.insertMany("Business", exportedData.businesses);

// Bulk import employees
await dc.insertMany("Employee", exportedData.employees);

// Bulk import attendance events
await dc.insertMany("AttendanceEvent", exportedData.events);

// Bulk import status records
await dc.insertMany("EmployeeStatus", exportedData.statuses);
```

## Generated Queries & Mutations

Data Connect will auto-generate:

### Queries
```graphql
# Get business with employees
query GetBusinessWithEmployees($businessId: UUID!) {
  business(id: $businessId) {
    id
    businessName
    plan
    employees {
      id
      employeeName
      slotId
      active
    }
  }
}

# Get employee attendance for month
query GetEmployeeAttendanceByMonth($employeeId: UUID!, $startDate: Date!, $endDate: Date!) {
  attendanceEvents(
    where: {
      employeeId: { eq: $employeeId }
      eventDate: { gte: $startDate, lte: $endDate }
    }
    orderBy: { timestamp: ASC }
  ) {
    id
    timestamp
    attendanceStatus
    eventDate
    eventTime
    deviceId
  }
}

# Get real-time status for business
query GetBusinessEmployeeStatus($businessId: UUID!) {
  employeeStatuses(where: { businessId: { eq: $businessId } }) {
    id
    employee {
      employeeName
      slotId
    }
    attendanceStatus
    lastClockTime
    lastEventType
  }
}

# Advanced analytics query
query GetAttendanceAnalytics($businessId: UUID!, $startDate: Date!, $endDate: Date!) {
  attendanceEvents(
    where: {
      businessId: { eq: $businessId }
      eventDate: { gte: $startDate, lte: $endDate }
    }
  ) {
    employee {
      id
      employeeName
      slotId
    }
    attendanceStatus
    eventDate
    timestamp
  }
}
```

### Mutations
```graphql
# Create attendance event (webhook)
mutation CreateAttendanceEvent($input: AttendanceEventInsertInput!) {
  attendanceEvent_insert(data: $input) {
    id
    timestamp
    attendanceStatus
  }
}

# Update employee status
mutation UpdateEmployeeStatus($input: EmployeeStatusUpsertInput!) {
  employeeStatus_upsert(data: $input) {
    id
    attendanceStatus
    lastClockTime
  }
}

# Bulk import attendance events
mutation BulkImportAttendanceEvents($events: [AttendanceEventInsertInput!]!) {
  attendanceEvent_insertMany(data: $events)
}
```

## Benefits After Migration

### 1. Enhanced Reporting Capabilities
```sql
-- Complex SQL queries for advanced analytics
SELECT 
  e.employee_name,
  COUNT(*) as days_worked,
  AVG(daily_hours.hours) as avg_daily_hours,
  SUM(daily_hours.hours) as total_hours
FROM employees e
JOIN (
  SELECT 
    employee_id,
    event_date,
    EXTRACT(EPOCH FROM (
      MAX(CASE WHEN attendance_status = 'OUT' THEN timestamp END) -
      MIN(CASE WHEN attendance_status = 'IN' THEN timestamp END)
    )) / 3600 as hours
  FROM attendance_events
  WHERE event_date BETWEEN '2026-01-01' AND '2026-01-31'
  GROUP BY employee_id, event_date
  HAVING MIN(CASE WHEN attendance_status = 'IN' THEN timestamp END) IS NOT NULL
     AND MAX(CASE WHEN attendance_status = 'OUT' THEN timestamp END) IS NOT NULL
) daily_hours ON e.id = daily_hours.employee_id
GROUP BY e.id, e.employee_name;
```

### 2. Type-Safe Development
```typescript
// Auto-generated TypeScript SDK
import { getGeneratedSDK } from '@firebase/data-connect';

const sdk = getGeneratedSDK();

// Fully typed operations
const businessData = await sdk.getBusinessWithEmployees({
  businessId: 'uuid-here'
});

// TypeScript knows exact structure
businessData.business?.employees.forEach(emp => {
  console.log(emp.employeeName); // Fully typed
});
```

### 3. Performance Improvements
- **Complex Joins**: Native SQL joins vs multiple Firestore queries
- **Indexing**: PostgreSQL advanced indexing for faster queries
- **Aggregations**: Native SQL aggregations vs client-side calculations
- **Vector Search**: AI-ready for future employee recognition features

## Migration Timeline

### Week 1: Setup & Schema Design
- [ ] Initialize Data Connect service
- [ ] Design and deploy GraphQL schema
- [ ] Set up local development environment

### Week 2: Data Export & Import
- [ ] Create Firestore export scripts
- [ ] Test data transformation logic
- [ ] Perform bulk import to Data Connect

### Week 3: Application Updates
- [ ] Update frontend to use generated SDKs
- [ ] Migrate Cloud Functions to use Data Connect
- [ ] Update webhook endpoints

### Week 4: Testing & Deployment
- [ ] End-to-end testing
- [ ] Performance validation
- [ ] Production deployment with fallback plan

## Cost Considerations

### Current Firestore Costs
- Document reads/writes
- Storage costs
- Function invocations

### Data Connect Costs
- Cloud SQL instance costs (compute + storage)
- Data Connect API calls
- Network egress

**Estimated**: Similar or lower costs due to more efficient querying and reduced function invocations.

## Risk Mitigation

1. **Parallel Running**: Keep both systems running during migration
2. **Data Validation**: Verify data integrity after import
3. **Rollback Plan**: Ability to switch back to Firestore if needed
4. **Gradual Migration**: Migrate modules one by one

## Next Steps

1. **Immediate**: Set up Data Connect service in Firebase console
2. **Phase 1**: Deploy schema and test with sample data
3. **Phase 2**: Create data export/import scripts
4. **Phase 3**: Update application code to use Data Connect SDKs

This migration will significantly enhance the AiClock system's capabilities, providing better performance, type safety, and advanced analytics capabilities while maintaining all existing functionality.