# WhatsApp Business API Integration Module

## Overview
This module integrates WhatsApp Business API with the AIClock system, allowing businesses to send automated WhatsApp messages based on attendance events and other triggers. The module follows a 3-step setup flow: connect API credentials, view/manage automation cards, and create new automation cards with template mappings.

## Architecture

### Flow Structure
1. **Step 1**: API Connection - Business enters WhatsApp credentials and saves them
2. **Step 3**: Dashboard View - Shows connected status and lists all automation cards
3. **Modal Flow**: Card Creation - Select template → Configure parameters → Save card

### Files & Locations

#### Main File
- **Location**: `/src/pages/whatsapp-settings.html`
- **Size**: ~1575 lines
- **Purpose**: Complete WhatsApp integration UI and logic
- **Dependencies**: 
  - Firebase Firestore (authentication, database)
  - WhatsApp Business API (Meta Graph API v17.0+)

#### Navigation
- Accessible from business dashboard
- Menu item: "WhatsApp Settings" or "Communication → WhatsApp"

## Required Credentials

### WhatsApp Business API Setup
You need a Meta Business Account with WhatsApp Business API access. Obtain these credentials:

1. **Access Token**
   - From: Meta Developer Console → Your App → System Users
   - Type: System User Token with WhatsApp permissions
   - Scope: `whatsapp_business_messaging`, `whatsapp_business_management`

2. **Phone Number ID**
   - From: Meta Developer Console → WhatsApp → API Setup
   - Example: `104235266075141`
   - This is the ID of the phone number sending messages

3. **WhatsApp Business Account ID**
   - From: Meta Developer Console → WhatsApp → API Setup
   - Example: `107739957151545`
   - Your business account identifier

4. **Phone Number** (retrieved automatically)
   - The actual phone number (e.g., `+27 60 977 2398`)
   - Fetched from API during setup

### How to Get Credentials

