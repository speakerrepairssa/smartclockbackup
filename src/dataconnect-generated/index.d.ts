import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export enum AttendanceStatus {
  IN = "IN",
  OUT = "OUT",
  BREAK = "BREAK",
  UNKNOWN = "UNKNOWN",
};

export enum BusinessPlan {
  FREE = "FREE",
  BASIC = "BASIC",
  PRO = "PRO",
  ENTERPRISE = "ENTERPRISE",
};

export enum BusinessStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  TRIAL = "TRIAL",
  EXPIRED = "EXPIRED",
};

export enum EventType {
  CLOCK_IN = "CLOCK_IN",
  CLOCK_OUT = "CLOCK_OUT",
  BREAK_START = "BREAK_START",
  BREAK_END = "BREAK_END",
  MANUAL_IN = "MANUAL_IN",
  MANUAL_OUT = "MANUAL_OUT",
  SYSTEM_AUTO = "SYSTEM_AUTO",
};



export interface AttendanceEvent_Key {
  id: UUIDString;
  __typename?: 'AttendanceEvent_Key';
}

export interface Business_Key {
  id: UUIDString;
  __typename?: 'Business_Key';
}

export interface CreateAttendanceEventData {
  attendanceEvent_insert: AttendanceEvent_Key;
}

export interface CreateAttendanceEventVariables {
  id: UUIDString;
  businessId: UUIDString;
  employeeId: UUIDString;
  eventType: EventType;
  eventTime: TimestampString;
  deviceId?: string | null;
  confidence?: number | null;
}

export interface CreateBusinessData {
  business_insert: Business_Key;
}

export interface CreateBusinessVariables {
  id: UUIDString;
  businessName: string;
  email: string;
  plan: BusinessPlan;
  slotsAllowed: number;
}

export interface CreateEmployeeData {
  employee_insert: Employee_Key;
}

export interface CreateEmployeeVariables {
  id: UUIDString;
  businessId: UUIDString;
  slotId: number;
  employeeId: string;
  employeeName: string;
  badgeNumber: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
}

export interface EmployeeStatus_Key {
  id: UUIDString;
  __typename?: 'EmployeeStatus_Key';
}

export interface Employee_Key {
  id: UUIDString;
  __typename?: 'Employee_Key';
}

export interface GetActiveEmployeesData {
  employees: ({
    id: UUIDString;
    slotId: number;
    employeeName: string;
    badgeNumber: string;
    position?: string | null;
    email?: string | null;
    phone?: string | null;
  } & Employee_Key)[];
}

export interface GetActiveEmployeesVariables {
  businessId: UUIDString;
}

export interface GetAttendanceEventsByDateRangeData {
  attendanceEvents: ({
    id: UUIDString;
    employeeId: UUIDString;
    eventType: EventType;
    eventTime: TimestampString;
    deviceId?: string | null;
    confidence?: number | null;
    createdAt: TimestampString;
  } & AttendanceEvent_Key)[];
}

export interface GetAttendanceEventsByDateRangeVariables {
  businessId: UUIDString;
  startDate: TimestampString;
  endDate: TimestampString;
}

export interface GetAttendanceEventsData {
  attendanceEvents: ({
    id: UUIDString;
    businessId: UUIDString;
    employeeId: UUIDString;
    eventType: EventType;
    eventTime: TimestampString;
    deviceId?: string | null;
    confidence?: number | null;
    createdAt: TimestampString;
  } & AttendanceEvent_Key)[];
}

export interface GetAttendanceEventsVariables {
  businessId: UUIDString;
  limit?: number | null;
  offset?: number | null;
}

