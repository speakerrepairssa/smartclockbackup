import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'device-connector',
  service: 'device-events',
  location: 'us-central1'
};

export const createDeviceEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateDeviceEvent', inputVars);
}
createDeviceEventRef.operationName = 'CreateDeviceEvent';

export function createDeviceEvent(dcOrVars, vars) {
  return executeMutation(createDeviceEventRef(dcOrVars, vars));
}

export const getDeviceEventsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetDeviceEvents', inputVars);
}
getDeviceEventsRef.operationName = 'GetDeviceEvents';

export function getDeviceEvents(dcOrVars, vars) {
  return executeQuery(getDeviceEventsRef(dcOrVars, vars));
}

