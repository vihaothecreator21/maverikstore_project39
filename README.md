# Maverik Store

Maverik Store is a full-stack fashion e-commerce project built for learning and portfolio use. It combines a Vite storefront, a Bootstrap admin UI, an Express TypeScript API, Prisma ORM, and MySQL.

## Project Overview

The project demonstrates common online-store workflows: product browsing, account authentication, cart management, order creation, admin product management, reporting, VNPay payment integration, Supabase image storage, and AI support chat.

## Problem Statement

Small fashion shops need a simple storefront plus admin tools for products, orders, and revenue tracking. Maverik Store models that workflow in a modular monolith suitable for an Intern/Fresher CV project.

## Main Features

### Completed

- JWT authentication with bcrypt password hashing.
- Protected profile endpoint.
- Role-based admin authorization for product and admin routes.
- Product listing, detail, pagination, filtering, and admin CRUD APIs.
- Backend cart API with stock validation.
- Order lifecycle logic and payment-related services.
- Centralized API error handling.
- Zod request validation.
- Jest unit and Supertest integration tests.
- GitHub Actions CI for frontend lint/build and backend lint/unit/integration/build/smoke configuration.

### In Progress

- Frontend cart still primarily uses `localStorage` with a backend sync endpoint available after login.
- Checkout and VNPay flows exist in code, but should be tested end-to-end with sandbox credentials before production use.
- Admin dashboard/reporting exists, with additional polish still possible.

### Planned

- Public favorites API mounting.
- More full-stack E2E tests.
- Production deployment hardening.
- Screenshots and live demo links.

## Current Project Status

This repository is CV-ready as a learning project, not a production store. Core backend security checks have been tightened: `/profile` requires a valid JWT, admin product mutations require an admin role from the verified session, JWT secrets must be configured through environment variables, and cart stock checks prevent cumulative quantity overflow. The latest local verification ran backend unit tests, integration tests, lint, and build successfully; GitHub Actions must still be checked on GitHub after push before merging.

## Technologies

| Area | Stack |
| --- | --- |
| Frontend | Vite, Vanilla JavaScript ES modules, Bootstrap 5, Bootstrap Icons, Sass, Swiper |
| Backend | Node.js, Express.js, TypeScript |
| Database | MySQL, Prisma ORM |
| Auth | JWT, bcryptjs |
| Validation | Zod |
| Payments | VNPay |
| Storage | Supabase Storage |
| AI | Google Generative AI |
| Tests | Jest, ts-jest, Supertest |
| CI | GitHub Actions |

## Architecture

```mermaid
flowchart LR
    Client["Vite Frontend"] --> API["Express REST API"]
    API --> Controller["Controllers"]
    Controller --> Service["Services"]
    Service --> Repository["Repositories"]
    Repository --> Prisma["Prisma ORM"]
    Prisma --> DB[("MySQL")]
    Service --> Gateway["VNPay / Supabase / Gemini"]
```

The backend follows `routes -> controllers -> services -> repositories -> Prisma`. Controllers handle HTTP details, services own business rules, repositories isolate database access, and gateways wrap external integrations.

## Folder Structure

