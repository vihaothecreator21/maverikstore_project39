# Auth And Admin Module

## Scope

This module covers login/register, JWT session handling, role-based access control, user profile APIs, admin guard, admin dashboard, product/category management, order management, and revenue reporting.

## Important Files

| Area | Files |
| --- | --- |
| Auth routes | `backend/src/routes/auth.routes.ts` |
| Auth controller/service | `backend/src/controllers/auth.controller.ts`, `backend/src/services/auth.service.ts` |
| User profile | `backend/src/routes/user.routes.ts`, `user.controller.ts`, `user.service.ts`, `user.repository.ts` |
| Auth middleware | `backend/src/middlewares/auth.middleware.ts` |
| Admin routes/controller | `backend/src/routes/admin.routes.ts`, `backend/src/controllers/admin.controller.ts` |
| Admin services | `backend/src/services/dashboard.service.ts`, `backend/src/services/adminReport.service.ts` |
| Admin repository | `backend/src/repositories/admin.repository.ts` |
| Frontend auth | `src/assets/js/login.js`, `register.js`, `auth-utils.js`, `navbar.js` |
| Profile UI | `src/profile.html`, `src/assets/js/profile.js` |
| Admin UI | `src/admin/*.html`, `src/admin/assets/js/*.js`, `src/admin/assets/admin.css` |

## Auth Flow

```text
login/register form
  -> /api/v1/auth/login or /register
  -> Zod validation
  -> AuthService
  -> bcrypt compare/hash
  -> JWT signed with JWT_SECRET
  -> localStorage.authToken + localStorage.user
```

`auth-utils.js` syncs guest cart from `localStorage.maverik_cart` to server cart after successful login.

## RBAC

| Layer | Responsibility |
| --- | --- |
| Prisma enum `Role` | Defines `CUSTOMER`, `ADMIN`, `SUPER_ADMIN` |
| `authMiddleware` | Verifies Bearer JWT and checks user still exists |
| `requireAdmin` | Allows only `ADMIN` and `SUPER_ADMIN` |
| `admin-guard.js` | Frontend redirect/UX guard |

Backend must always enforce admin access even if frontend already checks role.

## Admin Dashboard APIs

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/admin/stats` | Overview revenue/orders/products/customers |
| `GET /api/v1/admin/revenue` | Revenue grouped by day/week/month/year |
| `GET /api/v1/admin/revenue/payment` | Revenue by payment method |
| `GET /api/v1/admin/products/stats` | Best sellers, low stock, category revenue |
| `GET /api/v1/admin/customers/stats` | Customer totals and top spenders |
| `GET /api/v1/admin/export/orders` | Flat order export data |

Admin order management lives under `/api/v1/admin/orders` in `order.routes.ts`.

## Admin Frontend Pages

| Page | Script | Purpose |
| --- | --- | --- |
| `admin/index.html` | `admin-dashboard.js` | Overview stats/charts/recent orders |
| `admin/products.html` | `admin-products.js` | Product CRUD |
| `admin/categories.html` | `admin-categories.js` | Category CRUD |
| `admin/orders.html` | `admin-orders.js` | Order state management |
| `admin/revenue.html` | `admin-revenue.js` | Reports, charts, CSV/XLSX/PDF export |

## Reporting Rules

- Current realized revenue counts orders in `DELIVERED` or `COMPLETED`.
- Revenue period grouping uses `updatedAt` to reflect when order became delivered/completed.
- Export labels are Vietnamese and map raw enum values to readable text.
- Use SheetJS for Excel-friendly Vietnamese output when possible.

## Known Follow-ups

- `backend/.env.example` should be synced with validated env vars.
- Multiple frontend files still duplicate API base URL logic.
- If adding new roles, update Prisma schema, backend middleware/route guards, and `admin-guard.js`.
- Rate limit is in-memory; Redis would be needed for multi-server production.
