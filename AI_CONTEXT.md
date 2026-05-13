# AI Context: Maverik Store

## Purpose
Maverik Store is a fullstack e-commerce project for furniture/home products. It includes a customer storefront, cart/checkout, VNPay payment flow, user profile/order history, and an admin dashboard for products, categories, orders, revenue, and exports.

## Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | Vite, Vanilla JS ES modules, Bootstrap 5, Bootstrap Icons, SCSS, Swiper |
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Database | MySQL |
| Auth | JWT, bcryptjs, role-based access |
| Validation | Zod |
| Reports/Charts | Chart.js, SheetJS, PapaParse, jsPDF assets in admin |
| Testing | Jest/ts-jest for backend |

## Folder Structure

| Path | Purpose |
| --- | --- |
| `src/` | Vite frontend root with multi-page HTML files |
| `src/assets/js/` | Storefront JS modules: auth, products, cart, checkout, profile, homepage |
| `src/assets/scss/` | Main SCSS, variables, utilities, Swiper styling |
| `src/assets/images/` | Static storefront images |
| `src/admin/` | Admin HTML pages |
| `src/admin/assets/js/` | Admin page logic and admin guard |
| `src/admin/assets/` | Admin CSS, local vendor libs, icon fonts |
| `backend/src/` | Express TypeScript backend source |
| `backend/src/routes/` | Route declarations and API mounting |
| `backend/src/controllers/` | Request parsing, schema validation, response formatting |
| `backend/src/services/` | Business logic |
| `backend/src/repositories/` | Prisma database access |
| `backend/src/schemas/` | Zod request/query schemas |
| `backend/src/middlewares/` | Auth, admin guard, sanitize, rate limit, errors |
| `backend/src/config/` | Environment validation, Prisma client, VNPay config |
| `backend/src/jobs/` | Background jobs such as order timeout cleanup |
| `backend/prisma/` | Prisma schema and seed data |
| `backend/tests/` | Backend tests |
| `module/` | Architecture notes, module reports, historical analysis |

Ignore `node_modules/`, `dist/`, generated build outputs, logs, caches, and vendor bundles unless the task explicitly targets them.

## Architecture And Data Flow

Backend uses a clean layered pattern:

`HTTP request -> route -> controller -> service -> repository -> Prisma -> MySQL`

Instances are wired manually in `backend/src/container.ts`. Controllers import ready-made service instances from the container.

Frontend is a multi-page app. HTML pages load ES module scripts directly. Common client state is stored in browser storage:

| State | Storage | Notes |
| --- | --- | --- |
| JWT | `localStorage.authToken` | Sent as `Authorization: Bearer <token>` |
| User | `localStorage.user` | Includes role for frontend admin guard |
| Guest cart | `localStorage.maverik_cart` | Synced to server after login |
| Login redirect | `sessionStorage.redirectAfterLogin` | Used by guarded pages |

API base URL is centralized in `src/assets/js/api-config.js`, but several older frontend modules still define local `getApiBase()` helpers.

## Important Features And Modules

