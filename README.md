# AiClock - Multi-Tenant Attendance Management SaaS

## 🏗️ Project Structure

```
aiclock/
├── src/
│   ├── config/
│   │   └── firebase.js              # Firebase initialization
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.service.js      # Authentication service
│   │   │   ├── login.js             # Login controller
│   │   │   └── register.js          # Registration controller
│   │   ├── admin/
│   │   │   └── dashboard.js         # Admin dashboard controller
│   │   ├── business/
│   │   │   └── dashboard.js         # Business dashboard controller
│   │   └── shared/
│   │       ├── ui.js                # UI utilities
│   │       └── utils.js             # Helper functions
│   ├── pages/
│   │   ├── login.html               # Login page
│   │   ├── employee-login.html      # Employee login
│   │   ├── admin-register.html      # Business registration
│   │   ├── admin-dashboard.html     # Admin dashboard
│   │   ├── business-dashboard.html  # Business dashboard
│   │   ├── employee-dashboard.html  # Employee dashboard
│   │   ├── device-manager.html      # Device management
│   │   └── edit-business.html       # Business editing
│   ├── styles/
│   │   ├── main.css                 # Global styles
│   │   ├── auth.css                 # Auth page styles
│   │   └── dashboard.css            # Dashboard styles
│   └── index.html                   # Landing page
├── functions/
│   ├── index.js                     # Cloud Functions (webhooks, API)
│   ├── debug-webhook.js             # Webhook debugging
│   ├── setupCorrectStructure.js     # Database setup
│   └── cleanCollections.js          # Database maintenance
├── firebase.json                    # Firebase config
├── package.json                     # Dependencies
└── README.md                        # This file
```

## 🚀 Features

### Real-Time Attendance Monitoring
- **Live Status Dashboard**: Real-time IN/OUT employee status using Firestore listeners
- **Instant Updates**: Status changes reflect immediately without page refresh
- **Active Employee Filtering**: Shows only employees who have clocked in at least once
- **Auto-Sync with Devices**: Hikvision device integration via webhooks

### Employee Management Module
- **Employee Cards**: Visual display of all active employees
- **HR Information**: Comprehensive employee details including:
  - Phone number, email, position, department
  - ID number, address, hire date
  - Hourly rate and notes
- **Edit Modal**: Easy-to-use form for updating employee information
- **Firebase Integration**: Auto-save employee data to Firestore
- **Status Indicators**: Real-time IN/OUT status with last clock time

### Timecard Module
- **Monthly View**: Select employee and month to view detailed attendance
- **Daily Breakdown**: Shows clock-in/out times for each day
- **Hours Calculation**: Automatic calculation of:
  - Hours worked per day
  - Overtime hours (beyond 8-hour workday)
  - Total monthly hours
  - Total overtime
  - Days worked
- **Weekend Highlighting**: Visual distinction for Saturday/Sunday
- **Print Support**: Print-friendly layout for reports
- **Timezone Accuracy**: Fixed timezone issues for correct day names

### Authentication System
- **Admin Owner Login**: Platform administrator access
- **Business User Login**: Company-specific authentication
- **Employee Login**: Individual employee access
- **Business Registration**: Self-service signup with automatic slot initialization
- **Session Management**: Secure session handling with role-based access

### Admin Dashboard
- View all registered businesses
- Monitor slot usage and revenue
- Manage business accounts
- Real-time statistics display
- Business editing capabilities

### Slot-Based System
- **Automatic Slot Creation**: Pre-configured slots (1-6) per business
- **Device Integration**: Direct sync with Hikvision attendance devices
- **Smart Mapping**: Slot numbers match device employee IDs
- **Status Tracking**: Real-time status updates via Cloud Functions

### Modular Architecture
- **Isolated Modules**: Each feature in separate module
- **ES6 Modules**: Modern JavaScript with imports/exports
- **Service Layer**: Business logic separated from UI
- **Shared Utilities**: Reusable components and helpers
- **Real-Time Listeners**: Firestore onSnapshot for instant updates

## 🔧 Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 Modules)
- **Backend**: Firebase Firestore (Real-time Database)
- **Cloud Functions**: Node.js webhooks for device integration
- **Authentication**: Custom auth service with session management
- **Styling**: CSS3 with CSS Variables and responsive design
- **Build Tool**: None required (native ES modules)
- **Hosting**: Firebase Hosting

## 📦 Installation

1. **Clone the repository**
   ```bash
   cd "/Users/mobalife/Documents/Dropbox/projects development/aiclock"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Firebase config already in `src/config/firebase.js`
   - No additional setup needed

## 🏃 Running Locally

```bash
# Serve the application with Firebase hosting
firebase serve

# Or deploy to production
firebase deploy
```

Visit: `http://localhost:5000`

## 🌐 Deployment

```bash
# Deploy everything
firebase deploy

# Deploy hosting only
firebase deploy --only hosting

# Deploy functions only
firebase deploy --only functions
```

Live URL: `https://aiclock-82608.web.app`

## 🔐 Default Credentials

### Admin Owner
- **Email**: info@simplewebhost.co.za
- **Password**: Azam198419880001#

### Test Business (if created)
- **Email**: Your registered business email
- **Password**: Your chosen password

## 📱 User Flows

### Admin Flow
1. Login via Admin Owner tab
2. View dashboard with business statistics
3. Register new businesses with slot allocation
4. Manage existing businesses
5. Monitor revenue and slot usage