export interface GetBusinessData {
  business?: {
    id: UUIDString;
    businessName: string;
    email: string;
    plan: BusinessPlan;
    slotsAllowed: number;
    status: BusinessStatus;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Business_Key;
}

export interface GetBusinessEmployeesData {
  employees: ({
    id: UUIDString;
    slotId: number;
    employeeName: string;
    badgeNumber: string;
    active: boolean;
    position?: string | null;
    email?: string | null;
    phone?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Employee_Key)[];
}

export interface GetBusinessEmployeesVariables {
  businessId: UUIDString;
}

export interface GetBusinessStatsData {
  business?: {
    id: UUIDString;
    businessName: string;
    email: string;
    plan: BusinessPlan;
    slotsAllowed: number;
    status: BusinessStatus;
  } & Business_Key;
    totalEmployees: ({
      id: UUIDString;
    } & Employee_Key)[];
      activeEmployees: ({
        id: UUIDString;
      } & Employee_Key)[];
        currentlyIn: ({
          employeeId: UUIDString;
        })[];
}

export interface GetBusinessStatsVariables {
  businessId: UUIDString;
}

export interface GetBusinessVariables {
  businessId: UUIDString;
}

export interface GetBusinessWithEmployeesData {
  business?: {
    id: UUIDString;
    businessName: string;
    email: string;
    plan: BusinessPlan;
    slotsAllowed: number;
    status: BusinessStatus;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Business_Key;
    employees: ({
      id: UUIDString;
      slotId: number;
      employeeName: string;
      badgeNumber: string;
      active: boolean;
      position?: string | null;
      email?: string | null;
      phone?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
    } & Employee_Key)[];
}

export interface GetBusinessWithEmployeesVariables {
  businessId: UUIDString;
}

export interface GetDashboardDataData {
  business?: {
    id: UUIDString;
    businessName: string;
    plan: BusinessPlan;
    slotsAllowed: number;
  } & Business_Key;
    totalEmployees: ({
      id: UUIDString;
    } & Employee_Key)[];
      currentlyIn: ({
        employeeId: UUIDString;
      })[];
}

export interface GetDashboardDataVariables {
  businessId: UUIDString;
}

export interface GetEmployeeAttendanceEventsData {
  attendanceEvents: ({
    id: UUIDString;
    eventType: EventType;
    eventTime: TimestampString;
    deviceId?: string | null;
    confidence?: number | null;
    createdAt: TimestampString;
  } & AttendanceEvent_Key)[];
}

export interface GetEmployeeAttendanceEventsVariables {
  employeeId: UUIDString;
  limit?: number | null;
}

export interface GetEmployeeData {
  employee?: {
    id: UUIDString;
    businessId: UUIDString;
    slotId: number;
    employeeName: string;
    badgeNumber: string;
    active: boolean;
    position?: string | null;
    email?: string | null;
    phone?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Employee_Key;
}

export interface GetEmployeeStatusData {
  employeeStatuses: ({
    employeeId: UUIDString;
    attendanceStatus: AttendanceStatus;
    lastClockTime?: TimestampString | null;
    lastClockStatus: AttendanceStatus;
    lastEventType?: EventType | null;
    updatedAt: TimestampString;
  })[];
}

export interface GetEmployeeStatusVariables {
  employeeId: UUIDString;
}

export interface GetEmployeeStatusesData {
  employeeStatuses: ({
    employeeId: UUIDString;
    attendanceStatus: AttendanceStatus;
    lastClockTime?: TimestampString | null;
    lastClockStatus: AttendanceStatus;
    lastEventType?: EventType | null;
    updatedAt: TimestampString;
  })[];
}

export interface GetEmployeeStatusesVariables {
  businessId: UUIDString;
}

export interface GetEmployeeVariables {
  employeeId: UUIDString;
}

export interface GetTodayAttendanceEventsData {
  attendanceEvents: ({
    id: UUIDString;
    employeeId: UUIDString;
    eventType: EventType;
    eventTime: TimestampString;
    deviceId?: string | null;
    confidence?: number | null;
    createdAt: TimestampString;
  } & AttendanceEvent_Key)[];
}

export interface GetTodayAttendanceEventsVariables {
  businessId: UUIDString;
  startOfDay: TimestampString;
  endOfDay: TimestampString;
}

export interface UpdateBusinessData {
  business_update?: Business_Key | null;
}

export interface UpdateBusinessVariables {
  id: UUIDString;
  businessName?: string | null;
  email?: string | null;
  plan?: BusinessPlan | null;
  slotsAllowed?: number | null;
  status?: BusinessStatus | null;
}

export interface UpdateEmployeeData {
  employee_update?: Employee_Key | null;
}

export interface UpdateEmployeeVariables {
  id: UUIDString;
  employeeName?: string | null;
  badgeNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  active?: boolean | null;
}

export interface UpsertEmployeeStatusData {
  employeeStatus_upsert: EmployeeStatus_Key;
}

export interface UpsertEmployeeStatusVariables {
  id: UUIDString;
  businessId: UUIDString;
  employeeId: UUIDString;
  attendanceStatus: AttendanceStatus;
  lastClockTime: TimestampString;
  lastClockStatus: AttendanceStatus;
  lastEventType: EventType;
}

interface CreateBusinessRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateBusinessVariables): MutationRef<CreateBusinessData, CreateBusinessVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateBusinessVariables): MutationRef<CreateBusinessData, CreateBusinessVariables>;
  operationName: string;
}
export const createBusinessRef: CreateBusinessRef;

export function createBusiness(vars: CreateBusinessVariables): MutationPromise<CreateBusinessData, CreateBusinessVariables>;
export function createBusiness(dc: DataConnect, vars: CreateBusinessVariables): MutationPromise<CreateBusinessData, CreateBusinessVariables>;

interface UpdateBusinessRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateBusinessVariables): MutationRef<UpdateBusinessData, UpdateBusinessVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateBusinessVariables): MutationRef<UpdateBusinessData, UpdateBusinessVariables>;
  operationName: string;
}
export const updateBusinessRef: UpdateBusinessRef;