| Feature | Frontend files | Backend files |
| --- | --- | --- |
| Auth/login/register | `src/login.html`, `src/register.html`, `src/assets/js/login.js`, `register.js`, `auth-utils.js` | `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `user.repository.ts`, `auth.schema.ts` |
| Products/list/detail | `src/products.html`, `product-detail.html`, `products.js`, `product-detail.js` | `product.routes.ts`, `product.controller.ts`, `product.service.ts`, `product.repository.ts`, `product.schema.ts` |
| Homepage dynamic products | `src/index.html`, `src/assets/js/index-page.js`, `swiper.js` | Best-seller endpoint in product route/controller/service/repository |
| Categories | `src/admin/categories.html`, `admin-categories.js` | `category.routes.ts`, `category.service.ts`, `category.repository.ts`, `category.schema.ts` |
| Cart | `src/cart.html`, `cart.js`, `cart-page.js` | `cart.routes.ts`, `cart.controller.ts`, `cart.service.ts`, `cart.repository.ts`, `cart.schema.ts` |
| Checkout/orders | `src/checkout.html`, `checkout.js`, `profile.js` | `order.routes.ts`, `order.controller.ts`, `order.service.ts`, `order.repository.ts`, `order.schema.ts` |
| VNPay payment | `src/vnpay-return.html`, payment status pages, `checkout.js` | `payment.routes.ts`, `payment.controller.ts`, `payment.service.ts`, `payment.repository.ts`, `vnpay.gateway.ts`, `vnpay.config.ts` |
| Admin dashboard/revenue | `src/admin/index.html`, `revenue.html`, `admin-dashboard.js`, `admin-revenue.js` | `admin.routes.ts`, `admin.controller.ts`, `dashboard.service.ts`, `adminReport.service.ts`, `admin.repository.ts` |
| Admin orders | `src/admin/orders.html`, `admin-orders.js` | `order.routes.ts`, `order.controller.ts`, `order.service.ts`, `order.repository.ts` |
| Admin products | `src/admin/products.html`, `admin-products.js` | Product route/controller/service/repository |

## Database Models

Defined in `backend/prisma/schema.prisma`.

| Model | Key relationships |
| --- | --- |
| `User` | Has one `Cart`; has many `Order`, `Review`, `Favorite`, `AuditLog` |
| `Category` | Has many `Product` |
| `Product` | Belongs to `Category`; has many `ProductImage`, `CartItem`, `OrderDetail`, `Review`, `Favorite` |
| `ProductImage` | Belongs to `Product` |
| `Cart` | Belongs to `User`; has many `CartItem` |
| `CartItem` | Belongs to `Cart` and `Product`; unique by cart/product/size/color |
| `Order` | Belongs to `User`; has many `OrderDetail`; has one `Payment` |
| `OrderDetail` | Belongs to `Order` and `Product` |
| `Payment` | Belongs to `Order`; tracks method/status/transaction |
| `Review` | Belongs to `User` and `Product`; unique user/product |
| `Favorite` | Belongs to `User` and `Product`; unique user/product |
| `AuditLog` | Belongs to `User`; records important entity changes |

Important enums:

| Enum | Values |
| --- | --- |
| `Role` | `CUSTOMER`, `ADMIN`, `SUPER_ADMIN` |
| `OrderStatus` | `PENDING_PAYMENT`, `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPING`, `DELIVERED`, `COMPLETED`, `CANCELLED`, `RETURNED` |
| `PaymentStatus` | `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED` |

Order state transitions are enforced in `backend/src/repositories/order.repository.ts` via `VALID_TRANSITIONS`.

## API Routes

Routes are mounted under `/api` in `backend/src/server.ts`, then under `/api/v1` in `backend/src/routes/index.ts`.

| Base route | Module | Notes |
| --- | --- | --- |
| `GET /api` | API info | Shows endpoint list |
| `GET /api/health` | Health | Environment, uptime, memory |
| `/api/v1/auth` | `auth.routes.ts` | Register, login, logout, profile |
| `/api/v1/users` | `user.routes.ts` | Authenticated profile and password updates |
| `/api/v1/products` | `product.routes.ts` | Public list/detail/best-sellers; admin create/update/delete |
| `/api/v1/categories` | `category.routes.ts` | Public read; admin create/update/delete |
| `/api/v1/cart` | `cart.routes.ts` | Authenticated cart CRUD and guest cart sync |
| `/api/v1/orders` | `order.routes.ts` | Authenticated user order placement/history/cancel |
| `/api/v1/admin/orders` | `order.routes.ts` | Admin order listing/detail/status update |
| `/api/v1/admin` | `admin.routes.ts` | Dashboard stats, revenue, exports, customer/product stats |
| `/api/v1/payments` | `payment.routes.ts` | VNPay create/return/IPN |

## Authentication And Authorization

- Registration and login live in `auth.controller.ts` and `auth.service.ts`.
- Passwords are hashed with bcrypt.
- JWT payload includes `userId`, `email`, and `role`.
- Protected routes use `authMiddleware` from `backend/src/middlewares/auth.middleware.ts`.
- Admin routes additionally use `requireAdmin`, allowing only `ADMIN` and `SUPER_ADMIN`.
- Frontend admin pages call `requireAdminAccess()` from `src/admin/assets/js/admin-guard.js`, but backend authorization is the source of truth.

## Order And Payment Rules

- COD/BANK/MOMO orders start as `PENDING`.
- VNPay orders start as `PENDING_PAYMENT`.
- VNPay IPN confirms payment and transitions the order.
- Order creation is atomic and decrements stock in a Prisma transaction.
- Stock is restored when orders are cancelled where applicable.
- Cancelled orders mark payment as `FAILED`.
- Delivered/completed orders mark payment as `SUCCESS` for COD-like flows.
- `orderTimeout.job.ts` cancels stale unpaid/pending orders.
- Revenue reporting currently counts realized revenue from `DELIVERED` and `COMPLETED` orders, using `updatedAt` for reporting ranges.

## Environment Variables

Backend env is validated in `backend/src/config/env.config.ts`.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development`, `production`, or `test` |
| `PORT` | Backend port, default `5000` |
| `API_VERSION` | Usually `v1` |
| `DATABASE_URL` | MySQL connection URL, must start with `mysql://` |
| `JWT_SECRET` | JWT signing secret, minimum 32 chars |
| `JWT_EXPIRE` | Expiry like `7d`, `24h`, `3600s` |
| `BCRYPT_ROUNDS` | bcrypt cost, 6-12 |
| `CORS_ORIGINS` | Comma-separated allowed browser origins |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` |
| `VNPAY_TMN_CODE` | VNPay terminal code |
| `VNPAY_HASH_SECRET` | VNPay signing secret |
| `VNPAY_RETURN_URL` | Backend VNPay return URL |
| `VNPAY_FRONTEND_RETURN` | Frontend result page URL |
| `VNPAY_IPN_URL` | VNPay IPN callback URL |

Known issue: `backend/.env.example` may be incomplete/outdated versus `env.config.ts` because current env validation requires VNPay variables and a 32+ char `JWT_SECRET`.

## Setup And Commands

Root frontend:

| Command | Purpose |
| --- | --- |
| `npm install` | Install frontend deps |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build frontend to `dist/` |
| `npm run preview` | Preview production build |

Backend:

| Command | Purpose |
| --- | --- |
| `cd backend && npm install` | Install backend deps |
| `npm run dev` | Start backend with nodemon/tsx |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled server |
| `npm test` | Run Jest tests |
| `npm run test:watch` | Watch tests |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run dev migration |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run prisma:seed` | Seed database |