```text
.
|-- src/                         # Vite frontend pages and assets
|-- src/admin/                   # Admin dashboard pages
|-- backend/src/controllers/     # HTTP controllers
|-- backend/src/routes/          # Express route definitions
|-- backend/src/services/        # Business logic
|-- backend/src/repositories/    # Prisma data access
|-- backend/src/middlewares/     # Auth, error, sanitize, rate-limit middleware
|-- backend/src/schemas/         # Zod schemas
|-- backend/prisma/schema.prisma # MySQL schema
|-- backend/tests/               # Backend unit and integration tests
|-- docs/                        # Project notes and module documentation
|-- .github/workflows/ci.yml     # CI workflow
`-- AUDIT_REPORT.md             # Review and fix summary
```

## Database Model Overview

Main models include users, pending registrations, products, product images, categories, carts, cart items, orders, order details, payments, reviews, and support-chat related data. Money fields use Prisma `Decimal` to avoid floating-point rounding issues.

## Installation

```bash
git clone https://github.com/vihaothecreator21/maverikstore_project39.git
cd maverikstore_project39
npm install
cd backend
npm install
```

## Environment Configuration

Create backend environment config from the example:

```bash
cd backend
cp .env.example .env
```

Required backend variables include:

```env
NODE_ENV=development
PORT=5001
API_VERSION=v1
DATABASE_URL=mysql://your_db_user:your_db_password@localhost:3306/maverik_store
JWT_SECRET=replace-with-a-random-jwt-secret-at-least-32-chars
JWT_EXPIRE=7d
BCRYPT_ROUNDS=10
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM="Maverik Store <noreply@yourdomain.com>"
OTP_SECRET=replace-with-a-random-otp-secret-at-least-32-chars
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
GEMINI_API_KEY=your-gemini-api-key
VNPAY_TMN_CODE=your-vnpay-tmn-code
VNPAY_HASH_SECRET=replace-with-your-vnpay-hash-secret-at-least-16-chars
```

Never commit `.env` or real secrets.

## Database Migration

From `backend/`:

```bash
npm run prisma:generate
npm run prisma:migrate
```

## Database Seed

From `backend/`:

```bash
npm run prisma:seed
```

## Running Backend

```bash
cd backend
npm run dev
```

Default API base: `http://localhost:5001/api/v1`.

## Running Frontend

```bash
npm run dev
```

Default Vite URL: `http://localhost:5173`.

## Running Tests

```bash
cd backend
npm run test:unit
npm run test:integration
npm test
```

Latest local backend verification: unit tests passed 5 suites / 38 tests, and integration/API tests passed 2 suites / 23 tests. Frontend lint and build also pass locally. The production build compiles to `backend/dist/src/server.js`; local `npm start` HTTP smoke still needs a reachable MySQL database. CI includes a `/api/health` smoke step.

## Production Build

From `backend/`:

```bash
npm run prisma:generate
npm run build
npm start
```

Docker startup uses `npx prisma migrate deploy`, then `npm start`. It does not use `prisma db push --accept-data-loss`.

## API Overview

| Area | Routes |
| --- | --- |
| Auth | `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/profile` |
| Users | `/api/v1/users` |
| Products | `/api/v1/products` |
| Categories | `/api/v1/categories` |
| Cart | `/api/v1/cart` |
| Orders | `/api/v1/orders`, `/api/v1/admin/orders` |
| Admin reports | `/api/v1/admin` |
| Payments | `/api/v1/payments` |
| Support chat | `/api/v1/support-chat` |
| Reviews | `/api/v1/reviews` |

Common response shape:

```json
{
  "status": "success",
  "code": 200,
  "message": "Operation successful",
  "data": {}
}
```

## Demo Account

Demo credentials are not committed. Create accounts with the seed script or through the registration flow in a local environment.

## Screenshots

Screenshots are planned. Add storefront, product detail, cart, checkout, and admin dashboard images before publishing the repository publicly.

## Known Limitations

- Frontend cart is still mostly `localStorage`; backend cart sync exists but is not a full real-time server-cart frontend rewrite.
- Payment needs real VNPay sandbox credentials and callback URL testing before production.
- Docker build/runtime was not locally verified because the Docker daemon was unavailable in this session.
- Production `npm start` health smoke was not locally verified because no MySQL test service was available.
- Checkout/order/payment code exists, but payment is not claimed production-ready without sandbox end-to-end verification.
- No live demo URL is currently documented.
- Email OTP requires a configured Resend API key.
- Supabase is used for product image storage only, not as the primary database.
- Some modules have documentation/history under `docs/modules/99-archive`.

## Future Improvements

- Add Playwright E2E tests for customer checkout and admin product management.
- Add screenshots and deployment guide for a hosted demo.
- Mount and document favorites routes if the feature is completed.
- Add stricter frontend XSS-safe rendering utilities where API data is rendered with templates.
- Verify Docker image builds in GitHub Actions before merge.

## Team Members And Contribution

This is a personal portfolio project by Vi Hao. Contributions should follow the existing modular-monolith structure and keep changes scoped to the relevant module.

## License

The root package uses MIT metadata. The backend package currently uses ISC metadata. Standardize licensing before publishing as an open-source project.
