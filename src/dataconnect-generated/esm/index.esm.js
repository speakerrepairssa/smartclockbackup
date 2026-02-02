import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const AttendanceStatus = {
  IN: "IN",
  OUT: "OUT",
  BREAK: "BREAK",
  UNKNOWN: "UNKNOWN",
}

export const BusinessPlan = {
  FREE: "FREE",
  BASIC: "BASIC",
  PRO: "PRO",
  ENTERPRISE: "ENTERPRISE",
}

export const BusinessStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  TRIAL: "TRIAL",
  EXPIRED: "EXPIRED",
}

export const EventType = {
  CLOCK_IN: "CLOCK_IN",
  CLOCK_OUT: "CLOCK_OUT",
  BREAK_START: "BREAK_START",
  BREAK_END: "BREAK_END",
  MANUAL_IN: "MANUAL_IN",
  MANUAL_OUT: "MANUAL_OUT",
  SYSTEM_AUTO: "SYSTEM_AUTO",
}

export const connectorConfig = {
  connector: 'aiclock-connector',
  service: 'aiclock',
  location: 'us-central1'
};

export const createBusinessRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBusiness', inputVars);
}
createBusinessRef.operationName = 'CreateBusiness';

export function createBusiness(dcOrVars, vars) {
  return executeMutation(createBusinessRef(dcOrVars, vars));
}

export const updateBusinessRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBusiness', inputVars);
}
updateBusinessRef.operationName = 'UpdateBusiness';

export function updateBusiness(dcOrVars, vars) {
  return executeMutation(updateBusinessRef(dcOrVars, vars));
}

export const createEmployeeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateEmployee', inputVars);
}
createEmployeeRef.operationName = 'CreateEmployee';

export function createEmployee(dcOrVars, vars) {
  return executeMutation(createEmployeeRef(dcOrVars, vars));
}

export const updateEmployeeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateEmployee', inputVars);
}
updateEmployeeRef.operationName = 'UpdateEmployee';

export function updateEmployee(dcOrVars, vars) {
  return executeMutation(updateEmployeeRef(dcOrVars, vars));
}

export const createAttendanceEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAttendanceEvent', inputVars);
}
createAttendanceEventRef.operationName = 'CreateAttendanceEvent';

export function createAttendanceEvent(dcOrVars, vars) {
  return executeMutation(createAttendanceEventRef(dcOrVars, vars));
}

export const upsertEmployeeStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertEmployeeStatus', inputVars);
}
upsertEmployeeStatusRef.operationName = 'UpsertEmployeeStatus';

export function upsertEmployeeStatus(dcOrVars, vars) {
  return executeMutation(upsertEmployeeStatusRef(dcOrVars, vars));
}

export const getBusinessRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBusiness', inputVars);
}
getBusinessRef.operationName = 'GetBusiness';

export function getBusiness(dcOrVars, vars) {
  return executeQuery(getBusinessRef(dcOrVars, vars));
}

export const getBusinessWithEmployeesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBusinessWithEmployees', inputVars);
}
getBusinessWithEmployeesRef.operationName = 'GetBusinessWithEmployees';

export function getBusinessWithEmployees(dcOrVars, vars) {
  return executeQuery(getBusinessWithEmployeesRef(dcOrVars, vars));
}

export const getEmployeeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEmployee', inputVars);
}
getEmployeeRef.operationName = 'GetEmployee';

export function getEmployee(dcOrVars, vars) {
  return executeQuery(getEmployeeRef(dcOrVars, vars));
}

export const getBusinessEmployeesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBusinessEmployees', inputVars);
}
getBusinessEmployeesRef.operationName = 'GetBusinessEmployees';

export function getBusinessEmployees(dcOrVars, vars) {
  return executeQuery(getBusinessEmployeesRef(dcOrVars, vars));
}

export const getActiveEmployeesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetActiveEmployees', inputVars);
}
getActiveEmployeesRef.operationName = 'GetActiveEmployees';

export function getActiveEmployees(dcOrVars, vars) {
  return executeQuery(getActiveEmployeesRef(dcOrVars, vars));
}

export const getEmployeeStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEmployeeStatus', inputVars);
}
getEmployeeStatusRef.operationName = 'GetEmployeeStatus';

export function getEmployeeStatus(dcOrVars, vars) {
  return executeQuery(getEmployeeStatusRef(dcOrVars, vars));
}

export const getEmployeeStatusesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEmployeeStatuses', inputVars);
}
getEmployeeStatusesRef.operationName = 'GetEmployeeStatuses';

export function getEmployeeStatuses(dcOrVars, vars) {
  return executeQuery(getEmployeeStatusesRef(dcOrVars, vars));
}

export const getAttendanceEventsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAttendanceEvents', inputVars);
}
getAttendanceEventsRef.operationName = 'GetAttendanceEvents';

export function getAttendanceEvents(dcOrVars, vars) {
  return executeQuery(getAttendanceEventsRef(dcOrVars, vars));
}

export const getEmployeeAttendanceEventsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEmployeeAttendanceEvents', inputVars);
}
getEmployeeAttendanceEventsRef.operationName = 'GetEmployeeAttendanceEvents';

export function getEmployeeAttendanceEvents(dcOrVars, vars) {
  return executeQuery(getEmployeeAttendanceEventsRef(dcOrVars, vars));
}

export const getAttendanceEventsByDateRangeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAttendanceEventsByDateRange', inputVars);
}
getAttendanceEventsByDateRangeRef.operationName = 'GetAttendanceEventsByDateRange';

export function getAttendanceEventsByDateRange(dcOrVars, vars) {
  return executeQuery(getAttendanceEventsByDateRangeRef(dcOrVars, vars));
}

export const getTodayAttendanceEventsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTodayAttendanceEvents', inputVars);
}
getTodayAttendanceEventsRef.operationName = 'GetTodayAttendanceEvents';

export function getTodayAttendanceEvents(dcOrVars, vars) {
  return executeQuery(getTodayAttendanceEventsRef(dcOrVars, vars));
}

export const getDashboardDataRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetDashboardData', inputVars);
}
getDashboardDataRef.operationName = 'GetDashboardData';

export function getDashboardData(dcOrVars, vars) {
  return executeQuery(getDashboardDataRef(dcOrVars, vars));
}

export const getBusinessStatsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBusinessStats', inputVars);
}
getBusinessStatsRef.operationName = 'GetBusinessStats';

export function getBusinessStats(dcOrVars, vars) {
  return executeQuery(getBusinessStatsRef(dcOrVars, vars));
}

