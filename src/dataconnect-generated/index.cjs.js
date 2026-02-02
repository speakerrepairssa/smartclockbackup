const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const AttendanceStatus = {
  IN: "IN",
  OUT: "OUT",
  BREAK: "BREAK",
  UNKNOWN: "UNKNOWN",
}
exports.AttendanceStatus = AttendanceStatus;

const BusinessPlan = {
  FREE: "FREE",
  BASIC: "BASIC",
  PRO: "PRO",
  ENTERPRISE: "ENTERPRISE",
}
exports.BusinessPlan = BusinessPlan;

const BusinessStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  TRIAL: "TRIAL",
  EXPIRED: "EXPIRED",
}
exports.BusinessStatus = BusinessStatus;

const EventType = {
  CLOCK_IN: "CLOCK_IN",
  CLOCK_OUT: "CLOCK_OUT",
  BREAK_START: "BREAK_START",
  BREAK_END: "BREAK_END",
  MANUAL_IN: "MANUAL_IN",
  MANUAL_OUT: "MANUAL_OUT",
  SYSTEM_AUTO: "SYSTEM_AUTO",
}
exports.EventType = EventType;

const connectorConfig = {
  connector: 'aiclock-connector',
  service: 'aiclock',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

const createBusinessRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBusiness', inputVars);
}
createBusinessRef.operationName = 'CreateBusiness';
exports.createBusinessRef = createBusinessRef;

exports.createBusiness = function createBusiness(dcOrVars, vars) {
  return executeMutation(createBusinessRef(dcOrVars, vars));
};

const updateBusinessRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBusiness', inputVars);
}
updateBusinessRef.operationName = 'UpdateBusiness';
exports.updateBusinessRef = updateBusinessRef;

exports.updateBusiness = function updateBusiness(dcOrVars, vars) {
  return executeMutation(updateBusinessRef(dcOrVars, vars));
};

const createEmployeeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateEmployee', inputVars);
}
createEmployeeRef.operationName = 'CreateEmployee';
exports.createEmployeeRef = createEmployeeRef;

exports.createEmployee = function createEmployee(dcOrVars, vars) {
  return executeMutation(createEmployeeRef(dcOrVars, vars));
};

const updateEmployeeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateEmployee', inputVars);
}
updateEmployeeRef.operationName = 'UpdateEmployee';
exports.updateEmployeeRef = updateEmployeeRef;

exports.updateEmployee = function updateEmployee(dcOrVars, vars) {
  return executeMutation(updateEmployeeRef(dcOrVars, vars));
};

const createAttendanceEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAttendanceEvent', inputVars);
}
createAttendanceEventRef.operationName = 'CreateAttendanceEvent';
exports.createAttendanceEventRef = createAttendanceEventRef;

exports.createAttendanceEvent = function createAttendanceEvent(dcOrVars, vars) {
  return executeMutation(createAttendanceEventRef(dcOrVars, vars));
};

const upsertEmployeeStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertEmployeeStatus', inputVars);
}
upsertEmployeeStatusRef.operationName = 'UpsertEmployeeStatus';
exports.upsertEmployeeStatusRef = upsertEmployeeStatusRef;

exports.upsertEmployeeStatus = function upsertEmployeeStatus(dcOrVars, vars) {
  return executeMutation(upsertEmployeeStatusRef(dcOrVars, vars));
};

const getBusinessRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBusiness', inputVars);
}
getBusinessRef.operationName = 'GetBusiness';
exports.getBusinessRef = getBusinessRef;

exports.getBusiness = function getBusiness(dcOrVars, vars) {
  return executeQuery(getBusinessRef(dcOrVars, vars));
};

const getBusinessWithEmployeesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBusinessWithEmployees', inputVars);
}
getBusinessWithEmployeesRef.operationName = 'GetBusinessWithEmployees';
exports.getBusinessWithEmployeesRef = getBusinessWithEmployeesRef;

exports.getBusinessWithEmployees = function getBusinessWithEmployees(dcOrVars, vars) {
  return executeQuery(getBusinessWithEmployeesRef(dcOrVars, vars));
};

const getEmployeeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEmployee', inputVars);
}
getEmployeeRef.operationName = 'GetEmployee';
exports.getEmployeeRef = getEmployeeRef;

