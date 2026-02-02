import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CreateDeviceEventData {
  deviceEvent_insert: DeviceEvent_Key;
}

export interface CreateDeviceEventVariables {
  deviceId: string;
  deviceName: string;
  deviceIp: string;
  eventType: string;
  timestamp: TimestampString;
  employeeId?: string | null;
  confidence?: number | null;
  metadata?: string | null;
}

export interface DeviceEvent_Key {
  id: UUIDString;
  __typename?: 'DeviceEvent_Key';
}

export interface GetDeviceEventsData {
  deviceEvents: ({
    id: UUIDString;
    deviceId: string;
    deviceName: string;
    deviceIp: string;
    eventType: string;
    timestamp: TimestampString;
    employeeId?: string | null;
    confidence?: number | null;
    metadata?: string | null;
    createdAt: TimestampString;
  } & DeviceEvent_Key)[];
}

export interface GetDeviceEventsVariables {
  deviceId?: string | null;
}

interface CreateDeviceEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDeviceEventVariables): MutationRef<CreateDeviceEventData, CreateDeviceEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateDeviceEventVariables): MutationRef<CreateDeviceEventData, CreateDeviceEventVariables>;
  operationName: string;
}
export const createDeviceEventRef: CreateDeviceEventRef;

export function createDeviceEvent(vars: CreateDeviceEventVariables): MutationPromise<CreateDeviceEventData, CreateDeviceEventVariables>;
export function createDeviceEvent(dc: DataConnect, vars: CreateDeviceEventVariables): MutationPromise<CreateDeviceEventData, CreateDeviceEventVariables>;

interface GetDeviceEventsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: GetDeviceEventsVariables): QueryRef<GetDeviceEventsData, GetDeviceEventsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: GetDeviceEventsVariables): QueryRef<GetDeviceEventsData, GetDeviceEventsVariables>;
  operationName: string;
}
export const getDeviceEventsRef: GetDeviceEventsRef;

export function getDeviceEvents(vars?: GetDeviceEventsVariables): QueryPromise<GetDeviceEventsData, GetDeviceEventsVariables>;
export function getDeviceEvents(dc: DataConnect, vars?: GetDeviceEventsVariables): QueryPromise<GetDeviceEventsData, GetDeviceEventsVariables>;

