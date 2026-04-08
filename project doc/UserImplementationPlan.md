# 👤 User Profile & Account Features Implementation Plan

**Date**: April 8, 2026  
**Status**: Planning Phase  
**Priority**: Medium (After Cart System Complete)

---

## 📋 Overview

The navbar has a user dropdown menu that appears after login with 4 menu items. Currently **3 pages are missing** and need to be implemented:

```
Login Now (Guest) ↓
  ↓ After Login ↓
👤 [User Name] ↓
  ├─ 👤 Profile → account.html (❌ MISSING)
  ├─ 📦 Orders → orders.html (❌ MISSING)
  ├─ ⚙️ Settings → settings.html (❌ MISSING)
  └─ 🚪 Logout → handleLogout() (✅ EXISTS)
```

---

## 🔍 Current Implementation Status

### ✅ Already Working

- **navbar.js** - Dropdown menu UI builder (`buildUserMenu()`)
- **updateNavbarState()** - Switches between Login Button ↔ User Dropdown
- **handleLogout()** - Clears auth, user, cart data
- **User display** - Shows first name in dropdown button
- **Dropdown HTML** - Elements exist in all 8 HTML files:
  - `userNavDropdown` (dropdown container, `d-none` by default)
  - `userNameDisplay` (shows user's first name)
  - `userDropdownMenu` (populated dynamically)

### ❌ Missing Pages

1. **account.html** - User profile & account info
2. **orders.html** - Order history & details
3. **settings.html** - Account settings & preferences

---

## 📄 Phase 1: account.html (User Profile Page)

### Purpose

Display user account information and profile settings.

### Features to Include

#### 1.1 Profile Header

```
┌─────────────────────────────────────────┐
│ 👤 [User Avatar]                        │
│    [User Name]                          │
│    [User Email]                         │
│    Member since: [Join Date]            │
└─────────────────────────────────────────┘
```

**Data Source**: From localStorage `user` object:

```javascript
{
  id: number,
  name: string,
  email: string,
  createdAt: Date
}
```

#### 1.2 Account Information Section

```
┌─ Account Information ─────────────────┐
│ Name:          [User Name]            │
│ Email:         [user@email.com]       │
│ Phone:         [+1234567890]          │
│ Registration:  [Date Format]          │
│ Account Status: Active                │
└───────────────────────────────────────┘
```

**Fields to Display**:

- Name (from user.name)
- Email (from user.email)
- Phone (if available in user object)
- Registration date (from user.createdAt)
- Account status badge

#### 1.3 Address Management Section

```
┌─ Delivery Addresses ──────────────────┐
│ Default Address:                      │
│ [Street Address]                      │
│ [City, State, ZIP]                    │
│ [Country]                             │
│                                       │
│ [Edit Button] [Delete Button]         │
│ [+ Add New Address Button]            │
└───────────────────────────────────────┘
```

**API Requirements**:

- GET `/user/addresses` - Fetch user addresses
- POST `/user/addresses` - Create new address
- PUT `/user/addresses/:id` - Update address
- DELETE `/user/addresses/:id` - Delete address

#### 1.4 Edit Profile Button

- Opens modal to edit name/phone
- PUT `/user/profile` - Update profile data

### Data Flow

```
1. Page load → GET /user/profile (if not in localStorage)
2. Display user data
3. User clicks "Edit" → Open modal
4. Submit form → PUT /user/profile
5. Update localStorage "user" object
6. Refresh display
```

### Components Needed

- Profile header card
- Account info section
- Address management with add/edit/delete
- Edit profile modal
- Loading states
- Error handling

---

## 📦 Phase 2: orders.html (Order History Page)

### Purpose

Display user's order history with ability to view details and track status.

### Features to Include

#### 2.1 Order List View

```
┌──────────────────────────────────────────────────┐
│ Order ID    | Date       | Status   | Total      │
├──────────────────────────────────────────────────┤
│ #ORD-001    | Mar 15     | Delivered| $124.99   │
│ #ORD-002    | Mar 10     | Shipped  | $89.50    │
│ #ORD-003    | Mar 5      | Processing| $250.00  │
└──────────────────────────────────────────────────┘
```

**Data from API**: GET `/orders`

```javascript
{
  id: number,
  orderNumber: string,
  createdAt: Date,
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled",
  total: number,
  items: [{productId, quantity, price}]
}
```

#### 2.2 Order Status Badges

```
🟡 Processing  - Order received, being prepared
🟠 Shipped     - On the way
🟢 Delivered   - Arrived
🔴 Cancelled   - Order cancelled
```

#### 2.3 Order Details Modal

When user clicks an order:

```
┌─ Order #ORD-001 ──────────────────────┐
│ Order Date: Mar 15, 2026              │
│ Status: 🟢 Delivered                  │
│ Tracking: [Tracking Number]           │
│                                       │
│ Items:                                │
│ • Product Name × 2 - $49.99          │
│ • Product Name × 1 - $25.01          │
│                                       │
│ Subtotal: $124.99                     │
│ Shipping: FREE                        │
│ Total: $124.99                        │
│                                       │
│ [Download Invoice] [Track Shipment]   │
└───────────────────────────────────────┘
```

#### 2.4 Filters & Sorting

- **Filter by Status**: All, Processing, Shipped, Delivered, Cancelled
- **Sort by**: Most Recent, Oldest First, Price High-Low, Price Low-High
- **Search**: By order number

#### 2.5 Pagination

- Show 10 orders per page
- Pagination controls at bottom

### API Requirements

```
GET  /orders                    - Get user's orders (paginated)
GET  /orders/:id               - Get order details
POST /orders/:id/download      - Download invoice as PDF
GET  /orders/:id/tracking      - Get tracking info
```

### Components Needed

- Order list table with sorting
- Status badge component
- Order details modal
- Pagination component
- Filter/search bar
- Loading skeleton
- Empty state message
- Error handling

---

## ⚙️ Phase 3: settings.html (Account Settings Page)

### Purpose

Manage account preferences, notifications, and security settings.

### Features to Include

#### 3.1 Settings Tabs

**Tab 1: General Settings**

```
┌─ General Settings ─────────────────────┐
│ ☐ Newsletter Subscription              │
│ ☐ Email Notifications                  │
│ ☐ Marketing Communications             │
│                                        │
│ Language: [Dropdown: English/Vietnamese]
│ Currency: [Dropdown: USD/$]            │
│ Theme: [Light / Dark / Auto]           │
│                                        │
│ [Save Changes]                         │
└────────────────────────────────────────┘
```

**API**: PUT `/user/settings/general`

#### 3.2 Security Settings

```
┌─ Security Settings ────────────────────┐
│ Change Password                        │
│ Current Password: [••••••••]          │
│ New Password:     [••••••••]          │
│ Confirm Password: [••••••••]          │
│ [Change Password]                      │
│                                        │
│ Two-Factor Authentication              │
│ Status: ☐ Disabled  ☐ Enabled         │
│ [Enable 2FA]                           │
│                                        │
│ Active Sessions: 3 devices             │
│ • Chrome on Windows - Last active: Now  │
│ • Safari on iPhone - Last active: 2h  │
│ [Logout All Other Sessions]            │
└────────────────────────────────────────┘
```

**APIs**:

- PUT `/user/change-password`
- GET `/user/2fa/status`
- POST `/user/2fa/enable`
- POST `/user/2fa/verify`
- GET `/user/sessions`
- DELETE `/user/sessions/others`

#### 3.3 Privacy Settings

```
┌─ Privacy Settings ─────────────────────┐
│ ☐ Make profile public                 │
│ ☐ Show order history in profile       │
│ ☐ Allow reviews from others           │
│                                        │
│ Data & Privacy                         │
│ [Download My Data] - GDPR request      │
│ [Delete My Account] - Warning ⚠️      │
│                                        │
│ [Save Changes]                         │
└────────────────────────────────────────┘
```

**APIs**:

- PUT `/user/settings/privacy`
- POST `/user/data/download` - GDPR data export
- DELETE `/user/account` - Account deletion

#### 3.4 Notification Preferences

```
┌─ Notifications ────────────────────────┐
│ Order Notifications:                   │
│ ☐ Order Confirmed                      │
│ ☐ Order Shipped                        │
│ ☐ Order Delivered                      │
│ ☐ Return Approved                      │
│                                        │
│ Account Notifications:                 │
│ ☐ Security Alerts                      │
│ ☐ Password Changes                     │
│ ☐ Login from New Device                │
│                                        │
│ Marketing:                             │
│ ☐ New Product Launches                 │
│ ☐ Sales & Discounts                    │
│                                        │
│ [Save Preferences]                     │
└────────────────────────────────────────┘
```

**API**: PUT `/user/settings/notifications`

---

## 🛠️ Technical Implementation Details

### 3.1 Backend Requirements

**New API Endpoints Needed**:

```typescript
// User Profile
GET    /user/profile
PUT    /user/profile
GET    /user/addresses
POST   /user/addresses
PUT    /user/addresses/:id
DELETE /user/addresses/:id

// Orders
GET    /orders?page=1&limit=10&status=all
GET    /orders/:id
POST   /orders/:id/download
GET    /orders/:id/tracking

// Settings
GET    /user/settings
PUT    /user/settings/general
PUT    /user/settings/privacy
PUT    /user/settings/notifications
PUT    /user/change-password
GET    /user/2fa/status
POST   /user/2fa/enable
POST   /user/2fa/verify
GET    /user/sessions
DELETE /user/sessions/others

// GDPR & Account
POST   /user/data/download
DELETE /user/account
```

**Database Schema Updates** (Prisma):

```prisma
model User {
  // Existing
  id        Int     @id @default(autoincrement())
  email     String  @unique
  name      String
  password  String

  // Add
  phone     String?
  avatar    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  addresses Address[]
  orders    Order[]
  sessions  Session[]
  preferences UserPreferences?
}

model Address {
  id        Int     @id @default(autoincrement())
  userId    Int
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  street    String
  city      String
  state     String
  zipCode   String
  country   String
  isDefault Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Order {
  id           Int     @id @default(autoincrement())
  userId       Int
  user         User    @relation(fields: [userId], references: [id])

  orderNumber  String  @unique
  status       String  @default("pending") // pending, processing, shipped, delivered, cancelled
  total        Decimal

  items        OrderItem[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  orderId   Int
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)

  productId Int
  quantity  Int
  price     Decimal
}

model UserPreferences {
  id                    Int     @id @default(autoincrement())
  userId                Int     @unique
  user                  User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  newsletter            Boolean @default(false)
  orderNotifications    Boolean @default(true)
  securityAlerts        Boolean @default(true)
  marketing             Boolean @default(false)

  language              String  @default("en")
  theme                 String  @default("light")

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model Session {
  id        Int     @id @default(autoincrement())
  userId    Int
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  token     String  @unique
  device    String
  userAgent String
  ipAddress String

  createdAt DateTime @default(now())
  expiresAt DateTime
}
```

### 3.2 Frontend Structure

**File Organization**:

```
src/
├── account.html         (Profile & addresses)
├── orders.html          (Order history & details)
├── settings.html        (Account settings)
├── assets/js/
│   ├── pages/
│   │   ├── account-page.js
│   │   ├── orders-page.js
│   │   └── settings-page.js
│   └── api/
│       ├── user-api.js
│       ├── orders-api.js
│       └── settings-api.js
```

**Common Components** (Reusable):

```
- LoadingSpinner
- EmptyState (No data)
- ErrorAlert
- SuccessToast
- ConfirmDialog (for deletions)
- FormValidator
```

---

## 📊 Implementation Priority & Timeline

| Phase     | Task                             | Effort    | Priority  | Dependencies         |
| --------- | -------------------------------- | --------- | --------- | -------------------- |
| **1**     | account.html (Profile page)      | 3-4 hours | 🔴 High   | Cart system complete |
| **2**     | orders.html (Order history)      | 4-5 hours | 🔴 High   | Backend order APIs   |
| **3**     | settings.html (Account settings) | 3-4 hours | 🟡 Medium | Settings APIs        |
| **Total** | All 3 pages + APIs               | ~12 hours | 🔴 High   | After cart ✅        |

---

## ✅ Implementation Checklist

### Phase 1: account.html

- [ ] Create HTML structure
- [ ] Add profile header with avatar
- [ ] Add account information section
- [ ] Add address management UI
- [ ] Create edit profile modal
- [ ] Implement account-page.js (load data, handle events)
- [ ] Create user-api.js (API calls)
- [ ] Add error handling & loading states
- [ ] Test all CRUD operations
- [ ] Style responsive design

### Phase 2: orders.html

- [ ] Create HTML structure with table
- [ ] Add status badge styling
- [ ] Add order details modal
- [ ] Implement orders-page.js
- [ ] Create orders-api.js
- [ ] Add pagination logic
- [ ] Add filter/sort functionality
- [ ] Add order tracking modal
- [ ] Add invoice download
- [ ] Test pagination & filtering
- [ ] Style responsive design

### Phase 3: settings.html

- [ ] Create tab navigation UI
- [ ] Add general settings form
- [ ] Add security settings section
- [ ] Add privacy settings form
- [ ] Add notification preferences
- [ ] Implement settings-page.js
- [ ] Create settings-api.js
- [ ] Add password change modal
- [ ] Add 2FA setup flow
- [ ] Test all toggle switches
- [ ] Add confirmation dialogs for destructive actions

### Backend APIs

- [ ] Create user profile controller & routes
- [ ] Create orders controller & routes
- [ ] Create settings controller & routes
- [ ] Add database migrations
- [ ] Add input validation
- [ ] Add authorization middleware
- [ ] Test all endpoints
- [ ] Add error handling

---

## 🔗 Dependencies & Constraints

### Hard Dependencies

- ✅ Cart system implementation (must complete first)
- ✅ User authentication system (already working)
- ✅ Bootstrap & styling framework (already available)

### Soft Dependencies

- Backend order management (order creation in cart checkout)
- Payment system (for order creation)

### Constraints

- Must maintain responsive design (mobile-first)
- Must follow Bootstrap grid system
- Must use existing navbar structure
- Must respect authentication middleware on backend
- GDPR compliance for data export/deletion

---

## 🚀 Getting Started

### Step 1: Start with account.html

- Simpler than orders
- Just user profile + address management
- No pagination or complex filtering needed

### Step 2: Then orders.html

- More complex with pagination
- Requires order tracking integration
- PDF invoice generation

### Step 3: Finally settings.html

- Most complex with many toggles
- Requires advanced features (2FA, GDPR)
- Can defer some advanced features (2FA) to Phase 2

---

## 📝 Notes

- All three pages should include **navbar** with user dropdown
- Use **Bootstrap modals** for edit dialogs
- Implement **error boundaries** for API failures
- Add **loading skeleton screens** for better UX
- Use **localStorage** for temporary form data caching
- Dispatch **custom events** for navbar updates (like logout does)
- Consider **accessibility** (WCAG 2.1 AA standards)

---

**Next Step**: Review this plan and prioritize which page to implement first. Recommend: **account.html → orders.html → settings.html**
