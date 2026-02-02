const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'device-connector',
  service: 'device-events',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

const createDeviceEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateDeviceEvent', inputVars);
}
createDeviceEventRef.operationName = 'CreateDeviceEvent';
exports.createDeviceEventRef = createDeviceEventRef;

exports.createDeviceEvent = function createDeviceEvent(dcOrVars, vars) {
  return executeMutation(createDeviceEventRef(dcOrVars, vars));
};

const getDeviceEventsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetDeviceEvents', inputVars);
}
getDeviceEventsRef.operationName = 'GetDeviceEvents';
exports.getDeviceEventsRef = getDeviceEventsRef;

exports.getDeviceEvents = function getDeviceEvents(dcOrVars, vars) {
  return executeQuery(getDeviceEventsRef(dcOrVars, vars));
};
