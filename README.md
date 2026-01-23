# AiClock - Modular Multi-Tenant SaaS Application

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
│   │   │   └── dashboard.js         # Admin dashboard
│   │   ├── business/
│   │   │   └── dashboard.js         # Business dashboard
│   │   └── shared/
│   │       ├── ui.js                # UI utilities
│   │       └── utils.js             # Helper functions
│   ├── pages/
│   │   ├── login.html               # Login page
│   │   ├── admin-register.html      # Business registration
│   │   ├── admin-dashboard.html     # Admin dashboard
│   │   └── business-dashboard.html  # Business dashboard
│   ├── styles/
│   │   ├── main.css                 # Global styles
│   │   ├── auth.css                 # Auth page styles
│   │   └── dashboard.css            # Dashboard styles
│   └── index.html                   # Landing page
├── functions/
│   └── index.js                     # Cloud Functions
├── firebase.json                    # Firebase config
├── package.json                     # Dependencies
└── README.md                        # This file
```

## 🚀 Features

### Authentication System
- **Admin Owner Login**: Platform administrator access
- **Business User Login**: Company-specific authentication
- **Business Registration**: Self-service signup with automatic slot initialization
- **Session Management**: Secure session handling with role-based access

### Admin Dashboard
- View all registered businesses
- Monitor slot usage and revenue
- Manage business accounts
- Real-time statistics display

### Business Dashboard
- **Monitor View**: Real-time IN/OUT status of employees
- **Staff Management**: View assigned employees and slots
- Auto-polling for live updates (30-second interval)
- Employee detail views with attendance history

### Modular Architecture
- **Isolated Modules**: Each feature in separate module
- **ES6 Modules**: Modern JavaScript with imports/exports
- **Service Layer**: Business logic separated from UI
- **Shared Utilities**: Reusable components and helpers

## 🔧 Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 Modules)
- **Backend**: Firebase Firestore
- **Authentication**: Custom auth service
- **Styling**: CSS3 with CSS Variables
- **Build Tool**: None required (native ES modules)

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
# Serve the application
npm run dev

# Or use Firebase hosting
firebase serve
```

Visit: `http://localhost:5000/src/index.html`

## 🌐 Deployment

```bash
# Deploy everything
npm run deploy

# Deploy hosting only
npm run deploy:hosting

# Deploy functions only
npm run deploy:functions
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
3. Register new businesses
4. Manage existing businesses
5. Monitor revenue and slot usage

### Business Flow
1. Register business account
2. Login via Business User tab
3. View real-time employee status
4. Manage staff (view auto-assigned employees)
5. Monitor attendance events

## 🔄 How Slot-Based System Works

1. **Business Registration**: 
   - New business gets 5 slots (Basic Plan)
   - Slots pre-created in Firestore (slot 1-5)

2. **Employee Addition**:
   - Admin adds person to Hikvision device
   - Employee ID must match slot number (1, 2, 3...)

3. **Auto-Assignment**:
   - First face scan triggers webhook
   - Cloud Function updates slot with employee name
   - Slot becomes active

4. **Real-Time Display**:
   - Active employees appear in Monitor View
   - Status updates every 30 seconds
   - IN/OUT status tracked automatically

## 🎨 Styling System

### CSS Variables
All colors and sizing use CSS variables defined in `main.css`:
- `--primary-color`: Main brand color
- `--success-color`: Success states
- `--danger-color`: Error states
- etc.

### Responsive Design
- Mobile-first approach
- Breakpoints: 480px, 768px, 1024px
- Flexible grid layouts

## 🛠️ Key Modules

### `auth.service.js`
- `adminLogin()`: Admin authentication
- `businessLogin()`: Business authentication
- `registerBusiness()`: New business signup
- `initializeBusinessSlots()`: Create empty slots

### `admin/dashboard.js`
- `loadBusinesses()`: Fetch all businesses
- `displayStats()`: Show statistics
- `viewBusiness()`: Business details modal
- `deleteBusiness()`: Remove business

### `business/dashboard.js`
- `loadStaff()`: Fetch employees
- `loadStatus()`: Get IN/OUT status
- `startPolling()`: Real-time updates
- `viewEmployee()`: Employee details

### `shared/ui.js`
- `showNotification()`: Toast messages
- `showLoader()` / `hideLoader()`: Loading overlay
- `confirmDialog()`: Confirmation prompts
- Various formatting utilities

## 📊 Database Structure

```
/businesses/{businessId}
  - businessName
  - email
  - plan
  - slotsAllowed
  - monthlyFee
  - status

/businesses/{businessId}/staff/{slotId}
  - employeeId
  - employeeName
  - badgeNumber
  - slot
  - active
  - assignedAt

/businesses/{businessId}/status/{employeeId}
  - attendanceStatus (in/out)
  - lastClockTime
  - employeeName
  - active

/businesses/{businessId}/attendance_events/{date}/events/
  - timestamp
  - employeeId
  - eventType
  - deviceId
```

## 🔒 Security Notes

- Passwords stored in plain text (FOR DEVELOPMENT ONLY)
- In production, use Firebase Authentication
- Implement proper password hashing
- Add HTTPS enforcement
- Enable Firestore security rules

## 🚧 Future Enhancements

- [ ] Firebase Authentication integration
- [ ] Email verification
- [ ] Password reset functionality
- [ ] Advanced reporting and analytics
- [ ] Stripe payment integration
- [ ] Mobile app (React Native)
- [ ] Multi-language support

## 📞 Support

For issues or questions:
- **Admin**: info@simplewebhost.co.za
- **Platform**: https://aiclock-82608.web.app

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ using Firebase & Modern JavaScript**
