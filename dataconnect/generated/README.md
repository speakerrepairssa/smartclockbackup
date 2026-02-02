# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `device-connector`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetDeviceEvents*](#getdeviceevents)
- [**Mutations**](#mutations)
  - [*CreateDeviceEvent*](#createdeviceevent)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `device-connector`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@aiclock/device-events` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@aiclock/device-events';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@aiclock/device-events';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `device-connector` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetDeviceEvents
You can execute the `GetDeviceEvents` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getDeviceEvents(vars?: GetDeviceEventsVariables): QueryPromise<GetDeviceEventsData, GetDeviceEventsVariables>;

interface GetDeviceEventsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: GetDeviceEventsVariables): QueryRef<GetDeviceEventsData, GetDeviceEventsVariables>;
}
export const getDeviceEventsRef: GetDeviceEventsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getDeviceEvents(dc: DataConnect, vars?: GetDeviceEventsVariables): QueryPromise<GetDeviceEventsData, GetDeviceEventsVariables>;

interface GetDeviceEventsRef {
  ...
  (dc: DataConnect, vars?: GetDeviceEventsVariables): QueryRef<GetDeviceEventsData, GetDeviceEventsVariables>;
}
export const getDeviceEventsRef: GetDeviceEventsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getDeviceEventsRef:
```typescript
const name = getDeviceEventsRef.operationName;
console.log(name);
```

### Variables
The `GetDeviceEvents` query has an optional argument of type `GetDeviceEventsVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetDeviceEventsVariables {
  deviceId?: string | null;
}
```
### Return Type
Recall that executing the `GetDeviceEvents` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetDeviceEventsData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetDeviceEvents`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getDeviceEvents, GetDeviceEventsVariables } from '@aiclock/device-events';

// The `GetDeviceEvents` query has an optional argument of type `GetDeviceEventsVariables`:
const getDeviceEventsVars: GetDeviceEventsVariables = {
  deviceId: ..., // optional
};

// Call the `getDeviceEvents()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getDeviceEvents(getDeviceEventsVars);
// Variables can be defined inline as well.
const { data } = await getDeviceEvents({ deviceId: ..., });
// Since all variables are optional for this query, you can omit the `GetDeviceEventsVariables` argument.
const { data } = await getDeviceEvents();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getDeviceEvents(dataConnect, getDeviceEventsVars);

console.log(data.deviceEvents);

// Or, you can use the `Promise` API.
getDeviceEvents(getDeviceEventsVars).then((response) => {
  const data = response.data;
  console.log(data.deviceEvents);
});
```

### Using `GetDeviceEvents`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getDeviceEventsRef, GetDeviceEventsVariables } from '@aiclock/device-events';

// The `GetDeviceEvents` query has an optional argument of type `GetDeviceEventsVariables`:
const getDeviceEventsVars: GetDeviceEventsVariables = {
  deviceId: ..., // optional
};

// Call the `getDeviceEventsRef()` function to get a reference to the query.
const ref = getDeviceEventsRef(getDeviceEventsVars);
// Variables can be defined inline as well.
const ref = getDeviceEventsRef({ deviceId: ..., });
// Since all variables are optional for this query, you can omit the `GetDeviceEventsVariables` argument.
const ref = getDeviceEventsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getDeviceEventsRef(dataConnect, getDeviceEventsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.deviceEvents);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.deviceEvents);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `device-connector` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateDeviceEvent
You can execute the `CreateDeviceEvent` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
createDeviceEvent(vars: CreateDeviceEventVariables): MutationPromise<CreateDeviceEventData, CreateDeviceEventVariables>;

interface CreateDeviceEventRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDeviceEventVariables): MutationRef<CreateDeviceEventData, CreateDeviceEventVariables>;
}
export const createDeviceEventRef: CreateDeviceEventRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createDeviceEvent(dc: DataConnect, vars: CreateDeviceEventVariables): MutationPromise<CreateDeviceEventData, CreateDeviceEventVariables>;

interface CreateDeviceEventRef {
  ...
  (dc: DataConnect, vars: CreateDeviceEventVariables): MutationRef<CreateDeviceEventData, CreateDeviceEventVariables>;
}
export const createDeviceEventRef: CreateDeviceEventRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createDeviceEventRef:
```typescript
const name = createDeviceEventRef.operationName;
console.log(name);
```

### Variables
The `CreateDeviceEvent` mutation requires an argument of type `CreateDeviceEventVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `CreateDeviceEvent` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateDeviceEventData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateDeviceEventData {
  deviceEvent_insert: DeviceEvent_Key;
}
```
### Using `CreateDeviceEvent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createDeviceEvent, CreateDeviceEventVariables } from '@aiclock/device-events';

// The `CreateDeviceEvent` mutation requires an argument of type `CreateDeviceEventVariables`:
const createDeviceEventVars: CreateDeviceEventVariables = {
  deviceId: ..., 
  deviceName: ..., 
  deviceIp: ..., 
  eventType: ..., 
  timestamp: ..., 
  employeeId: ..., // optional
  confidence: ..., // optional
  metadata: ..., // optional
};

// Call the `createDeviceEvent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createDeviceEvent(createDeviceEventVars);
// Variables can be defined inline as well.
const { data } = await createDeviceEvent({ deviceId: ..., deviceName: ..., deviceIp: ..., eventType: ..., timestamp: ..., employeeId: ..., confidence: ..., metadata: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createDeviceEvent(dataConnect, createDeviceEventVars);

console.log(data.deviceEvent_insert);

// Or, you can use the `Promise` API.
createDeviceEvent(createDeviceEventVars).then((response) => {
  const data = response.data;
  console.log(data.deviceEvent_insert);
});
```

### Using `CreateDeviceEvent`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createDeviceEventRef, CreateDeviceEventVariables } from '@aiclock/device-events';

// The `CreateDeviceEvent` mutation requires an argument of type `CreateDeviceEventVariables`:
const createDeviceEventVars: CreateDeviceEventVariables = {
  deviceId: ..., 
  deviceName: ..., 
  deviceIp: ..., 
  eventType: ..., 
  timestamp: ..., 
  employeeId: ..., // optional
  confidence: ..., // optional
  metadata: ..., // optional
};

// Call the `createDeviceEventRef()` function to get a reference to the mutation.
const ref = createDeviceEventRef(createDeviceEventVars);
// Variables can be defined inline as well.
const ref = createDeviceEventRef({ deviceId: ..., deviceName: ..., deviceIp: ..., eventType: ..., timestamp: ..., employeeId: ..., confidence: ..., metadata: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createDeviceEventRef(dataConnect, createDeviceEventVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.deviceEvent_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.deviceEvent_insert);
});
```