No lint script is currently defined.

## Coding Conventions

- Backend imports often use `.js` extensions in ESM route/controller files even when source files are `.ts`; preserve the existing pattern.
- Use Zod schemas for request body/query validation before service calls.
- Keep business rules in services; keep Prisma-only logic in repositories.
- Use `sendSuccess`, `sendError`, `APIError`, and `catchAsync` for consistent responses.
- Convert Prisma `Decimal` values to `number` before returning/doing frontend math.
- Slugs are generated server-side for products/categories.
- Keep admin-only mutations protected by both `authMiddleware` and `requireAdmin`.
- Frontend is plain JS modules, not React/Vue. Prefer existing page-local module patterns.
- User-facing text is mostly Vietnamese; be careful with encoding when editing files.
- Do not edit vendor bundles in `src/admin/assets/*.min.js` unless explicitly required.

## Files To Inspect Before Editing

| Task | Inspect first |
| --- | --- |
| Backend boot/config | `backend/src/server.ts`, `backend/src/config/env.config.ts`, `backend/src/routes/index.ts` |
| Auth/roles | `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.middleware.ts`, `user.repository.ts` |
| Products | `product.routes.ts`, `product.controller.ts`, `product.service.ts`, `product.repository.ts`, `product.schema.ts`, `src/assets/js/products.js`, `product-detail.js` |
| Homepage merchandising | `src/index.html`, `src/assets/js/index-page.js`, `src/assets/js/swiper.js`, product best-seller backend methods |
| Cart | `cart.routes.ts`, `cart.controller.ts`, `cart.service.ts`, `cart.repository.ts`, `src/assets/js/cart.js`, `cart-page.js`, `auth-utils.js` |
| Checkout/orders | `order.routes.ts`, `order.controller.ts`, `order.service.ts`, `order.repository.ts`, `order.schema.ts`, `src/assets/js/checkout.js`, `profile.js` |
| Payments/VNPay | `payment.routes.ts`, `payment.controller.ts`, `payment.service.ts`, `payment.repository.ts`, `vnpay.config.ts`, `vnpay.gateway.ts` |
| Admin dashboard/revenue | `admin.routes.ts`, `admin.controller.ts`, `dashboard.service.ts`, `adminReport.service.ts`, `admin.repository.ts`, `admin-dashboard.js`, `admin-revenue.js` |
| Admin orders | `order.routes.ts`, `order.service.ts`, `order.repository.ts`, `admin-orders.js`, `admin-guard.js` |
| Database changes | `backend/prisma/schema.prisma`, `backend/prisma/seed.ts`, relevant repository/service |
| Styling | `src/assets/scss/style.scss`, `_variables.scss`, `_custom.scss`, `swiper/_swiper.scss`, `src/admin/assets/admin.css` |

## Current Known Issues / TODOs

- `backend/.env.example` likely needs updating to match current validated env vars.
- Some documentation under `module/` is historical and may not fully match current code.
- Several frontend modules duplicate API base URL logic instead of using `api-config.js`.
- Vite build passes but warns that some admin vendor scripts without `type="module"` cannot be bundled; they are currently loaded as standalone scripts.
- Review/favorites models exist, but full public API/routes for reviews/favorites are not mounted yet.

## Current Git Context

- Active branch observed during context creation: `semifix`.
- Latest pushed commit at time of creation: `70cb46b feat: update merchandising and revenue reporting`.