export function updateBusiness(vars: UpdateBusinessVariables): MutationPromise<UpdateBusinessData, UpdateBusinessVariables>;
export function updateBusiness(dc: DataConnect, vars: UpdateBusinessVariables): MutationPromise<UpdateBusinessData, UpdateBusinessVariables>;

interface CreateEmployeeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateEmployeeVariables): MutationRef<CreateEmployeeData, CreateEmployeeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateEmployeeVariables): MutationRef<CreateEmployeeData, CreateEmployeeVariables>;
  operationName: string;
}
export const createEmployeeRef: CreateEmployeeRef;

export function createEmployee(vars: CreateEmployeeVariables): MutationPromise<CreateEmployeeData, CreateEmployeeVariables>;
export function createEmployee(dc: DataConnect, vars: CreateEmployeeVariables): MutationPromise<CreateEmployeeData, CreateEmployeeVariables>;

interface UpdateEmployeeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateEmployeeVariables): MutationRef<UpdateEmployeeData, UpdateEmployeeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateEmployeeVariables): MutationRef<UpdateEmployeeData, UpdateEmployeeVariables>;
  operationName: string;
}
export const updateEmployeeRef: UpdateEmployeeRef;

export function updateEmployee(vars: UpdateEmployeeVariables): MutationPromise<UpdateEmployeeData, UpdateEmployeeVariables>;
export function updateEmployee(dc: DataConnect, vars: UpdateEmployeeVariables): MutationPromise<UpdateEmployeeData, UpdateEmployeeVariables>;

interface CreateAttendanceEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAttendanceEventVariables): MutationRef<CreateAttendanceEventData, CreateAttendanceEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAttendanceEventVariables): MutationRef<CreateAttendanceEventData, CreateAttendanceEventVariables>;
  operationName: string;
}
export const createAttendanceEventRef: CreateAttendanceEventRef;

export function createAttendanceEvent(vars: CreateAttendanceEventVariables): MutationPromise<CreateAttendanceEventData, CreateAttendanceEventVariables>;
export function createAttendanceEvent(dc: DataConnect, vars: CreateAttendanceEventVariables): MutationPromise<CreateAttendanceEventData, CreateAttendanceEventVariables>;

interface UpsertEmployeeStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertEmployeeStatusVariables): MutationRef<UpsertEmployeeStatusData, UpsertEmployeeStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertEmployeeStatusVariables): MutationRef<UpsertEmployeeStatusData, UpsertEmployeeStatusVariables>;
  operationName: string;
}
export const upsertEmployeeStatusRef: UpsertEmployeeStatusRef;

export function upsertEmployeeStatus(vars: UpsertEmployeeStatusVariables): MutationPromise<UpsertEmployeeStatusData, UpsertEmployeeStatusVariables>;
export function upsertEmployeeStatus(dc: DataConnect, vars: UpsertEmployeeStatusVariables): MutationPromise<UpsertEmployeeStatusData, UpsertEmployeeStatusVariables>;

interface GetBusinessRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBusinessVariables): QueryRef<GetBusinessData, GetBusinessVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetBusinessVariables): QueryRef<GetBusinessData, GetBusinessVariables>;
  operationName: string;
}
export const getBusinessRef: GetBusinessRef;

export function getBusiness(vars: GetBusinessVariables): QueryPromise<GetBusinessData, GetBusinessVariables>;
export function getBusiness(dc: DataConnect, vars: GetBusinessVariables): QueryPromise<GetBusinessData, GetBusinessVariables>;

interface GetBusinessWithEmployeesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBusinessWithEmployeesVariables): QueryRef<GetBusinessWithEmployeesData, GetBusinessWithEmployeesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetBusinessWithEmployeesVariables): QueryRef<GetBusinessWithEmployeesData, GetBusinessWithEmployeesVariables>;
  operationName: string;
}
export const getBusinessWithEmployeesRef: GetBusinessWithEmployeesRef;

export function getBusinessWithEmployees(vars: GetBusinessWithEmployeesVariables): QueryPromise<GetBusinessWithEmployeesData, GetBusinessWithEmployeesVariables>;
export function getBusinessWithEmployees(dc: DataConnect, vars: GetBusinessWithEmployeesVariables): QueryPromise<GetBusinessWithEmployeesData, GetBusinessWithEmployeesVariables>;

interface GetEmployeeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEmployeeVariables): QueryRef<GetEmployeeData, GetEmployeeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetEmployeeVariables): QueryRef<GetEmployeeData, GetEmployeeVariables>;
  operationName: string;
}
export const getEmployeeRef: GetEmployeeRef;

export function getEmployee(vars: GetEmployeeVariables): QueryPromise<GetEmployeeData, GetEmployeeVariables>;
export function getEmployee(dc: DataConnect, vars: GetEmployeeVariables): QueryPromise<GetEmployeeData, GetEmployeeVariables>;

interface GetBusinessEmployeesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBusinessEmployeesVariables): QueryRef<GetBusinessEmployeesData, GetBusinessEmployeesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetBusinessEmployeesVariables): QueryRef<GetBusinessEmployeesData, GetBusinessEmployeesVariables>;
  operationName: string;
}
export const getBusinessEmployeesRef: GetBusinessEmployeesRef;

export function getBusinessEmployees(vars: GetBusinessEmployeesVariables): QueryPromise<GetBusinessEmployeesData, GetBusinessEmployeesVariables>;
export function getBusinessEmployees(dc: DataConnect, vars: GetBusinessEmployeesVariables): QueryPromise<GetBusinessEmployeesData, GetBusinessEmployeesVariables>;

interface GetActiveEmployeesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetActiveEmployeesVariables): QueryRef<GetActiveEmployeesData, GetActiveEmployeesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetActiveEmployeesVariables): QueryRef<GetActiveEmployeesData, GetActiveEmployeesVariables>;
  operationName: string;
}
export const getActiveEmployeesRef: GetActiveEmployeesRef;

export function getActiveEmployees(vars: GetActiveEmployeesVariables): QueryPromise<GetActiveEmployeesData, GetActiveEmployeesVariables>;
export function getActiveEmployees(dc: DataConnect, vars: GetActiveEmployeesVariables): QueryPromise<GetActiveEmployeesData, GetActiveEmployeesVariables>;

interface GetEmployeeStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEmployeeStatusVariables): QueryRef<GetEmployeeStatusData, GetEmployeeStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetEmployeeStatusVariables): QueryRef<GetEmployeeStatusData, GetEmployeeStatusVariables>;
  operationName: string;
}
export const getEmployeeStatusRef: GetEmployeeStatusRef;

export function getEmployeeStatus(vars: GetEmployeeStatusVariables): QueryPromise<GetEmployeeStatusData, GetEmployeeStatusVariables>;
export function getEmployeeStatus(dc: DataConnect, vars: GetEmployeeStatusVariables): QueryPromise<GetEmployeeStatusData, GetEmployeeStatusVariables>;

interface GetEmployeeStatusesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEmployeeStatusesVariables): QueryRef<GetEmployeeStatusesData, GetEmployeeStatusesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetEmployeeStatusesVariables): QueryRef<GetEmployeeStatusesData, GetEmployeeStatusesVariables>;
  operationName: string;
}
export const getEmployeeStatusesRef: GetEmployeeStatusesRef;

export function getEmployeeStatuses(vars: GetEmployeeStatusesVariables): QueryPromise<GetEmployeeStatusesData, GetEmployeeStatusesVariables>;
export function getEmployeeStatuses(dc: DataConnect, vars: GetEmployeeStatusesVariables): QueryPromise<GetEmployeeStatusesData, GetEmployeeStatusesVariables>;

interface GetAttendanceEventsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAttendanceEventsVariables): QueryRef<GetAttendanceEventsData, GetAttendanceEventsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetAttendanceEventsVariables): QueryRef<GetAttendanceEventsData, GetAttendanceEventsVariables>;
  operationName: string;
}
export const getAttendanceEventsRef: GetAttendanceEventsRef;