exports.getEmployee = function getEmployee(dcOrVars, vars) {
  return executeQuery(getEmployeeRef(dcOrVars, vars));
};

const getBusinessEmployeesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBusinessEmployees', inputVars);
}
getBusinessEmployeesRef.operationName = 'GetBusinessEmployees';
exports.getBusinessEmployeesRef = getBusinessEmployeesRef;

exports.getBusinessEmployees = function getBusinessEmployees(dcOrVars, vars) {
  return executeQuery(getBusinessEmployeesRef(dcOrVars, vars));
};

const getActiveEmployeesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetActiveEmployees', inputVars);
}
getActiveEmployeesRef.operationName = 'GetActiveEmployees';
exports.getActiveEmployeesRef = getActiveEmployeesRef;

exports.getActiveEmployees = function getActiveEmployees(dcOrVars, vars) {
  return executeQuery(getActiveEmployeesRef(dcOrVars, vars));
};

const getEmployeeStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEmployeeStatus', inputVars);
}
getEmployeeStatusRef.operationName = 'GetEmployeeStatus';
exports.getEmployeeStatusRef = getEmployeeStatusRef;

exports.getEmployeeStatus = function getEmployeeStatus(dcOrVars, vars) {
  return executeQuery(getEmployeeStatusRef(dcOrVars, vars));
};

const getEmployeeStatusesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEmployeeStatuses', inputVars);
}
getEmployeeStatusesRef.operationName = 'GetEmployeeStatuses';
exports.getEmployeeStatusesRef = getEmployeeStatusesRef;

exports.getEmployeeStatuses = function getEmployeeStatuses(dcOrVars, vars) {
  return executeQuery(getEmployeeStatusesRef(dcOrVars, vars));
};

const getAttendanceEventsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAttendanceEvents', inputVars);
}
getAttendanceEventsRef.operationName = 'GetAttendanceEvents';
exports.getAttendanceEventsRef = getAttendanceEventsRef;

exports.getAttendanceEvents = function getAttendanceEvents(dcOrVars, vars) {
  return executeQuery(getAttendanceEventsRef(dcOrVars, vars));
};

const getEmployeeAttendanceEventsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEmployeeAttendanceEvents', inputVars);
}
getEmployeeAttendanceEventsRef.operationName = 'GetEmployeeAttendanceEvents';
exports.getEmployeeAttendanceEventsRef = getEmployeeAttendanceEventsRef;

exports.getEmployeeAttendanceEvents = function getEmployeeAttendanceEvents(dcOrVars, vars) {
  return executeQuery(getEmployeeAttendanceEventsRef(dcOrVars, vars));
};

const getAttendanceEventsByDateRangeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAttendanceEventsByDateRange', inputVars);
}
getAttendanceEventsByDateRangeRef.operationName = 'GetAttendanceEventsByDateRange';
exports.getAttendanceEventsByDateRangeRef = getAttendanceEventsByDateRangeRef;

exports.getAttendanceEventsByDateRange = function getAttendanceEventsByDateRange(dcOrVars, vars) {
  return executeQuery(getAttendanceEventsByDateRangeRef(dcOrVars, vars));
};

const getTodayAttendanceEventsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTodayAttendanceEvents', inputVars);
}
getTodayAttendanceEventsRef.operationName = 'GetTodayAttendanceEvents';
exports.getTodayAttendanceEventsRef = getTodayAttendanceEventsRef;

exports.getTodayAttendanceEvents = function getTodayAttendanceEvents(dcOrVars, vars) {
  return executeQuery(getTodayAttendanceEventsRef(dcOrVars, vars));
};

const getDashboardDataRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetDashboardData', inputVars);
}
getDashboardDataRef.operationName = 'GetDashboardData';
exports.getDashboardDataRef = getDashboardDataRef;

exports.getDashboardData = function getDashboardData(dcOrVars, vars) {
  return executeQuery(getDashboardDataRef(dcOrVars, vars));
};

const getBusinessStatsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBusinessStats', inputVars);
}
getBusinessStatsRef.operationName = 'GetBusinessStats';
exports.getBusinessStatsRef = getBusinessStatsRef;

exports.getBusinessStats = function getBusinessStats(dcOrVars, vars) {
  return executeQuery(getBusinessStatsRef(dcOrVars, vars));
};