#### Step 1: Create Meta Business Account
1. Go to [Meta Business Suite](https://business.facebook.com)
2. Create or select your business account
3. Navigate to "WhatsApp Accounts"

#### Step 2: Set Up WhatsApp Business API
1. Go to [Meta for Developers](https://developers.facebook.com)
2. Create a new app or select existing app
3. Add "WhatsApp" product to your app
4. Complete phone number verification

#### Step 3: Generate Access Token
1. In Meta Developer Console, go to "System Users"
2. Create a system user with appropriate permissions
3. Generate a permanent access token
4. Assign WhatsApp permissions to the token

#### Step 4: Get IDs
1. Navigate to WhatsApp → API Setup
2. Copy your Phone Number ID
3. Copy your WhatsApp Business Account ID

## Firestore Data Structure

### Settings Document
**Path**: `businesses/{businessId}/settings/whatsapp`

```javascript
{
  accessToken: "EAAH...",           // Meta access token
  phoneNumberId: "104235266075141", // WhatsApp phone number ID
  businessAccountId: "107739957151545", // Business account ID
  phoneNumber: "+27 60 977 2398",   // Display phone number
  businessName: "Your Business",    // Business name (optional)
  createdAt: "2026-02-12T10:30:00.000Z",
  updatedAt: "2026-02-12T10:30:00.000Z"
}
```

### Automation Card Document
**Path**: `businesses/{businessId}/whatsapp_automations/{cardId}`

```javascript
{
  id: "card_1234567890",            // Unique card identifier
  name: "Late Arrival Notice",      // Card display name
  templateName: "late_notice",      // WhatsApp template name
  trigger: "late_checkin",          // Event trigger type
  recipient: "employee",            // Who receives the message
  parameterMappings: [              // Template parameter mappings
    {
      parameterName: "1",           // Template parameter position
      value: "{{employee.firstName}}" // Data field to use
    },
    {
      parameterName: "2",
      value: "{{time.clock_in}}"
    }
  ],
  enabled: true,                    // Card active status
  createdAt: "2026-02-12T10:45:00.000Z",
  updatedAt: "2026-02-12T10:45:00.000Z"
}
```

## Key Functions Reference

### Initialization Functions

#### `checkExistingSetup()`
**Lines**: 483-538
**Purpose**: Loads saved WhatsApp credentials from Firestore on page load
**Behavior**:
- Checks if credentials exist in Firestore
- If found, fetches templates from WhatsApp API
- Reconstructs `selectedBusiness` object
- Automatically shows Step 3 (dashboard view)
- Called on page load in `DOMContentLoaded` event

#### `setupEventListeners()`
**Lines**: 540-548
**Purpose**: Attaches event handlers for form submissions and buttons
**Listeners**:
- Form submission for Step 1 (API connection)
- Edit Settings button click
- Called once on page initialization

### Step 1: API Connection

#### `handleTokenSubmit(e)`
**Lines**: 565-690
**Purpose**: Validates and saves WhatsApp API credentials
**Flow**:
1. Prevents form default submission
2. Validates all three credential fields
3. Tests connection to Meta Graph API
4. Fetches available message templates
5. Retrieves phone number details
6. Saves credentials to Firestore
7. Shows Step 3 (success view)

**API Calls Made**:
- `GET /{businessAccountId}/message_templates` - Fetch templates
- `GET /{phoneNumberId}/whatsapp_business_profile` - Get business profile
- `GET /{phoneNumberId}` - Get phone number details

### Step 3: Dashboard View

#### `loadSuccessDisplay()`
**Lines**: 692-745
**Purpose**: Displays connection status and automation cards
**Elements**:
- Shows connected phone number
- Displays business name
- Shows template count
- Renders "Create Card" button
- Calls `loadConfiguredMappings()` to show existing cards

#### `loadConfiguredMappings()`
**Lines**: 1387-1454
**Purpose**: Fetches and displays all automation cards from Firestore
**Features**:
- Queries `whatsapp_automations` collection
- Creates card UI elements with status (active/paused)
- Shows card name, template, trigger type
- Adds Edit/Pause/Delete buttons
- Handles empty state (no cards message)

### Card Creation Flow

#### `openCreateCardModal()`
**Lines**: 1019-1090
**Purpose**: Opens modal with template selector dropdown
**Flow**:
1. Shows modal overlay
2. Populates template dropdown from available templates
3. Filters to only show APPROVED templates
4. Groups templates by category (optional)
5. Waits for user to select template and click "Next"

#### `proceedWithTemplate()`
**Lines**: 1092-1180
**Purpose**: Rebuilds modal with full card configuration form
**Flow**:
1. Gets selected template from dropdown
2. Extracts template structure and parameters
3. Rebuilds entire modal HTML with:
   - Card name field
   - Template display name (read-only)
   - Trigger type selector (late_checkin, early_checkout, etc.)
   - Recipient selector (employee, manager, business)
   - Dynamic parameter fields based on template structure
4. Populates parameter dropdowns with available data fields
5. Shows parameter hints (what each field does)

**Available Data Fields**:
- `{{employee.firstName}}`
- `{{employee.lastName}}`
- `{{employee.phone}}`
- `{{business.name}}`
- `{{time.clock_in}}`
- `{{time.clock_out}}`
- `{{date.today}}`
- `{{location.name}}`

#### `saveMappingConfig()`
**Lines**: 1293-1383
**Purpose**: Validates and saves the automation card to Firestore
**Validation**:
- Card name is required and unique
- Template must be selected
- Trigger type must be chosen
- Recipient must be selected
**Flow**:
1. Collects all form data
2. Validates required fields
3. Collects parameter mappings
4. Generates unique card ID
5. Saves to `whatsapp_automations` collection
6. Shows success message
7. Closes modal
8. Reloads card list

### Card Management

#### `pauseMapping(cardId)`
**Lines**: 1456-1474
**Purpose**: Toggles card enabled/disabled status
**Updates**: `enabled` field in Firestore document

#### `editMapping(cardId)`
**Lines**: 1476-1509
**Purpose**: Opens edit mode for existing card
**Flow**:
1. Fetches card data from Firestore
2. Sets `currentEditingCardId`
3. Opens modal with form pre-filled
4. Save button updates existing document

#### `deleteMapping(cardId)`
**Lines**: 1511-1523
**Purpose**: Deletes automation card after confirmation
**Behavior**: Removes document from Firestore and refreshes list

### Utility Functions

#### `showStep(stepNumber)`
**Lines**: 1550-1553
**Purpose**: Shows specific step, hides others
**CSS**: Toggles `.active` class on step elements

#### `updateProgress(percentage, text)`
**Lines**: 1555-1558
**Purpose**: Updates progress bar at top of page
**Parameters**: 
- `percentage`: 0-100 (33 for step 1, 100 for complete)
- `text`: Display text (e.g., "Step 1 of 3")

#### `showStatus(elementId, message, type)`
**Lines**: 1560-1565
**Purpose**: Shows status message (success/error)
**Types**: `'success'`, `'error'`, `'info'`

#### `editSettings()`
**Lines**: 550-562
**Purpose**: Returns to Step 1 to edit credentials
**Behavior**: Pre-fills existing values (except access token for security)

## Template Structure

WhatsApp templates have a specific structure:

```javascript
{
  name: "late_notice",
  status: "APPROVED",
  category: "ACCOUNT_UPDATE",
  language: "en",
  components: [
    {
      type: "HEADER",
      format: "TEXT",
      text: "Late Arrival Notice"
    },
    {
      type: "BODY",
      text: "Hi {{1}}, you clocked in at {{2}}. Please ensure punctuality.",
      example: {
        body_text: [["John", "09:15 AM"]]
      }
    },
    {
      type: "FOOTER",
      text: "AIClock Attendance System"
    }
  ]
}
```

### Parameter Extraction
The system automatically extracts parameters from the BODY component:
- Looks for `{{1}}`, `{{2}}`, `{{3}}`, etc.
- Creates form fields for each parameter
- Shows examples if available
- Maps parameters to data fields on save

## Setup Instructions

### 1. First Time Setup

1. **Navigate to WhatsApp Settings**
   - Login as business user
   - Go to dashboard
   - Click "WhatsApp Settings" in menu

2. **Enter Credentials (Step 1)**
   - Paste Access Token
   - Enter Phone Number ID
   - Enter Business Account ID
   - Click "Connect & Save"

3. **Wait for Validation**
   - System tests connection
   - Fetches templates (must have at least 1 approved template)
   - Saves to Firestore
   - Redirects to dashboard (Step 3)

### 2. Creating Automation Cards

1. **Click "Create New Card" (+ button)**
   - Modal opens with template selector

2. **Select Template**
   - Choose from dropdown (only APPROVED templates shown)
   - Click "Next"

3. **Configure Card**
   - **Card Name**: Give it a descriptive name (e.g., "Late Arrival Alert")
   - **Trigger**: Select when to send (late_checkin, early_checkout, etc.)
   - **Recipient**: Choose who receives message (employee, manager, business)
   - **Parameters**: Map each template parameter to a data field
   - Click "Save Card"

4. **Verify Card Created**
   - Card appears in list
   - Shows as "Active" (green indicator)
   - Can pause, edit, or delete

### 3. Managing Cards

- **Pause/Activate**: Click pause button to temporarily disable
- **Edit**: Click edit icon to modify configuration
- **Delete**: Click delete icon (confirms before removing)

### 4. Editing Credentials

1. Click "Edit Settings" button in Step 3
2. Returns to Step 1 with pre-filled values
3. Update any credential
4. Click "Connect & Save"

## Troubleshooting

### Common Issues

#### "Please fill in all fields"
- Ensure all three credentials are entered
- No empty fields allowed
- Access token should start with "EAAH" or "EAA"

#### "Failed to fetch templates"
- Check access token is valid and not expired
- Verify token has WhatsApp permissions
- Ensure Business Account ID is correct
- Check Meta app is in production mode (not development)

#### "No templates found"
- You must create at least 1 template in Meta Business Manager
- Templates must be APPROVED status
- Wait for Meta approval (can take 1-2 hours)

#### "Template selector is empty"
- Only APPROVED templates appear
- Check template status in Meta Business Manager
- Pending/Rejected templates won't show

#### "Card not saving"
- Check browser console for errors (F12 → Console tab)
- Verify Firestore permissions are correct
- Ensure businessId exists and user has access
- Check all required fields are filled

#### "Cards not displaying"
- Check Firestore collection path: `businesses/{businessId}/whatsapp_automations`
- Verify documents exist in Firestore console
- Check browser console for fetch errors
- Try refreshing the page

#### "Step 1 not working"
- Check for JavaScript errors in console
- Verify form exists with id="tokenForm"
- Check event listener is attached
- Look for console logs starting with "🔐"

### Console Debugging

Open browser console (F12 → Console) to see detailed logs:

**Step 1 (Connection)**:
```
🔐 handleTokenSubmit called
   Access token length: 255
   Phone Number ID: 104235266075141
   Business Account ID: 107739957151545
🔄 Testing connection...
✅ Connection successful!
📱 Phone number: +27 60 977 2398
📋 Found 25 templates
💾 Saving to Firestore...
✅ Settings saved successfully
```

**Card Save**:
```
💾 Saving card configuration...
   Card Name: Late Arrival Notice
   Template: late_notice
   Trigger: late_checkin
   Recipient: employee
   Parameters: (2) [{...}, {...}]
   Card ID: card_1707737425123
   Card data: {id: "...", name: "...", ...}
✅ Card saved successfully!
```

**Card Load**:
```
📋 Loading automation cards...
   Found 3 cards
   Card: Late Arrival Notice (late_notice)
   Card: Early Leave Alert (early_leave)
   Card: Absent Notice (absent_notice)
✅ Cards loaded and displayed
```

## Data Flow Diagram

```
User Input
    ↓
Step 1: Enter Credentials
    ↓
handleTokenSubmit()
    ↓
Validate & Test API
    ↓
Fetch Templates
    ↓
Save to Firestore (businesses/{id}/settings/whatsapp)
    ↓
Show Step 3
    ↓
loadSuccessDisplay()
    ↓
loadConfiguredMappings()
    ↓
Display Cards (from businesses/{id}/whatsapp_automations)
    ↓
User Clicks "Create Card"
    ↓
openCreateCardModal()
    ↓
Select Template
    ↓
proceedWithTemplate()
    ↓
Fill Form (name, trigger, recipient, parameters)
    ↓
saveMappingConfig()
    ↓
Save to Firestore (businesses/{id}/whatsapp_automations/{cardId})
    ↓
Reload Card List
```

## API Endpoints Used

### Meta Graph API (WhatsApp Business)

**Base URL**: `https://graph.facebook.com/v17.0`

#### 1. Get Message Templates
```
GET /{businessAccountId}/message_templates
Headers: Authorization: Bearer {accessToken}
Response: { data: [{template1}, {template2}, ...] }
```

#### 2. Get Business Profile
```
GET /{phoneNumberId}/whatsapp_business_profile
Headers: Authorization: Bearer {accessToken}
Response: { data: [{ about, address, description, ... }] }
```

#### 3. Get Phone Number
```
GET /{phoneNumberId}
Headers: Authorization: Bearer {accessToken}
Response: { display_phone_number: "+27...", ... }
```

#### 4. Send Message (not in this file, used by backend)
```
POST /{phoneNumberId}/messages
Headers: 
  Authorization: Bearer {accessToken}
  Content-Type: application/json
Body: {
  messaging_product: "whatsapp",
  to: "+27...",
  type: "template",
  template: {
    name: "template_name",
    language: { code: "en" },
    components: [...]
  }
}
```

## Security Considerations

1. **Access Token Storage**
   - Stored in Firestore (encrypted at rest)
   - Never exposed in client-side logs
   - Not pre-filled in edit mode for security

2. **Firestore Rules Required**
   ```javascript
   match /businesses/{businessId}/settings/{document} {
     allow read, write: if request.auth != null 
       && request.auth.token.businessId == businessId;
   }
   
   match /businesses/{businessId}/whatsapp_automations/{cardId} {
     allow read, write: if request.auth != null 
       && request.auth.token.businessId == businessId;
   }
   ```

3. **Rate Limiting**
   - Meta API has rate limits (1000 requests/hour typical)
   - Template fetching is cached in `selectedBusiness` object
   - Only refetched on page reload or credential change

## Future Enhancements

### Potential Features
- [ ] Template preview before sending
- [ ] Test message functionality
- [ ] Message history/logs
- [ ] Multiple phone number support
- [ ] Template creation from UI
- [ ] Scheduling (send at specific times)
- [ ] Conditional logic (if X then send Y)
- [ ] Analytics dashboard (messages sent, delivered, read)
- [ ] Webhook integration for delivery status
- [ ] Rich media support (images, documents, videos)

### Performance Optimizations
- [ ] Template caching in localStorage
- [ ] Lazy loading for large card lists
- [ ] Pagination for cards (if > 50)
- [ ] Debounced auto-save

## Support & Resources

### Meta Documentation
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
- [Cloud API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference)

### Firebase Documentation
- [Firestore Docs](https://firebase.google.com/docs/firestore)
- [Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

### Contact
For issues or questions about this module, check:
1. Browser console for error logs
2. Firestore console for data issues
3. Meta Business Manager for API/template issues
4. Firebase hosting logs for deployment issues

---

**Last Updated**: February 12, 2026
**Version**: 1.0
**Module**: WhatsApp Business API Integration
**File**: `src/pages/whatsapp-settings.html`