export function getAttendanceEvents(vars: GetAttendanceEventsVariables): QueryPromise<GetAttendanceEventsData, GetAttendanceEventsVariables>;
export function getAttendanceEvents(dc: DataConnect, vars: GetAttendanceEventsVariables): QueryPromise<GetAttendanceEventsData, GetAttendanceEventsVariables>;

interface GetEmployeeAttendanceEventsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEmployeeAttendanceEventsVariables): QueryRef<GetEmployeeAttendanceEventsData, GetEmployeeAttendanceEventsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetEmployeeAttendanceEventsVariables): QueryRef<GetEmployeeAttendanceEventsData, GetEmployeeAttendanceEventsVariables>;
  operationName: string;
}
export const getEmployeeAttendanceEventsRef: GetEmployeeAttendanceEventsRef;

export function getEmployeeAttendanceEvents(vars: GetEmployeeAttendanceEventsVariables): QueryPromise<GetEmployeeAttendanceEventsData, GetEmployeeAttendanceEventsVariables>;
export function getEmployeeAttendanceEvents(dc: DataConnect, vars: GetEmployeeAttendanceEventsVariables): QueryPromise<GetEmployeeAttendanceEventsData, GetEmployeeAttendanceEventsVariables>;

interface GetAttendanceEventsByDateRangeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAttendanceEventsByDateRangeVariables): QueryRef<GetAttendanceEventsByDateRangeData, GetAttendanceEventsByDateRangeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetAttendanceEventsByDateRangeVariables): QueryRef<GetAttendanceEventsByDateRangeData, GetAttendanceEventsByDateRangeVariables>;
  operationName: string;
}
export const getAttendanceEventsByDateRangeRef: GetAttendanceEventsByDateRangeRef;

export function getAttendanceEventsByDateRange(vars: GetAttendanceEventsByDateRangeVariables): QueryPromise<GetAttendanceEventsByDateRangeData, GetAttendanceEventsByDateRangeVariables>;
export function getAttendanceEventsByDateRange(dc: DataConnect, vars: GetAttendanceEventsByDateRangeVariables): QueryPromise<GetAttendanceEventsByDateRangeData, GetAttendanceEventsByDateRangeVariables>;

interface GetTodayAttendanceEventsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTodayAttendanceEventsVariables): QueryRef<GetTodayAttendanceEventsData, GetTodayAttendanceEventsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetTodayAttendanceEventsVariables): QueryRef<GetTodayAttendanceEventsData, GetTodayAttendanceEventsVariables>;
  operationName: string;
}
export const getTodayAttendanceEventsRef: GetTodayAttendanceEventsRef;

export function getTodayAttendanceEvents(vars: GetTodayAttendanceEventsVariables): QueryPromise<GetTodayAttendanceEventsData, GetTodayAttendanceEventsVariables>;
export function getTodayAttendanceEvents(dc: DataConnect, vars: GetTodayAttendanceEventsVariables): QueryPromise<GetTodayAttendanceEventsData, GetTodayAttendanceEventsVariables>;

interface GetDashboardDataRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetDashboardDataVariables): QueryRef<GetDashboardDataData, GetDashboardDataVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetDashboardDataVariables): QueryRef<GetDashboardDataData, GetDashboardDataVariables>;
  operationName: string;
}
export const getDashboardDataRef: GetDashboardDataRef;

export function getDashboardData(vars: GetDashboardDataVariables): QueryPromise<GetDashboardDataData, GetDashboardDataVariables>;
export function getDashboardData(dc: DataConnect, vars: GetDashboardDataVariables): QueryPromise<GetDashboardDataData, GetDashboardDataVariables>;

interface GetBusinessStatsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBusinessStatsVariables): QueryRef<GetBusinessStatsData, GetBusinessStatsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetBusinessStatsVariables): QueryRef<GetBusinessStatsData, GetBusinessStatsVariables>;
  operationName: string;
}
export const getBusinessStatsRef: GetBusinessStatsRef;

export function getBusinessStats(vars: GetBusinessStatsVariables): QueryPromise<GetBusinessStatsData, GetBusinessStatsVariables>;
export function getBusinessStats(dc: DataConnect, vars: GetBusinessStatsVariables): QueryPromise<GetBusinessStatsData, GetBusinessStatsVariables>;

