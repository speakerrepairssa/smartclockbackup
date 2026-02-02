# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createBusiness, updateBusiness, createEmployee, updateEmployee, createAttendanceEvent, upsertEmployeeStatus, getBusiness, getBusinessWithEmployees, getEmployee, getBusinessEmployees } from '@aiclock/dataconnect';


// Operation CreateBusiness:  For variables, look at type CreateBusinessVars in ../index.d.ts
const { data } = await CreateBusiness(dataConnect, createBusinessVars);

// Operation UpdateBusiness:  For variables, look at type UpdateBusinessVars in ../index.d.ts
const { data } = await UpdateBusiness(dataConnect, updateBusinessVars);

// Operation CreateEmployee:  For variables, look at type CreateEmployeeVars in ../index.d.ts
const { data } = await CreateEmployee(dataConnect, createEmployeeVars);

// Operation UpdateEmployee:  For variables, look at type UpdateEmployeeVars in ../index.d.ts
const { data } = await UpdateEmployee(dataConnect, updateEmployeeVars);

// Operation CreateAttendanceEvent:  For variables, look at type CreateAttendanceEventVars in ../index.d.ts
const { data } = await CreateAttendanceEvent(dataConnect, createAttendanceEventVars);

// Operation UpsertEmployeeStatus:  For variables, look at type UpsertEmployeeStatusVars in ../index.d.ts
const { data } = await UpsertEmployeeStatus(dataConnect, upsertEmployeeStatusVars);

// Operation GetBusiness:  For variables, look at type GetBusinessVars in ../index.d.ts
const { data } = await GetBusiness(dataConnect, getBusinessVars);

// Operation GetBusinessWithEmployees:  For variables, look at type GetBusinessWithEmployeesVars in ../index.d.ts
const { data } = await GetBusinessWithEmployees(dataConnect, getBusinessWithEmployeesVars);

// Operation GetEmployee:  For variables, look at type GetEmployeeVars in ../index.d.ts
const { data } = await GetEmployee(dataConnect, getEmployeeVars);

// Operation GetBusinessEmployees:  For variables, look at type GetBusinessEmployeesVars in ../index.d.ts
const { data } = await GetBusinessEmployees(dataConnect, getBusinessEmployeesVars);


```