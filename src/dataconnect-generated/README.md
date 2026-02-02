# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `aiclock-connector`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetBusiness*](#getbusiness)
  - [*GetBusinessWithEmployees*](#getbusinesswithemployees)
  - [*GetEmployee*](#getemployee)
  - [*GetBusinessEmployees*](#getbusinessemployees)
  - [*GetActiveEmployees*](#getactiveemployees)
  - [*GetEmployeeStatus*](#getemployeestatus)
  - [*GetEmployeeStatuses*](#getemployeestatuses)
  - [*GetAttendanceEvents*](#getattendanceevents)
  - [*GetEmployeeAttendanceEvents*](#getemployeeattendanceevents)
  - [*GetAttendanceEventsByDateRange*](#getattendanceeventsbydaterange)
  - [*GetTodayAttendanceEvents*](#gettodayattendanceevents)
  - [*GetDashboardData*](#getdashboarddata)
  - [*GetBusinessStats*](#getbusinessstats)
- [**Mutations**](#mutations)
  - [*CreateBusiness*](#createbusiness)
  - [*UpdateBusiness*](#updatebusiness)
  - [*CreateEmployee*](#createemployee)
  - [*UpdateEmployee*](#updateemployee)
  - [*CreateAttendanceEvent*](#createattendanceevent)
  - [*UpsertEmployeeStatus*](#upsertemployeestatus)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `aiclock-connector`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@aiclock/dataconnect` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@aiclock/dataconnect';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@aiclock/dataconnect';

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

Below are examples of how to use the `aiclock-connector` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetBusiness
You can execute the `GetBusiness` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getBusiness(vars: GetBusinessVariables): QueryPromise<GetBusinessData, GetBusinessVariables>;

interface GetBusinessRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBusinessVariables): QueryRef<GetBusinessData, GetBusinessVariables>;
}
export const getBusinessRef: GetBusinessRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getBusiness(dc: DataConnect, vars: GetBusinessVariables): QueryPromise<GetBusinessData, GetBusinessVariables>;

interface GetBusinessRef {
  ...
  (dc: DataConnect, vars: GetBusinessVariables): QueryRef<GetBusinessData, GetBusinessVariables>;
}
export const getBusinessRef: GetBusinessRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getBusinessRef:
```typescript
const name = getBusinessRef.operationName;
console.log(name);
```

### Variables
The `GetBusiness` query requires an argument of type `GetBusinessVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetBusinessVariables {
  businessId: UUIDString;
}
```
### Return Type
Recall that executing the `GetBusiness` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetBusinessData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetBusiness`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getBusiness, GetBusinessVariables } from '@aiclock/dataconnect';

// The `GetBusiness` query requires an argument of type `GetBusinessVariables`:
const getBusinessVars: GetBusinessVariables = {
  businessId: ..., 
};

// Call the `getBusiness()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getBusiness(getBusinessVars);
// Variables can be defined inline as well.
const { data } = await getBusiness({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getBusiness(dataConnect, getBusinessVars);

console.log(data.business);

// Or, you can use the `Promise` API.
getBusiness(getBusinessVars).then((response) => {
  const data = response.data;
  console.log(data.business);
});
```

### Using `GetBusiness`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getBusinessRef, GetBusinessVariables } from '@aiclock/dataconnect';

// The `GetBusiness` query requires an argument of type `GetBusinessVariables`:
const getBusinessVars: GetBusinessVariables = {
  businessId: ..., 
};

// Call the `getBusinessRef()` function to get a reference to the query.
const ref = getBusinessRef(getBusinessVars);
// Variables can be defined inline as well.
const ref = getBusinessRef({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getBusinessRef(dataConnect, getBusinessVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.business);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.business);
});
```

## GetBusinessWithEmployees
You can execute the `GetBusinessWithEmployees` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getBusinessWithEmployees(vars: GetBusinessWithEmployeesVariables): QueryPromise<GetBusinessWithEmployeesData, GetBusinessWithEmployeesVariables>;

interface GetBusinessWithEmployeesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBusinessWithEmployeesVariables): QueryRef<GetBusinessWithEmployeesData, GetBusinessWithEmployeesVariables>;
}
export const getBusinessWithEmployeesRef: GetBusinessWithEmployeesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getBusinessWithEmployees(dc: DataConnect, vars: GetBusinessWithEmployeesVariables): QueryPromise<GetBusinessWithEmployeesData, GetBusinessWithEmployeesVariables>;

interface GetBusinessWithEmployeesRef {
  ...
  (dc: DataConnect, vars: GetBusinessWithEmployeesVariables): QueryRef<GetBusinessWithEmployeesData, GetBusinessWithEmployeesVariables>;
}
export const getBusinessWithEmployeesRef: GetBusinessWithEmployeesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getBusinessWithEmployeesRef:
```typescript
const name = getBusinessWithEmployeesRef.operationName;
console.log(name);
```

### Variables
The `GetBusinessWithEmployees` query requires an argument of type `GetBusinessWithEmployeesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetBusinessWithEmployeesVariables {
  businessId: UUIDString;
}
```
### Return Type
Recall that executing the `GetBusinessWithEmployees` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetBusinessWithEmployeesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetBusinessWithEmployees`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getBusinessWithEmployees, GetBusinessWithEmployeesVariables } from '@aiclock/dataconnect';

// The `GetBusinessWithEmployees` query requires an argument of type `GetBusinessWithEmployeesVariables`:
const getBusinessWithEmployeesVars: GetBusinessWithEmployeesVariables = {
  businessId: ..., 
};

// Call the `getBusinessWithEmployees()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getBusinessWithEmployees(getBusinessWithEmployeesVars);
// Variables can be defined inline as well.
const { data } = await getBusinessWithEmployees({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getBusinessWithEmployees(dataConnect, getBusinessWithEmployeesVars);

console.log(data.business);
console.log(data.employees);

// Or, you can use the `Promise` API.
getBusinessWithEmployees(getBusinessWithEmployeesVars).then((response) => {
  const data = response.data;
  console.log(data.business);
  console.log(data.employees);
});
```

### Using `GetBusinessWithEmployees`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getBusinessWithEmployeesRef, GetBusinessWithEmployeesVariables } from '@aiclock/dataconnect';

// The `GetBusinessWithEmployees` query requires an argument of type `GetBusinessWithEmployeesVariables`:
const getBusinessWithEmployeesVars: GetBusinessWithEmployeesVariables = {
  businessId: ..., 
};

// Call the `getBusinessWithEmployeesRef()` function to get a reference to the query.
const ref = getBusinessWithEmployeesRef(getBusinessWithEmployeesVars);
// Variables can be defined inline as well.
const ref = getBusinessWithEmployeesRef({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getBusinessWithEmployeesRef(dataConnect, getBusinessWithEmployeesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.business);
console.log(data.employees);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.business);
  console.log(data.employees);
});
```

## GetEmployee
You can execute the `GetEmployee` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getEmployee(vars: GetEmployeeVariables): QueryPromise<GetEmployeeData, GetEmployeeVariables>;

interface GetEmployeeRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEmployeeVariables): QueryRef<GetEmployeeData, GetEmployeeVariables>;
}
export const getEmployeeRef: GetEmployeeRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getEmployee(dc: DataConnect, vars: GetEmployeeVariables): QueryPromise<GetEmployeeData, GetEmployeeVariables>;

interface GetEmployeeRef {
  ...
  (dc: DataConnect, vars: GetEmployeeVariables): QueryRef<GetEmployeeData, GetEmployeeVariables>;
}
export const getEmployeeRef: GetEmployeeRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getEmployeeRef:
```typescript
const name = getEmployeeRef.operationName;
console.log(name);
```

### Variables
The `GetEmployee` query requires an argument of type `GetEmployeeVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetEmployeeVariables {
  employeeId: UUIDString;
}
```
### Return Type
Recall that executing the `GetEmployee` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetEmployeeData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetEmployee`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getEmployee, GetEmployeeVariables } from '@aiclock/dataconnect';

// The `GetEmployee` query requires an argument of type `GetEmployeeVariables`:
const getEmployeeVars: GetEmployeeVariables = {
  employeeId: ..., 
};

// Call the `getEmployee()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getEmployee(getEmployeeVars);
// Variables can be defined inline as well.
const { data } = await getEmployee({ employeeId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getEmployee(dataConnect, getEmployeeVars);

console.log(data.employee);

// Or, you can use the `Promise` API.
getEmployee(getEmployeeVars).then((response) => {
  const data = response.data;
  console.log(data.employee);
});
```

### Using `GetEmployee`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getEmployeeRef, GetEmployeeVariables } from '@aiclock/dataconnect';

// The `GetEmployee` query requires an argument of type `GetEmployeeVariables`:
const getEmployeeVars: GetEmployeeVariables = {
  employeeId: ..., 
};

// Call the `getEmployeeRef()` function to get a reference to the query.
const ref = getEmployeeRef(getEmployeeVars);
// Variables can be defined inline as well.
const ref = getEmployeeRef({ employeeId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getEmployeeRef(dataConnect, getEmployeeVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.employee);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.employee);
});
```

## GetBusinessEmployees
You can execute the `GetBusinessEmployees` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getBusinessEmployees(vars: GetBusinessEmployeesVariables): QueryPromise<GetBusinessEmployeesData, GetBusinessEmployeesVariables>;

interface GetBusinessEmployeesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBusinessEmployeesVariables): QueryRef<GetBusinessEmployeesData, GetBusinessEmployeesVariables>;
}
export const getBusinessEmployeesRef: GetBusinessEmployeesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getBusinessEmployees(dc: DataConnect, vars: GetBusinessEmployeesVariables): QueryPromise<GetBusinessEmployeesData, GetBusinessEmployeesVariables>;

interface GetBusinessEmployeesRef {
  ...
  (dc: DataConnect, vars: GetBusinessEmployeesVariables): QueryRef<GetBusinessEmployeesData, GetBusinessEmployeesVariables>;
}
export const getBusinessEmployeesRef: GetBusinessEmployeesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getBusinessEmployeesRef:
```typescript
const name = getBusinessEmployeesRef.operationName;
console.log(name);
```

### Variables
The `GetBusinessEmployees` query requires an argument of type `GetBusinessEmployeesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetBusinessEmployeesVariables {
  businessId: UUIDString;
}
```
### Return Type
Recall that executing the `GetBusinessEmployees` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetBusinessEmployeesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetBusinessEmployees`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getBusinessEmployees, GetBusinessEmployeesVariables } from '@aiclock/dataconnect';

// The `GetBusinessEmployees` query requires an argument of type `GetBusinessEmployeesVariables`:
const getBusinessEmployeesVars: GetBusinessEmployeesVariables = {
  businessId: ..., 
};

// Call the `getBusinessEmployees()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getBusinessEmployees(getBusinessEmployeesVars);
// Variables can be defined inline as well.
const { data } = await getBusinessEmployees({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getBusinessEmployees(dataConnect, getBusinessEmployeesVars);

console.log(data.employees);

// Or, you can use the `Promise` API.
getBusinessEmployees(getBusinessEmployeesVars).then((response) => {
  const data = response.data;
  console.log(data.employees);
});
```

### Using `GetBusinessEmployees`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getBusinessEmployeesRef, GetBusinessEmployeesVariables } from '@aiclock/dataconnect';

// The `GetBusinessEmployees` query requires an argument of type `GetBusinessEmployeesVariables`:
const getBusinessEmployeesVars: GetBusinessEmployeesVariables = {
  businessId: ..., 
};

// Call the `getBusinessEmployeesRef()` function to get a reference to the query.
const ref = getBusinessEmployeesRef(getBusinessEmployeesVars);
// Variables can be defined inline as well.
const ref = getBusinessEmployeesRef({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getBusinessEmployeesRef(dataConnect, getBusinessEmployeesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.employees);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.employees);
});
```

## GetActiveEmployees
You can execute the `GetActiveEmployees` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getActiveEmployees(vars: GetActiveEmployeesVariables): QueryPromise<GetActiveEmployeesData, GetActiveEmployeesVariables>;

interface GetActiveEmployeesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetActiveEmployeesVariables): QueryRef<GetActiveEmployeesData, GetActiveEmployeesVariables>;
}
export const getActiveEmployeesRef: GetActiveEmployeesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getActiveEmployees(dc: DataConnect, vars: GetActiveEmployeesVariables): QueryPromise<GetActiveEmployeesData, GetActiveEmployeesVariables>;

interface GetActiveEmployeesRef {
  ...
  (dc: DataConnect, vars: GetActiveEmployeesVariables): QueryRef<GetActiveEmployeesData, GetActiveEmployeesVariables>;
}
export const getActiveEmployeesRef: GetActiveEmployeesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getActiveEmployeesRef:
```typescript
const name = getActiveEmployeesRef.operationName;
console.log(name);
```

### Variables
The `GetActiveEmployees` query requires an argument of type `GetActiveEmployeesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetActiveEmployeesVariables {
  businessId: UUIDString;
}
```
### Return Type
Recall that executing the `GetActiveEmployees` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetActiveEmployeesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetActiveEmployees`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getActiveEmployees, GetActiveEmployeesVariables } from '@aiclock/dataconnect';

// The `GetActiveEmployees` query requires an argument of type `GetActiveEmployeesVariables`:
const getActiveEmployeesVars: GetActiveEmployeesVariables = {
  businessId: ..., 
};

// Call the `getActiveEmployees()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getActiveEmployees(getActiveEmployeesVars);
// Variables can be defined inline as well.
const { data } = await getActiveEmployees({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getActiveEmployees(dataConnect, getActiveEmployeesVars);

console.log(data.employees);

// Or, you can use the `Promise` API.
getActiveEmployees(getActiveEmployeesVars).then((response) => {
  const data = response.data;
  console.log(data.employees);
});
```

### Using `GetActiveEmployees`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getActiveEmployeesRef, GetActiveEmployeesVariables } from '@aiclock/dataconnect';

// The `GetActiveEmployees` query requires an argument of type `GetActiveEmployeesVariables`:
const getActiveEmployeesVars: GetActiveEmployeesVariables = {
  businessId: ..., 
};

// Call the `getActiveEmployeesRef()` function to get a reference to the query.
const ref = getActiveEmployeesRef(getActiveEmployeesVars);
// Variables can be defined inline as well.
const ref = getActiveEmployeesRef({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getActiveEmployeesRef(dataConnect, getActiveEmployeesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.employees);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.employees);
});
```

## GetEmployeeStatus
You can execute the `GetEmployeeStatus` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getEmployeeStatus(vars: GetEmployeeStatusVariables): QueryPromise<GetEmployeeStatusData, GetEmployeeStatusVariables>;

interface GetEmployeeStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEmployeeStatusVariables): QueryRef<GetEmployeeStatusData, GetEmployeeStatusVariables>;
}
export const getEmployeeStatusRef: GetEmployeeStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getEmployeeStatus(dc: DataConnect, vars: GetEmployeeStatusVariables): QueryPromise<GetEmployeeStatusData, GetEmployeeStatusVariables>;

interface GetEmployeeStatusRef {
  ...
  (dc: DataConnect, vars: GetEmployeeStatusVariables): QueryRef<GetEmployeeStatusData, GetEmployeeStatusVariables>;
}
export const getEmployeeStatusRef: GetEmployeeStatusRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getEmployeeStatusRef:
```typescript
const name = getEmployeeStatusRef.operationName;
console.log(name);
```

### Variables
The `GetEmployeeStatus` query requires an argument of type `GetEmployeeStatusVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetEmployeeStatusVariables {
  employeeId: UUIDString;
}
```
### Return Type
Recall that executing the `GetEmployeeStatus` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetEmployeeStatusData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetEmployeeStatus`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getEmployeeStatus, GetEmployeeStatusVariables } from '@aiclock/dataconnect';

// The `GetEmployeeStatus` query requires an argument of type `GetEmployeeStatusVariables`:
const getEmployeeStatusVars: GetEmployeeStatusVariables = {
  employeeId: ..., 
};

// Call the `getEmployeeStatus()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getEmployeeStatus(getEmployeeStatusVars);
// Variables can be defined inline as well.
const { data } = await getEmployeeStatus({ employeeId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getEmployeeStatus(dataConnect, getEmployeeStatusVars);

console.log(data.employeeStatuses);

// Or, you can use the `Promise` API.
getEmployeeStatus(getEmployeeStatusVars).then((response) => {
  const data = response.data;
  console.log(data.employeeStatuses);
});
```

### Using `GetEmployeeStatus`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getEmployeeStatusRef, GetEmployeeStatusVariables } from '@aiclock/dataconnect';

// The `GetEmployeeStatus` query requires an argument of type `GetEmployeeStatusVariables`:
const getEmployeeStatusVars: GetEmployeeStatusVariables = {
  employeeId: ..., 
};

// Call the `getEmployeeStatusRef()` function to get a reference to the query.
const ref = getEmployeeStatusRef(getEmployeeStatusVars);
// Variables can be defined inline as well.
const ref = getEmployeeStatusRef({ employeeId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getEmployeeStatusRef(dataConnect, getEmployeeStatusVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.employeeStatuses);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.employeeStatuses);
});
```

## GetEmployeeStatuses
You can execute the `GetEmployeeStatuses` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getEmployeeStatuses(vars: GetEmployeeStatusesVariables): QueryPromise<GetEmployeeStatusesData, GetEmployeeStatusesVariables>;

interface GetEmployeeStatusesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEmployeeStatusesVariables): QueryRef<GetEmployeeStatusesData, GetEmployeeStatusesVariables>;
}
export const getEmployeeStatusesRef: GetEmployeeStatusesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getEmployeeStatuses(dc: DataConnect, vars: GetEmployeeStatusesVariables): QueryPromise<GetEmployeeStatusesData, GetEmployeeStatusesVariables>;

interface GetEmployeeStatusesRef {
  ...
  (dc: DataConnect, vars: GetEmployeeStatusesVariables): QueryRef<GetEmployeeStatusesData, GetEmployeeStatusesVariables>;
}
export const getEmployeeStatusesRef: GetEmployeeStatusesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getEmployeeStatusesRef:
```typescript
const name = getEmployeeStatusesRef.operationName;
console.log(name);
```

### Variables
The `GetEmployeeStatuses` query requires an argument of type `GetEmployeeStatusesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetEmployeeStatusesVariables {
  businessId: UUIDString;
}
```
### Return Type
Recall that executing the `GetEmployeeStatuses` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetEmployeeStatusesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetEmployeeStatuses`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getEmployeeStatuses, GetEmployeeStatusesVariables } from '@aiclock/dataconnect';

// The `GetEmployeeStatuses` query requires an argument of type `GetEmployeeStatusesVariables`:
const getEmployeeStatusesVars: GetEmployeeStatusesVariables = {
  businessId: ..., 
};

// Call the `getEmployeeStatuses()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getEmployeeStatuses(getEmployeeStatusesVars);
// Variables can be defined inline as well.
const { data } = await getEmployeeStatuses({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getEmployeeStatuses(dataConnect, getEmployeeStatusesVars);

console.log(data.employeeStatuses);

// Or, you can use the `Promise` API.
getEmployeeStatuses(getEmployeeStatusesVars).then((response) => {
  const data = response.data;
  console.log(data.employeeStatuses);
});
```

### Using `GetEmployeeStatuses`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getEmployeeStatusesRef, GetEmployeeStatusesVariables } from '@aiclock/dataconnect';

// The `GetEmployeeStatuses` query requires an argument of type `GetEmployeeStatusesVariables`:
const getEmployeeStatusesVars: GetEmployeeStatusesVariables = {
  businessId: ..., 
};

// Call the `getEmployeeStatusesRef()` function to get a reference to the query.
const ref = getEmployeeStatusesRef(getEmployeeStatusesVars);
// Variables can be defined inline as well.
const ref = getEmployeeStatusesRef({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getEmployeeStatusesRef(dataConnect, getEmployeeStatusesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.employeeStatuses);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.employeeStatuses);
});
```

## GetAttendanceEvents
You can execute the `GetAttendanceEvents` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getAttendanceEvents(vars: GetAttendanceEventsVariables): QueryPromise<GetAttendanceEventsData, GetAttendanceEventsVariables>;

interface GetAttendanceEventsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAttendanceEventsVariables): QueryRef<GetAttendanceEventsData, GetAttendanceEventsVariables>;
}
export const getAttendanceEventsRef: GetAttendanceEventsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getAttendanceEvents(dc: DataConnect, vars: GetAttendanceEventsVariables): QueryPromise<GetAttendanceEventsData, GetAttendanceEventsVariables>;

interface GetAttendanceEventsRef {
  ...
  (dc: DataConnect, vars: GetAttendanceEventsVariables): QueryRef<GetAttendanceEventsData, GetAttendanceEventsVariables>;
}
export const getAttendanceEventsRef: GetAttendanceEventsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getAttendanceEventsRef:
```typescript
const name = getAttendanceEventsRef.operationName;
console.log(name);
```

### Variables
The `GetAttendanceEvents` query requires an argument of type `GetAttendanceEventsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetAttendanceEventsVariables {
  businessId: UUIDString;
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `GetAttendanceEvents` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetAttendanceEventsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetAttendanceEvents`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getAttendanceEvents, GetAttendanceEventsVariables } from '@aiclock/dataconnect';

// The `GetAttendanceEvents` query requires an argument of type `GetAttendanceEventsVariables`:
const getAttendanceEventsVars: GetAttendanceEventsVariables = {
  businessId: ..., 
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `getAttendanceEvents()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getAttendanceEvents(getAttendanceEventsVars);
// Variables can be defined inline as well.
const { data } = await getAttendanceEvents({ businessId: ..., limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getAttendanceEvents(dataConnect, getAttendanceEventsVars);

console.log(data.attendanceEvents);

// Or, you can use the `Promise` API.
getAttendanceEvents(getAttendanceEventsVars).then((response) => {
  const data = response.data;
  console.log(data.attendanceEvents);
});
```

### Using `GetAttendanceEvents`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getAttendanceEventsRef, GetAttendanceEventsVariables } from '@aiclock/dataconnect';

// The `GetAttendanceEvents` query requires an argument of type `GetAttendanceEventsVariables`:
const getAttendanceEventsVars: GetAttendanceEventsVariables = {
  businessId: ..., 
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `getAttendanceEventsRef()` function to get a reference to the query.
const ref = getAttendanceEventsRef(getAttendanceEventsVars);
// Variables can be defined inline as well.
const ref = getAttendanceEventsRef({ businessId: ..., limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getAttendanceEventsRef(dataConnect, getAttendanceEventsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.attendanceEvents);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.attendanceEvents);
});
```

## GetEmployeeAttendanceEvents
You can execute the `GetEmployeeAttendanceEvents` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getEmployeeAttendanceEvents(vars: GetEmployeeAttendanceEventsVariables): QueryPromise<GetEmployeeAttendanceEventsData, GetEmployeeAttendanceEventsVariables>;

interface GetEmployeeAttendanceEventsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEmployeeAttendanceEventsVariables): QueryRef<GetEmployeeAttendanceEventsData, GetEmployeeAttendanceEventsVariables>;
}
export const getEmployeeAttendanceEventsRef: GetEmployeeAttendanceEventsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getEmployeeAttendanceEvents(dc: DataConnect, vars: GetEmployeeAttendanceEventsVariables): QueryPromise<GetEmployeeAttendanceEventsData, GetEmployeeAttendanceEventsVariables>;

interface GetEmployeeAttendanceEventsRef {
  ...
  (dc: DataConnect, vars: GetEmployeeAttendanceEventsVariables): QueryRef<GetEmployeeAttendanceEventsData, GetEmployeeAttendanceEventsVariables>;
}
export const getEmployeeAttendanceEventsRef: GetEmployeeAttendanceEventsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getEmployeeAttendanceEventsRef:
```typescript
const name = getEmployeeAttendanceEventsRef.operationName;
console.log(name);
```

### Variables
The `GetEmployeeAttendanceEvents` query requires an argument of type `GetEmployeeAttendanceEventsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetEmployeeAttendanceEventsVariables {
  employeeId: UUIDString;
  limit?: number | null;
}
```
### Return Type
Recall that executing the `GetEmployeeAttendanceEvents` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetEmployeeAttendanceEventsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetEmployeeAttendanceEvents`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getEmployeeAttendanceEvents, GetEmployeeAttendanceEventsVariables } from '@aiclock/dataconnect';

// The `GetEmployeeAttendanceEvents` query requires an argument of type `GetEmployeeAttendanceEventsVariables`:
const getEmployeeAttendanceEventsVars: GetEmployeeAttendanceEventsVariables = {
  employeeId: ..., 
  limit: ..., // optional
};

// Call the `getEmployeeAttendanceEvents()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getEmployeeAttendanceEvents(getEmployeeAttendanceEventsVars);
// Variables can be defined inline as well.
const { data } = await getEmployeeAttendanceEvents({ employeeId: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getEmployeeAttendanceEvents(dataConnect, getEmployeeAttendanceEventsVars);

console.log(data.attendanceEvents);

// Or, you can use the `Promise` API.
getEmployeeAttendanceEvents(getEmployeeAttendanceEventsVars).then((response) => {
  const data = response.data;
  console.log(data.attendanceEvents);
});
```

### Using `GetEmployeeAttendanceEvents`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getEmployeeAttendanceEventsRef, GetEmployeeAttendanceEventsVariables } from '@aiclock/dataconnect';

// The `GetEmployeeAttendanceEvents` query requires an argument of type `GetEmployeeAttendanceEventsVariables`:
const getEmployeeAttendanceEventsVars: GetEmployeeAttendanceEventsVariables = {
  employeeId: ..., 
  limit: ..., // optional
};

// Call the `getEmployeeAttendanceEventsRef()` function to get a reference to the query.
const ref = getEmployeeAttendanceEventsRef(getEmployeeAttendanceEventsVars);
// Variables can be defined inline as well.
const ref = getEmployeeAttendanceEventsRef({ employeeId: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getEmployeeAttendanceEventsRef(dataConnect, getEmployeeAttendanceEventsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.attendanceEvents);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.attendanceEvents);
});
```

## GetAttendanceEventsByDateRange
You can execute the `GetAttendanceEventsByDateRange` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getAttendanceEventsByDateRange(vars: GetAttendanceEventsByDateRangeVariables): QueryPromise<GetAttendanceEventsByDateRangeData, GetAttendanceEventsByDateRangeVariables>;

interface GetAttendanceEventsByDateRangeRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAttendanceEventsByDateRangeVariables): QueryRef<GetAttendanceEventsByDateRangeData, GetAttendanceEventsByDateRangeVariables>;
}
export const getAttendanceEventsByDateRangeRef: GetAttendanceEventsByDateRangeRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getAttendanceEventsByDateRange(dc: DataConnect, vars: GetAttendanceEventsByDateRangeVariables): QueryPromise<GetAttendanceEventsByDateRangeData, GetAttendanceEventsByDateRangeVariables>;

interface GetAttendanceEventsByDateRangeRef {
  ...
  (dc: DataConnect, vars: GetAttendanceEventsByDateRangeVariables): QueryRef<GetAttendanceEventsByDateRangeData, GetAttendanceEventsByDateRangeVariables>;
}
export const getAttendanceEventsByDateRangeRef: GetAttendanceEventsByDateRangeRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getAttendanceEventsByDateRangeRef:
```typescript
const name = getAttendanceEventsByDateRangeRef.operationName;
console.log(name);
```

### Variables
The `GetAttendanceEventsByDateRange` query requires an argument of type `GetAttendanceEventsByDateRangeVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetAttendanceEventsByDateRangeVariables {
  businessId: UUIDString;
  startDate: TimestampString;
  endDate: TimestampString;
}
```
### Return Type
Recall that executing the `GetAttendanceEventsByDateRange` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetAttendanceEventsByDateRangeData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetAttendanceEventsByDateRange`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getAttendanceEventsByDateRange, GetAttendanceEventsByDateRangeVariables } from '@aiclock/dataconnect';

// The `GetAttendanceEventsByDateRange` query requires an argument of type `GetAttendanceEventsByDateRangeVariables`:
const getAttendanceEventsByDateRangeVars: GetAttendanceEventsByDateRangeVariables = {
  businessId: ..., 
  startDate: ..., 
  endDate: ..., 
};

// Call the `getAttendanceEventsByDateRange()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getAttendanceEventsByDateRange(getAttendanceEventsByDateRangeVars);
// Variables can be defined inline as well.
const { data } = await getAttendanceEventsByDateRange({ businessId: ..., startDate: ..., endDate: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getAttendanceEventsByDateRange(dataConnect, getAttendanceEventsByDateRangeVars);

console.log(data.attendanceEvents);

// Or, you can use the `Promise` API.
getAttendanceEventsByDateRange(getAttendanceEventsByDateRangeVars).then((response) => {
  const data = response.data;
  console.log(data.attendanceEvents);
});
```

### Using `GetAttendanceEventsByDateRange`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getAttendanceEventsByDateRangeRef, GetAttendanceEventsByDateRangeVariables } from '@aiclock/dataconnect';

// The `GetAttendanceEventsByDateRange` query requires an argument of type `GetAttendanceEventsByDateRangeVariables`:
const getAttendanceEventsByDateRangeVars: GetAttendanceEventsByDateRangeVariables = {
  businessId: ..., 
  startDate: ..., 
  endDate: ..., 
};

// Call the `getAttendanceEventsByDateRangeRef()` function to get a reference to the query.
const ref = getAttendanceEventsByDateRangeRef(getAttendanceEventsByDateRangeVars);
// Variables can be defined inline as well.
const ref = getAttendanceEventsByDateRangeRef({ businessId: ..., startDate: ..., endDate: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getAttendanceEventsByDateRangeRef(dataConnect, getAttendanceEventsByDateRangeVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.attendanceEvents);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.attendanceEvents);
});
```

## GetTodayAttendanceEvents
You can execute the `GetTodayAttendanceEvents` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getTodayAttendanceEvents(vars: GetTodayAttendanceEventsVariables): QueryPromise<GetTodayAttendanceEventsData, GetTodayAttendanceEventsVariables>;

interface GetTodayAttendanceEventsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTodayAttendanceEventsVariables): QueryRef<GetTodayAttendanceEventsData, GetTodayAttendanceEventsVariables>;
}
export const getTodayAttendanceEventsRef: GetTodayAttendanceEventsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getTodayAttendanceEvents(dc: DataConnect, vars: GetTodayAttendanceEventsVariables): QueryPromise<GetTodayAttendanceEventsData, GetTodayAttendanceEventsVariables>;

interface GetTodayAttendanceEventsRef {
  ...
  (dc: DataConnect, vars: GetTodayAttendanceEventsVariables): QueryRef<GetTodayAttendanceEventsData, GetTodayAttendanceEventsVariables>;
}
export const getTodayAttendanceEventsRef: GetTodayAttendanceEventsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getTodayAttendanceEventsRef:
```typescript
const name = getTodayAttendanceEventsRef.operationName;
console.log(name);
```

### Variables
The `GetTodayAttendanceEvents` query requires an argument of type `GetTodayAttendanceEventsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetTodayAttendanceEventsVariables {
  businessId: UUIDString;
  startOfDay: TimestampString;
  endOfDay: TimestampString;
}
```
### Return Type
Recall that executing the `GetTodayAttendanceEvents` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetTodayAttendanceEventsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetTodayAttendanceEvents`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getTodayAttendanceEvents, GetTodayAttendanceEventsVariables } from '@aiclock/dataconnect';

// The `GetTodayAttendanceEvents` query requires an argument of type `GetTodayAttendanceEventsVariables`:
const getTodayAttendanceEventsVars: GetTodayAttendanceEventsVariables = {
  businessId: ..., 
  startOfDay: ..., 
  endOfDay: ..., 
};

// Call the `getTodayAttendanceEvents()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getTodayAttendanceEvents(getTodayAttendanceEventsVars);
// Variables can be defined inline as well.
const { data } = await getTodayAttendanceEvents({ businessId: ..., startOfDay: ..., endOfDay: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getTodayAttendanceEvents(dataConnect, getTodayAttendanceEventsVars);

console.log(data.attendanceEvents);

// Or, you can use the `Promise` API.
getTodayAttendanceEvents(getTodayAttendanceEventsVars).then((response) => {
  const data = response.data;
  console.log(data.attendanceEvents);
});
```

### Using `GetTodayAttendanceEvents`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getTodayAttendanceEventsRef, GetTodayAttendanceEventsVariables } from '@aiclock/dataconnect';

// The `GetTodayAttendanceEvents` query requires an argument of type `GetTodayAttendanceEventsVariables`:
const getTodayAttendanceEventsVars: GetTodayAttendanceEventsVariables = {
  businessId: ..., 
  startOfDay: ..., 
  endOfDay: ..., 
};

// Call the `getTodayAttendanceEventsRef()` function to get a reference to the query.
const ref = getTodayAttendanceEventsRef(getTodayAttendanceEventsVars);
// Variables can be defined inline as well.
const ref = getTodayAttendanceEventsRef({ businessId: ..., startOfDay: ..., endOfDay: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getTodayAttendanceEventsRef(dataConnect, getTodayAttendanceEventsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.attendanceEvents);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.attendanceEvents);
});
```

## GetDashboardData
You can execute the `GetDashboardData` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getDashboardData(vars: GetDashboardDataVariables): QueryPromise<GetDashboardDataData, GetDashboardDataVariables>;

interface GetDashboardDataRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetDashboardDataVariables): QueryRef<GetDashboardDataData, GetDashboardDataVariables>;
}
export const getDashboardDataRef: GetDashboardDataRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getDashboardData(dc: DataConnect, vars: GetDashboardDataVariables): QueryPromise<GetDashboardDataData, GetDashboardDataVariables>;

interface GetDashboardDataRef {
  ...
  (dc: DataConnect, vars: GetDashboardDataVariables): QueryRef<GetDashboardDataData, GetDashboardDataVariables>;
}
export const getDashboardDataRef: GetDashboardDataRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getDashboardDataRef:
```typescript
const name = getDashboardDataRef.operationName;
console.log(name);
```

### Variables
The `GetDashboardData` query requires an argument of type `GetDashboardDataVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetDashboardDataVariables {
  businessId: UUIDString;
}
```
### Return Type
Recall that executing the `GetDashboardData` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetDashboardDataData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetDashboardData`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getDashboardData, GetDashboardDataVariables } from '@aiclock/dataconnect';

// The `GetDashboardData` query requires an argument of type `GetDashboardDataVariables`:
const getDashboardDataVars: GetDashboardDataVariables = {
  businessId: ..., 
};

// Call the `getDashboardData()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getDashboardData(getDashboardDataVars);
// Variables can be defined inline as well.
const { data } = await getDashboardData({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getDashboardData(dataConnect, getDashboardDataVars);

console.log(data.business);
console.log(data.totalEmployees);
console.log(data.currentlyIn);

// Or, you can use the `Promise` API.
getDashboardData(getDashboardDataVars).then((response) => {
  const data = response.data;
  console.log(data.business);
  console.log(data.totalEmployees);
  console.log(data.currentlyIn);
});
```

### Using `GetDashboardData`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getDashboardDataRef, GetDashboardDataVariables } from '@aiclock/dataconnect';

// The `GetDashboardData` query requires an argument of type `GetDashboardDataVariables`:
const getDashboardDataVars: GetDashboardDataVariables = {
  businessId: ..., 
};

// Call the `getDashboardDataRef()` function to get a reference to the query.
const ref = getDashboardDataRef(getDashboardDataVars);
// Variables can be defined inline as well.
const ref = getDashboardDataRef({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getDashboardDataRef(dataConnect, getDashboardDataVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.business);
console.log(data.totalEmployees);
console.log(data.currentlyIn);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.business);
  console.log(data.totalEmployees);
  console.log(data.currentlyIn);
});
```

## GetBusinessStats
You can execute the `GetBusinessStats` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getBusinessStats(vars: GetBusinessStatsVariables): QueryPromise<GetBusinessStatsData, GetBusinessStatsVariables>;

interface GetBusinessStatsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBusinessStatsVariables): QueryRef<GetBusinessStatsData, GetBusinessStatsVariables>;
}
export const getBusinessStatsRef: GetBusinessStatsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getBusinessStats(dc: DataConnect, vars: GetBusinessStatsVariables): QueryPromise<GetBusinessStatsData, GetBusinessStatsVariables>;

interface GetBusinessStatsRef {
  ...
  (dc: DataConnect, vars: GetBusinessStatsVariables): QueryRef<GetBusinessStatsData, GetBusinessStatsVariables>;
}
export const getBusinessStatsRef: GetBusinessStatsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getBusinessStatsRef:
```typescript
const name = getBusinessStatsRef.operationName;
console.log(name);
```

### Variables
The `GetBusinessStats` query requires an argument of type `GetBusinessStatsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetBusinessStatsVariables {
  businessId: UUIDString;
}
```
### Return Type
Recall that executing the `GetBusinessStats` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetBusinessStatsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetBusinessStats`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getBusinessStats, GetBusinessStatsVariables } from '@aiclock/dataconnect';

// The `GetBusinessStats` query requires an argument of type `GetBusinessStatsVariables`:
const getBusinessStatsVars: GetBusinessStatsVariables = {
  businessId: ..., 
};

// Call the `getBusinessStats()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getBusinessStats(getBusinessStatsVars);
// Variables can be defined inline as well.
const { data } = await getBusinessStats({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getBusinessStats(dataConnect, getBusinessStatsVars);

console.log(data.business);
console.log(data.totalEmployees);
console.log(data.activeEmployees);
console.log(data.currentlyIn);

// Or, you can use the `Promise` API.
getBusinessStats(getBusinessStatsVars).then((response) => {
  const data = response.data;
  console.log(data.business);
  console.log(data.totalEmployees);
  console.log(data.activeEmployees);
  console.log(data.currentlyIn);
});
```

### Using `GetBusinessStats`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getBusinessStatsRef, GetBusinessStatsVariables } from '@aiclock/dataconnect';

// The `GetBusinessStats` query requires an argument of type `GetBusinessStatsVariables`:
const getBusinessStatsVars: GetBusinessStatsVariables = {
  businessId: ..., 
};

// Call the `getBusinessStatsRef()` function to get a reference to the query.
const ref = getBusinessStatsRef(getBusinessStatsVars);
// Variables can be defined inline as well.
const ref = getBusinessStatsRef({ businessId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getBusinessStatsRef(dataConnect, getBusinessStatsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.business);
console.log(data.totalEmployees);
console.log(data.activeEmployees);
console.log(data.currentlyIn);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.business);
  console.log(data.totalEmployees);
  console.log(data.activeEmployees);
  console.log(data.currentlyIn);
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

Below are examples of how to use the `aiclock-connector` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateBusiness
You can execute the `CreateBusiness` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createBusiness(vars: CreateBusinessVariables): MutationPromise<CreateBusinessData, CreateBusinessVariables>;

interface CreateBusinessRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateBusinessVariables): MutationRef<CreateBusinessData, CreateBusinessVariables>;
}
export const createBusinessRef: CreateBusinessRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createBusiness(dc: DataConnect, vars: CreateBusinessVariables): MutationPromise<CreateBusinessData, CreateBusinessVariables>;

interface CreateBusinessRef {
  ...
  (dc: DataConnect, vars: CreateBusinessVariables): MutationRef<CreateBusinessData, CreateBusinessVariables>;
}
export const createBusinessRef: CreateBusinessRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createBusinessRef:
```typescript
const name = createBusinessRef.operationName;
console.log(name);
```

### Variables
The `CreateBusiness` mutation requires an argument of type `CreateBusinessVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateBusinessVariables {
  id: UUIDString;
  businessName: string;
  email: string;
  plan: BusinessPlan;
  slotsAllowed: number;
}
```
### Return Type
Recall that executing the `CreateBusiness` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateBusinessData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateBusinessData {
  business_insert: Business_Key;
}
```
### Using `CreateBusiness`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createBusiness, CreateBusinessVariables } from '@aiclock/dataconnect';

// The `CreateBusiness` mutation requires an argument of type `CreateBusinessVariables`:
const createBusinessVars: CreateBusinessVariables = {
  id: ..., 
  businessName: ..., 
  email: ..., 
  plan: ..., 
  slotsAllowed: ..., 
};

// Call the `createBusiness()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createBusiness(createBusinessVars);
// Variables can be defined inline as well.
const { data } = await createBusiness({ id: ..., businessName: ..., email: ..., plan: ..., slotsAllowed: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createBusiness(dataConnect, createBusinessVars);

console.log(data.business_insert);

// Or, you can use the `Promise` API.
createBusiness(createBusinessVars).then((response) => {
  const data = response.data;
  console.log(data.business_insert);
});
```

### Using `CreateBusiness`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createBusinessRef, CreateBusinessVariables } from '@aiclock/dataconnect';

// The `CreateBusiness` mutation requires an argument of type `CreateBusinessVariables`:
const createBusinessVars: CreateBusinessVariables = {
  id: ..., 
  businessName: ..., 
  email: ..., 
  plan: ..., 
  slotsAllowed: ..., 
};

// Call the `createBusinessRef()` function to get a reference to the mutation.
const ref = createBusinessRef(createBusinessVars);
// Variables can be defined inline as well.
const ref = createBusinessRef({ id: ..., businessName: ..., email: ..., plan: ..., slotsAllowed: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createBusinessRef(dataConnect, createBusinessVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.business_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.business_insert);
});
```

## UpdateBusiness
You can execute the `UpdateBusiness` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateBusiness(vars: UpdateBusinessVariables): MutationPromise<UpdateBusinessData, UpdateBusinessVariables>;

interface UpdateBusinessRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateBusinessVariables): MutationRef<UpdateBusinessData, UpdateBusinessVariables>;
}
export const updateBusinessRef: UpdateBusinessRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateBusiness(dc: DataConnect, vars: UpdateBusinessVariables): MutationPromise<UpdateBusinessData, UpdateBusinessVariables>;

interface UpdateBusinessRef {
  ...
  (dc: DataConnect, vars: UpdateBusinessVariables): MutationRef<UpdateBusinessData, UpdateBusinessVariables>;
}
export const updateBusinessRef: UpdateBusinessRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateBusinessRef:
```typescript
const name = updateBusinessRef.operationName;
console.log(name);
```

### Variables
The `UpdateBusiness` mutation requires an argument of type `UpdateBusinessVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateBusinessVariables {
  id: UUIDString;
  businessName?: string | null;
  email?: string | null;
  plan?: BusinessPlan | null;
  slotsAllowed?: number | null;
  status?: BusinessStatus | null;
}
```
### Return Type
Recall that executing the `UpdateBusiness` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateBusinessData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateBusinessData {
  business_update?: Business_Key | null;
}
```
### Using `UpdateBusiness`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateBusiness, UpdateBusinessVariables } from '@aiclock/dataconnect';

// The `UpdateBusiness` mutation requires an argument of type `UpdateBusinessVariables`:
const updateBusinessVars: UpdateBusinessVariables = {
  id: ..., 
  businessName: ..., // optional
  email: ..., // optional
  plan: ..., // optional
  slotsAllowed: ..., // optional
  status: ..., // optional
};

// Call the `updateBusiness()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateBusiness(updateBusinessVars);
// Variables can be defined inline as well.
const { data } = await updateBusiness({ id: ..., businessName: ..., email: ..., plan: ..., slotsAllowed: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateBusiness(dataConnect, updateBusinessVars);

console.log(data.business_update);

// Or, you can use the `Promise` API.
updateBusiness(updateBusinessVars).then((response) => {
  const data = response.data;
  console.log(data.business_update);
});
```

### Using `UpdateBusiness`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateBusinessRef, UpdateBusinessVariables } from '@aiclock/dataconnect';

// The `UpdateBusiness` mutation requires an argument of type `UpdateBusinessVariables`:
const updateBusinessVars: UpdateBusinessVariables = {
  id: ..., 
  businessName: ..., // optional
  email: ..., // optional
  plan: ..., // optional
  slotsAllowed: ..., // optional
  status: ..., // optional
};

// Call the `updateBusinessRef()` function to get a reference to the mutation.
const ref = updateBusinessRef(updateBusinessVars);
// Variables can be defined inline as well.
const ref = updateBusinessRef({ id: ..., businessName: ..., email: ..., plan: ..., slotsAllowed: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateBusinessRef(dataConnect, updateBusinessVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.business_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.business_update);
});
```

## CreateEmployee
You can execute the `CreateEmployee` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createEmployee(vars: CreateEmployeeVariables): MutationPromise<CreateEmployeeData, CreateEmployeeVariables>;

interface CreateEmployeeRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateEmployeeVariables): MutationRef<CreateEmployeeData, CreateEmployeeVariables>;
}
export const createEmployeeRef: CreateEmployeeRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createEmployee(dc: DataConnect, vars: CreateEmployeeVariables): MutationPromise<CreateEmployeeData, CreateEmployeeVariables>;

interface CreateEmployeeRef {
  ...
  (dc: DataConnect, vars: CreateEmployeeVariables): MutationRef<CreateEmployeeData, CreateEmployeeVariables>;
}
export const createEmployeeRef: CreateEmployeeRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createEmployeeRef:
```typescript
const name = createEmployeeRef.operationName;
console.log(name);
```

### Variables
The `CreateEmployee` mutation requires an argument of type `CreateEmployeeVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `CreateEmployee` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateEmployeeData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateEmployeeData {
  employee_insert: Employee_Key;
}
```
### Using `CreateEmployee`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createEmployee, CreateEmployeeVariables } from '@aiclock/dataconnect';

// The `CreateEmployee` mutation requires an argument of type `CreateEmployeeVariables`:
const createEmployeeVars: CreateEmployeeVariables = {
  id: ..., 
  businessId: ..., 
  slotId: ..., 
  employeeId: ..., 
  employeeName: ..., 
  badgeNumber: ..., 
  email: ..., // optional
  phone: ..., // optional
  position: ..., // optional
};

// Call the `createEmployee()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createEmployee(createEmployeeVars);
// Variables can be defined inline as well.
const { data } = await createEmployee({ id: ..., businessId: ..., slotId: ..., employeeId: ..., employeeName: ..., badgeNumber: ..., email: ..., phone: ..., position: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createEmployee(dataConnect, createEmployeeVars);

console.log(data.employee_insert);

// Or, you can use the `Promise` API.
createEmployee(createEmployeeVars).then((response) => {
  const data = response.data;
  console.log(data.employee_insert);
});
```

### Using `CreateEmployee`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createEmployeeRef, CreateEmployeeVariables } from '@aiclock/dataconnect';

// The `CreateEmployee` mutation requires an argument of type `CreateEmployeeVariables`:
const createEmployeeVars: CreateEmployeeVariables = {
  id: ..., 
  businessId: ..., 
  slotId: ..., 
  employeeId: ..., 
  employeeName: ..., 
  badgeNumber: ..., 
  email: ..., // optional
  phone: ..., // optional
  position: ..., // optional
};

// Call the `createEmployeeRef()` function to get a reference to the mutation.
const ref = createEmployeeRef(createEmployeeVars);
// Variables can be defined inline as well.
const ref = createEmployeeRef({ id: ..., businessId: ..., slotId: ..., employeeId: ..., employeeName: ..., badgeNumber: ..., email: ..., phone: ..., position: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createEmployeeRef(dataConnect, createEmployeeVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.employee_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.employee_insert);
});
```

## UpdateEmployee
You can execute the `UpdateEmployee` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateEmployee(vars: UpdateEmployeeVariables): MutationPromise<UpdateEmployeeData, UpdateEmployeeVariables>;

interface UpdateEmployeeRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateEmployeeVariables): MutationRef<UpdateEmployeeData, UpdateEmployeeVariables>;
}
export const updateEmployeeRef: UpdateEmployeeRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateEmployee(dc: DataConnect, vars: UpdateEmployeeVariables): MutationPromise<UpdateEmployeeData, UpdateEmployeeVariables>;

interface UpdateEmployeeRef {
  ...
  (dc: DataConnect, vars: UpdateEmployeeVariables): MutationRef<UpdateEmployeeData, UpdateEmployeeVariables>;
}
export const updateEmployeeRef: UpdateEmployeeRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateEmployeeRef:
```typescript
const name = updateEmployeeRef.operationName;
console.log(name);
```

### Variables
The `UpdateEmployee` mutation requires an argument of type `UpdateEmployeeVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateEmployeeVariables {
  id: UUIDString;
  employeeName?: string | null;
  badgeNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  active?: boolean | null;
}
```
### Return Type
Recall that executing the `UpdateEmployee` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateEmployeeData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateEmployeeData {
  employee_update?: Employee_Key | null;
}
```
### Using `UpdateEmployee`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateEmployee, UpdateEmployeeVariables } from '@aiclock/dataconnect';

// The `UpdateEmployee` mutation requires an argument of type `UpdateEmployeeVariables`:
const updateEmployeeVars: UpdateEmployeeVariables = {
  id: ..., 
  employeeName: ..., // optional
  badgeNumber: ..., // optional
  email: ..., // optional
  phone: ..., // optional
  position: ..., // optional
  active: ..., // optional
};

// Call the `updateEmployee()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateEmployee(updateEmployeeVars);
// Variables can be defined inline as well.
const { data } = await updateEmployee({ id: ..., employeeName: ..., badgeNumber: ..., email: ..., phone: ..., position: ..., active: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateEmployee(dataConnect, updateEmployeeVars);

console.log(data.employee_update);

// Or, you can use the `Promise` API.
updateEmployee(updateEmployeeVars).then((response) => {
  const data = response.data;
  console.log(data.employee_update);
});
```

### Using `UpdateEmployee`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateEmployeeRef, UpdateEmployeeVariables } from '@aiclock/dataconnect';

// The `UpdateEmployee` mutation requires an argument of type `UpdateEmployeeVariables`:
const updateEmployeeVars: UpdateEmployeeVariables = {
  id: ..., 
  employeeName: ..., // optional
  badgeNumber: ..., // optional
  email: ..., // optional
  phone: ..., // optional
  position: ..., // optional
  active: ..., // optional
};

// Call the `updateEmployeeRef()` function to get a reference to the mutation.
const ref = updateEmployeeRef(updateEmployeeVars);
// Variables can be defined inline as well.
const ref = updateEmployeeRef({ id: ..., employeeName: ..., badgeNumber: ..., email: ..., phone: ..., position: ..., active: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateEmployeeRef(dataConnect, updateEmployeeVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.employee_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.employee_update);
});
```

## CreateAttendanceEvent
You can execute the `CreateAttendanceEvent` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAttendanceEvent(vars: CreateAttendanceEventVariables): MutationPromise<CreateAttendanceEventData, CreateAttendanceEventVariables>;

interface CreateAttendanceEventRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAttendanceEventVariables): MutationRef<CreateAttendanceEventData, CreateAttendanceEventVariables>;
}
export const createAttendanceEventRef: CreateAttendanceEventRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAttendanceEvent(dc: DataConnect, vars: CreateAttendanceEventVariables): MutationPromise<CreateAttendanceEventData, CreateAttendanceEventVariables>;

interface CreateAttendanceEventRef {
  ...
  (dc: DataConnect, vars: CreateAttendanceEventVariables): MutationRef<CreateAttendanceEventData, CreateAttendanceEventVariables>;
}
export const createAttendanceEventRef: CreateAttendanceEventRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAttendanceEventRef:
```typescript
const name = createAttendanceEventRef.operationName;
console.log(name);
```

### Variables
The `CreateAttendanceEvent` mutation requires an argument of type `CreateAttendanceEventVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateAttendanceEventVariables {
  id: UUIDString;
  businessId: UUIDString;
  employeeId: UUIDString;
  eventType: EventType;
  eventTime: TimestampString;
  deviceId?: string | null;
  confidence?: number | null;
}
```
### Return Type
Recall that executing the `CreateAttendanceEvent` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAttendanceEventData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAttendanceEventData {
  attendanceEvent_insert: AttendanceEvent_Key;
}
```
### Using `CreateAttendanceEvent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAttendanceEvent, CreateAttendanceEventVariables } from '@aiclock/dataconnect';

// The `CreateAttendanceEvent` mutation requires an argument of type `CreateAttendanceEventVariables`:
const createAttendanceEventVars: CreateAttendanceEventVariables = {
  id: ..., 
  businessId: ..., 
  employeeId: ..., 
  eventType: ..., 
  eventTime: ..., 
  deviceId: ..., // optional
  confidence: ..., // optional
};

// Call the `createAttendanceEvent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAttendanceEvent(createAttendanceEventVars);
// Variables can be defined inline as well.
const { data } = await createAttendanceEvent({ id: ..., businessId: ..., employeeId: ..., eventType: ..., eventTime: ..., deviceId: ..., confidence: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAttendanceEvent(dataConnect, createAttendanceEventVars);

console.log(data.attendanceEvent_insert);

// Or, you can use the `Promise` API.
createAttendanceEvent(createAttendanceEventVars).then((response) => {
  const data = response.data;
  console.log(data.attendanceEvent_insert);
});
```

### Using `CreateAttendanceEvent`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAttendanceEventRef, CreateAttendanceEventVariables } from '@aiclock/dataconnect';

// The `CreateAttendanceEvent` mutation requires an argument of type `CreateAttendanceEventVariables`:
const createAttendanceEventVars: CreateAttendanceEventVariables = {
  id: ..., 
  businessId: ..., 
  employeeId: ..., 
  eventType: ..., 
  eventTime: ..., 
  deviceId: ..., // optional
  confidence: ..., // optional
};

// Call the `createAttendanceEventRef()` function to get a reference to the mutation.
const ref = createAttendanceEventRef(createAttendanceEventVars);
// Variables can be defined inline as well.
const ref = createAttendanceEventRef({ id: ..., businessId: ..., employeeId: ..., eventType: ..., eventTime: ..., deviceId: ..., confidence: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAttendanceEventRef(dataConnect, createAttendanceEventVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.attendanceEvent_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.attendanceEvent_insert);
});
```

## UpsertEmployeeStatus
You can execute the `UpsertEmployeeStatus` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
upsertEmployeeStatus(vars: UpsertEmployeeStatusVariables): MutationPromise<UpsertEmployeeStatusData, UpsertEmployeeStatusVariables>;

interface UpsertEmployeeStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertEmployeeStatusVariables): MutationRef<UpsertEmployeeStatusData, UpsertEmployeeStatusVariables>;
}
export const upsertEmployeeStatusRef: UpsertEmployeeStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
upsertEmployeeStatus(dc: DataConnect, vars: UpsertEmployeeStatusVariables): MutationPromise<UpsertEmployeeStatusData, UpsertEmployeeStatusVariables>;

interface UpsertEmployeeStatusRef {
  ...
  (dc: DataConnect, vars: UpsertEmployeeStatusVariables): MutationRef<UpsertEmployeeStatusData, UpsertEmployeeStatusVariables>;
}
export const upsertEmployeeStatusRef: UpsertEmployeeStatusRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the upsertEmployeeStatusRef:
```typescript
const name = upsertEmployeeStatusRef.operationName;
console.log(name);
```

### Variables
The `UpsertEmployeeStatus` mutation requires an argument of type `UpsertEmployeeStatusVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpsertEmployeeStatusVariables {
  id: UUIDString;
  businessId: UUIDString;
  employeeId: UUIDString;
  attendanceStatus: AttendanceStatus;
  lastClockTime: TimestampString;
  lastClockStatus: AttendanceStatus;
  lastEventType: EventType;
}
```
### Return Type
Recall that executing the `UpsertEmployeeStatus` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpsertEmployeeStatusData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpsertEmployeeStatusData {
  employeeStatus_upsert: EmployeeStatus_Key;
}
```
### Using `UpsertEmployeeStatus`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, upsertEmployeeStatus, UpsertEmployeeStatusVariables } from '@aiclock/dataconnect';

// The `UpsertEmployeeStatus` mutation requires an argument of type `UpsertEmployeeStatusVariables`:
const upsertEmployeeStatusVars: UpsertEmployeeStatusVariables = {
  id: ..., 
  businessId: ..., 
  employeeId: ..., 
  attendanceStatus: ..., 
  lastClockTime: ..., 
  lastClockStatus: ..., 
  lastEventType: ..., 
};

// Call the `upsertEmployeeStatus()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertEmployeeStatus(upsertEmployeeStatusVars);
// Variables can be defined inline as well.
const { data } = await upsertEmployeeStatus({ id: ..., businessId: ..., employeeId: ..., attendanceStatus: ..., lastClockTime: ..., lastClockStatus: ..., lastEventType: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await upsertEmployeeStatus(dataConnect, upsertEmployeeStatusVars);

console.log(data.employeeStatus_upsert);

// Or, you can use the `Promise` API.
upsertEmployeeStatus(upsertEmployeeStatusVars).then((response) => {
  const data = response.data;
  console.log(data.employeeStatus_upsert);
});
```

### Using `UpsertEmployeeStatus`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, upsertEmployeeStatusRef, UpsertEmployeeStatusVariables } from '@aiclock/dataconnect';

// The `UpsertEmployeeStatus` mutation requires an argument of type `UpsertEmployeeStatusVariables`:
const upsertEmployeeStatusVars: UpsertEmployeeStatusVariables = {
  id: ..., 
  businessId: ..., 
  employeeId: ..., 
  attendanceStatus: ..., 
  lastClockTime: ..., 
  lastClockStatus: ..., 
  lastEventType: ..., 
};

// Call the `upsertEmployeeStatusRef()` function to get a reference to the mutation.
const ref = upsertEmployeeStatusRef(upsertEmployeeStatusVars);
// Variables can be defined inline as well.
const ref = upsertEmployeeStatusRef({ id: ..., businessId: ..., employeeId: ..., attendanceStatus: ..., lastClockTime: ..., lastClockStatus: ..., lastEventType: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = upsertEmployeeStatusRef(dataConnect, upsertEmployeeStatusVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.employeeStatus_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.employeeStatus_upsert);
});
```

