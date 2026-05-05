# Maverik Store - Project Analysis & Logic Summary

This document serves as a persistent context guide for the Maverik Store project. It outlines the core architecture, key files, and important business logic to prevent redundant scanning in future sessions.

## 1. Core Architecture
- **Pattern**: Clean Layered Architecture (`Controller` → `Service` → `Repository` → `Prisma (DB)`).
- **Dependency Injection**: Manual DI managed via `src/container.ts`.
- **Database**: PostgreSQL/MySQL via Prisma.

## 2. Order & Payment Lifecycle (Crucial Logic)

### State Machine (`OrderStatus`)
Defined in `backend/prisma/schema.prisma` and enforced in `OrderRepository.VALID_TRANSITIONS`:
1. `PENDING_PAYMENT`: Initial state for VNPay orders awaiting IPN confirmation. (Auto-cancels after 15 mins if unpaid).
2. `PENDING`: Initial state for COD orders OR VNPay orders that have been successfully paid. (Awaiting Admin confirmation).
3. `CONFIRMED` → `PROCESSING` → `SHIPPING` → `DELIVERED` → `COMPLETED`.
4. `CANCELLED` / `RETURNED` are terminal/fallback states.

### Key Files & Logic
- **`backend/src/repositories/order.repository.ts`**
  - `createOrderAtomic`: Uses Prisma `$transaction`. Locks stock rows (`FOR UPDATE`), throws `INSUFFICIENT_STOCK` if needed. Sets initial status to `PENDING_PAYMENT` (for VNPay) or `PENDING` (for COD).
  - `findAll`: Supports pagination, status filtering, and exact date-range filtering (`startDate`, `endDate`).
  - `findTimedOutOrders`: Queries for `PENDING_PAYMENT` and `PENDING` orders older than 15 minutes.
  
- **`backend/src/services/payment.service.ts`**
  - Handles VNPay URL generation and IPN verification.
  - Validates signatures securely using `crypto` and sorts parameters accurately.
  - Handles cancellation (Return code `24`).
  
- **`backend/src/repositories/payment.repository.ts`**
  - `confirmPaymentAndOrder`: Idempotent atomic transaction. Marks Payment as `SUCCESS`. Transitions `OrderStatus` from `PENDING_PAYMENT` → `PENDING` (or `PENDING` → `CONFIRMED`).
  
- **`backend/src/jobs/orderTimeout.job.ts`**
  - Runs every minute. Sweeps abandoned orders (`PENDING` or `PENDING_PAYMENT` > 15 mins). Restores stock and writes to `AuditLog`.

## 3. Category Management

### Key Files & Logic
- **`backend/src/services/category.service.ts`**
  - **Server-Side Slugs**: Backend strictly owns slug generation using `slugify`.
  - `generateUniqueSlug`: Automatically appends counters (e.g., `sofa-1`) to resolve collisions.
- **`backend/src/schemas/category.schema.ts`**
  - Client does NOT send `slug`. Only `name` (min 2 chars, max 100) and `description`. Uses Zod with strict Vietnamese error messages.

## 4. Admin Dashboard (Frontend)

### Architecture
- Pure HTML/JS/CSS (No React/Vue). 
- State and UI are managed dynamically in `.js` files in `src/admin/assets/js/`.
- **`admin-guard.js`**: Intercepts unauthenticated users. Defines `ORDER_STATUS` UI mapping (colors, labels).

### Key Modules
- **`admin-orders.js` & `orders.html`**
  - Admin view with Status Tabs (includes `💳 Chờ thanh toán`).
  - Supports `Từ` (Start) - `Đến` (End) date filtering sent directly to backend API.
  - Implements client-side search (ID, name, email, phone) on top of server paginated data.
  
- **`admin-revenue.js` & `revenue.html`**
  - **Exporting**: Uses `SheetJS` (`xlsx.full.min.js`) for accurate Vietnamese character encoding in Excel exports. Also supports CSV (`PapaParse`).
  - Charts built with `Chart.js`.
  - Groups revenue dynamically by day/week/month.

- **`admin-categories.js` & `categories.html`**
  - Form logic sends only `name` and `description` payload. Read-only view for backend-generated slugs.

## 5. Helpful Reminders for Future AI Sessions
1. **Idempotency**: Always verify current database state before applying updates (especially for Payments and Orders).
2. **Vietnamese Encoding**: If generating files (PDF, Excel, CSV), beware of UTF-8 and font encoding issues. Prefer `SheetJS` for `.xlsx` or UTF-8 BOM for `.csv`.
3. **Data Types**: Prisma returns `Decimal` for currencies. Always parse properly (`Number(val)`) before returning to the frontend or using in Math operations. 
4. **Timezones**: Order date queries assume +07:00 (Vietnam). The backend date schema explicitly coerces string queries into VN-aligned Date objects.