### Business Flow
1. Register business account
2. Login via Business User tab
3. **Monitor Mode**: View real-time employee status (IN/OUT)
4. **Employee Module**: Manage HR details, add phone/email/position
5. **Timecard Module**: View monthly attendance and calculate hours
6. Track overtime and generate reports

### Employee Flow
1. Clock in/out on Hikvision device
2. Data automatically syncs to Firebase via webhook
3. Status updates in real-time on business dashboard
4. Attendance records stored in date-organized collections

## 🔄 How the System Works

### 1. Device Integration
- Hikvision attendance device captures face/fingerprint
- Device sends webhook to Cloud Function
- Slot number (1-6) maps to employee ID

### 2. Real-Time Updates
- Cloud Function updates Firestore collections:
  - `/staff/{slotId}` - Employee data
  - `/status/{slotId}` - Current IN/OUT status
  - `/attendance_events/{date}/{slotId}` - Event history
- Firestore listeners (onSnapshot) push updates to dashboard instantly

### 3. Employee Management
- Business adds HR details through Employee Module
- Data synced to Firebase and available across system
- Phone, email, position, hire date, hourly rate stored

### 4. Timecard Calculation
- Select employee and month
- System fetches attendance events from Firestore
- Calculates hours per day, overtime, totals
- Print-friendly format for HR reports

## 📊 Database Structure

```
/businesses/{businessId}
  - businessName
  - email
  - plan (Basic/Premium/Enterprise)
  - slotsAllowed (5/10/50)
  - status (active/inactive)
  - deviceId
  - createdAt

/businesses/{businessId}/staff/{slotId}
  - employeeId (matches slot: 1-6)
  - employeeName
  - badgeNumber
  - slot
  - active (true/false)
  - phone
  - email
  - position
  - department
  - idNumber
  - address
  - hireDate
  - hourlyRate
  - notes
  - assignedAt
  - updatedAt

/businesses/{businessId}/status/{slotId}
  - employeeId
  - employeeName
  - badgeNumber
  - attendanceStatus (in/out)
  - lastClockTime (ISO timestamp)
  - lastEventType (checkin/checkout)
  - deviceId
  - slot
  - active
  - updatedAt

/businesses/{businessId}/attendance_events/{YYYY-MM-DD}/{slotId}/{eventId}
  - employeeId
  - employeeName
  - slotNumber
  - time (HH:MM:SS)
  - timestamp (ISO)
  - type (clock-in/clock-out)
  - attendanceStatus
  - deviceId
  - serialNo
  - recordedAt

/businesses/{businessId}/employee_timesheets/{slotId}/daily_sheets/{YYYY-MM-DD}
  - employeeId
  - employeeName
  - date
  - clockEvents[] (timestamps and types)
  - workPeriods[] (start, end, hours)
  - totalHours
  - breakMinutes
  - overtimeHours
  - status
  - lastUpdated

/businesses/{businessId}/employee_last_attendance/{slotId}
  - employeeId
  - employeeName
  - lastEventType
  - lastEventTime
  - attendanceStatus
  - updatedAt
```

## 🎨 Dashboard Modules

### Monitor Mode
- **Real-time status**: IN/OUT display with live updates
- **Employee cards**: Shows name, slot, and last clock time
- **Auto-refresh**: Firestore listeners for instant updates
- **Filter active only**: Shows only employees who have clocked in

### Employee Module
- **Employee cards**: Visual grid layout
- **HR details**: Phone, email, position, department, ID, address
- **Edit modal**: Clean form interface for updates
- **Firebase sync**: Auto-save changes to database

### Timecard Module
- **Employee selector**: Dropdown of active employees
- **Month selector**: Pick any month to view
- **Daily table**: Clock-in/out times, hours, overtime
- **Summary**: Total hours, overtime, days worked
- **Print support**: Generate PDF-ready reports

## 🛠️ Key Functions & APIs

### Cloud Functions (Webhooks)
- `attendanceWebhook`: Process clock-in/out from devices
- `debugWebhook`: Debug device communications
- `syncBusinessSlots`: Auto-sync slot creation
- `autoSyncSlots`: Triggered on business update
- `setDeviceMapping`: Map device IDs to slots
- `processDailyTimesheets`: Calculate daily hours
- `calculateMonthlyHours`: Generate monthly summaries
- `generatePayrollReport`: Create payroll reports

### Business Dashboard
- `setupRealtimeListeners()`: Initialize Firestore listeners
- `loadMonitor()`: Display real-time status
- `loadEmployees()`: Show employee management
- `loadTimecard()`: Display monthly timecards
- `editEmployee()`: Update HR information
- `printTimecard()`: Generate printable report

## 🔒 Security Notes

- Passwords stored in plain text (FOR DEVELOPMENT ONLY)
- Production requires Firebase Authentication
- Implement proper password hashing
- Add HTTPS enforcement
- Enable Firestore security rules
- Validate webhook sources

## 🚧 Future Enhancements

- [ ] Firebase Authentication integration
- [ ] Email verification
- [ ] Password reset functionality
- [ ] Advanced reporting and analytics
- [ ] Stripe payment integration
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Settings module for working hours configuration
- [ ] Export timecards to Excel/CSV
- [ ] Push notifications for attendance alerts
- [ ] Hostinger server sync for external HR systems

## 📞 Support

For issues or questions:
- **Admin**: info@simplewebhost.co.za
- **Platform**: https://aiclock-82608.web.app
- **GitHub**: https://github.com/speakerrepairssa/aiclock

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ using Firebase, Cloud Functions & Modern JavaScript**