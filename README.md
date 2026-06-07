# Maverik Store

Maverik Store is a full-stack e-commerce platform for fashion and clothing retail. It includes a customer storefront, an admin dashboard, cart and checkout workflows, order management, VNPay payment integration, Supabase Storage, and an AI-powered support chat.

The project is built as a modular monolith: a Vite frontend, an Express TypeScript API, and MySQL data access through Prisma.

## Table of Contents

- [Highlights](#highlights)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Core Features](#core-features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [API Overview](#api-overview)
- [Payment Flow](#payment-flow)
- [Testing](#testing)
- [Production Readiness](#production-readiness)
- [Deployment Guide](#deployment-guide)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [License](#license)

## Highlights

- Customer storefront with product listing, product detail, cart, checkout, profile, and order history.
- Admin dashboard for products, categories, orders, revenue, and reporting workflows.
- JWT authentication with bcrypt password hashing and role-based customer/admin access.
- Order lifecycle with stock handling, payment status tracking, cancellation rules, and timeout handling.
- VNPay checkout flow with support for domestic VNPay and international card routing.
- Supabase Storage support for product images.
- Google Generative AI support chat integration.
- Backend validation with Zod and focused Jest tests for core business logic.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | Vite, Vanilla JavaScript ES modules, Bootstrap 5, Bootstrap Icons, Sass, Swiper |
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Database | MySQL |
| Auth | JWT, bcryptjs |
| Validation | Zod |
| Payments | VNPay, including international card flow via `bankCode=INTCARD` |
| Storage | Supabase Storage |
| AI | Google Generative AI |
| Tests | Jest, ts-jest |

## Architecture

The backend follows a layered modular-monolith design:

```text
Client
  -> Express routes
  -> Controllers
  -> Services
  -> Repositories
  -> Prisma
  -> MySQL
```

Controllers handle HTTP request and response concerns. Services own business rules. Repositories isolate database access. Gateways wrap external integrations such as VNPay.

Payment callbacks are split by responsibility: the browser return URL is used for user-facing result pages, while VNPay IPN is responsible for trusted payment confirmation.

## Core Features

### Customer

- Browse products and product details.
- Manage cart items.
- Checkout with COD, bank transfer, or VNPay.
- Use VNPay international card flow through a dedicated checkout option.
- View profile and order history.
- Cancel eligible orders within the allowed lifecycle rules.
- Use the support chat for product, checkout, and payment guidance.

### Admin

- Manage products and categories.
- View and update orders.
- Track revenue and reporting data.
- Export or inspect operational data through dashboard tools.

### Payments

- COD and bank transfer orders are created as normal pending orders.
- VNPay orders start as `PENDING_PAYMENT`.
- VNPay IPN confirms successful payment and moves eligible orders forward.
- User cancellation at VNPay keeps payment pending so the customer can retry.
- International cards are a VNPay UX alias, not a new provider or database payment method.

## Project Structure

```text
.
|-- src/                         # Vite frontend pages, assets, and storefront JS
|   |-- admin/                   # Admin dashboard pages
|   `-- assets/                  # Images, styles, and JavaScript modules
|-- backend/
|   |-- src/
|   |   |-- config/              # Environment, database, and integration config
|   |   |-- controllers/         # Express request handlers
|   |   |-- gateways/            # External gateways such as VNPay
|   |   |-- jobs/                # Background jobs
|   |   |-- middlewares/         # Auth, error handling, rate limiting
|   |   |-- repositories/        # Prisma data access layer
|   |   |-- routes/              # API route definitions
|   |   |-- schemas/             # Zod validation schemas
|   |   `-- services/            # Business logic
|   |-- prisma/                  # Prisma schema, migrations, and seed script
|   `-- tests/                   # Backend Jest tests
|-- docs/                        # Architecture notes, AI agent context, and plans
|-- PROJECT_CONTEXT.md           # High-level project context
`-- AGENTS.md                    # Safe-edit rules for AI agents
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- MySQL
- VNPay sandbox credentials for payment testing
- Optional: Supabase and Google Generative AI credentials

### 1. Clone the Repository

```bash
git clone https://github.com/vihaothecreator21/maverikstore_project39.git
cd maverikstore_project39
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

### 4. Configure Environment Variables

Create `backend/.env` from the example file:

```bash
cp .env.example .env
```

Update the values for your machine. At minimum, configure database, JWT, CORS, and VNPay values.

### 5. Prepare the Database

Create an empty MySQL database, then run Prisma commands from `backend`:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 6. Run the Backend

From `backend`:

```bash
npm run dev
```

The API runs on `http://localhost:5000` by default.

### 7. Run the Frontend

From the project root:

```bash
npm run dev
```

The storefront runs on the Vite dev server, usually `http://localhost:5173`.

## Environment Variables

The backend validates environment variables at startup through `backend/src/config/env.config.ts`. Invalid or missing production-critical values fail fast.

Example local configuration:

```env
NODE_ENV=development
PORT=5000
API_VERSION=v1

DATABASE_URL=mysql://your_db_user:your_db_password@localhost:3306/maverik_store

JWT_SECRET=change-this-to-a-random-jwt-secret-at-least-32-chars
JWT_EXPIRE=7d
BCRYPT_ROUNDS=10

CORS_ORIGINS=http://localhost:5173,http://localhost:3000
LOG_LEVEL=debug

RESEND_API_KEY=your-resend-api-key
EMAIL_FROM="Maverik Store <noreply@yourdomain.com>"
OTP_SECRET=change-this-to-a-random-secret-at-least-32-characters

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_STORAGE_BUCKET=product-images

GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash

VNPAY_TMN_CODE=your-vnpay-tmn-code
VNPAY_HASH_SECRET=your-vnpay-hash-secret-at-least-16-chars
VNPAY_RETURN_URL=http://localhost:5000/api/v1/payments/vnpay/return
VNPAY_FRONTEND_RETURN=http://localhost:5173/vnpay-return.html
VNPAY_IPN_URL=http://localhost:5000/api/v1/payments/vnpay/ipn
```

For production, set secrets through the hosting provider secret manager. Do not commit `.env` files.

## Available Scripts

### Frontend

Run these from the project root.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Build the frontend for production |
| `npm run preview` | Preview the production build locally |

### Backend

Run these from `backend/`.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Express API with nodemon and tsx |
| `npm run build` | Compile TypeScript |
| `npm start` | Run the compiled backend |
| `npm test` | Run backend Jest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Run Prisma migrations locally |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run prisma:seed` | Seed sample data |
| `npm run migrate:images` | Migrate product images to Supabase Storage |

## API Overview

Routes are mounted under `/api` and `/api/v1` depending on the route group.

| Area | Purpose |
| --- | --- |
| Auth | Register, login, JWT session handling, password hashing |
| Users | Profile retrieval and updates |
| Products | Product listing, details, filtering, admin product management |
| Categories | Category listing and admin category management |
| Cart | Cart retrieval, item updates, and cart sync |
| Orders | Place orders, view order history, cancel eligible orders, admin status updates |
| Payments | VNPay payment URL creation, return handling, and IPN confirmation |
| Support Chat | AI-assisted customer support flow |
| Admin Reports | Revenue and dashboard reporting data |

The backend response shape commonly uses:

```json
{
  "status": "success",
  "message": "...",
  "data": {}
}
```

## Payment Flow

### Standard VNPay

1. Customer selects VNPay at checkout.
2. Frontend creates an order with `paymentMethod = "VNPAY"`.
3. Backend creates a VNPay payment URL.
4. Customer is redirected to VNPay.
5. VNPay redirects the browser to the return URL for display.
6. VNPay sends IPN to the backend.
7. Backend verifies the signature and updates payment/order state.

### International Card

1. Customer selects `International Card (Visa / Master / JCB)`.
2. Frontend still creates the order with `paymentMethod = "VNPAY"`.
3. Frontend requests a payment URL with `bankCode=INTCARD`.
4. Backend adds `vnp_BankCode=INTCARD` before sorting and signing VNPay params.
5. Customer is redirected to VNPay's international card flow.
6. Return and IPN handling remain the same as standard VNPay.

Maverik Store never collects card number, CVV, or expiry data.

## Testing

Backend tests use Jest and ts-jest:

```bash
cd backend
npm test
```

Focused payment test:

```bash
cd backend
npm test -- payment.service.test.ts
```

Production build checks:

```bash
npm run build
cd backend
npm run build
```

## Production Readiness

Use this checklist before deploying a real store.

### Security

- Store all secrets in the platform secret manager.
- Use strong `JWT_SECRET` and `OTP_SECRET` values.
- Set explicit `CORS_ORIGINS`; do not use wildcard origins in production.
- Serve frontend and backend over HTTPS.
- Keep VNPay hash secret private.
- Do not log card, token, password, or payment secret data.
- Confirm all upload paths and storage buckets are private unless public access is intentional.

### Payments

- Replace VNPay sandbox credentials with production credentials.
- Set production `VNPAY_RETURN_URL` to the deployed backend return endpoint.
- Set production `VNPAY_IPN_URL` to the deployed backend IPN endpoint.
- Ensure VNPay can reach the IPN endpoint from the public internet.
- Treat VNPay IPN as the source of truth for payment confirmation.
- Keep return pages display-only; do not trust browser redirects for payment success.
- Test cancellation, failed payment, successful payment, and retry flows.

### Database

- Use a managed MySQL instance or hardened self-hosted MySQL.
- Run migrations before starting the production API.
- Back up the database regularly.
- Keep Prisma migrations reviewed and version-controlled.
- Do not change Prisma schema without a migration plan.

### Operations

- Run backend behind a reverse proxy or production Node hosting platform.
- Configure process monitoring and restart policy.
- Capture structured logs for API errors and payment events.
- Add alerting for payment IPN failures and database connectivity errors.
- Run tests and builds in CI before deployment.

## Deployment Guide

### Frontend

1. Build the frontend from the project root:

```bash
npm run build
```

2. Deploy the generated `dist/` folder to a static host such as Vercel, Netlify, or another static hosting provider.

3. Configure the frontend API base URL according to the existing `src/assets/js/api-config.js` behavior.

### Backend

1. Install dependencies in `backend/`:

```bash
npm install
```

2. Generate Prisma Client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

3. Build TypeScript:

```bash
npm run build
```

4. Start the compiled API:

```bash
npm start
```

5. Configure public callback URLs for VNPay:

```env
VNPAY_RETURN_URL=https://api.yourdomain.com/api/v1/payments/vnpay/return
VNPAY_IPN_URL=https://api.yourdomain.com/api/v1/payments/vnpay/ipn
VNPAY_FRONTEND_RETURN=https://yourdomain.com/vnpay-return.html
```

## Troubleshooting

### Backend fails at startup

Check `.env` values. The backend validates required values such as `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `GEMINI_API_KEY`, and VNPay credentials.

### Prisma cannot connect

Confirm MySQL is running, the database exists, and `DATABASE_URL` starts with `mysql://`.

### Frontend cannot call API

Check the API base URL and confirm the frontend origin is included in `CORS_ORIGINS`.

### VNPay returns but order is not confirmed

Check the IPN endpoint. Browser return pages are display-only; payment confirmation depends on verified VNPay IPN.

### International card option does not open card flow

Confirm the payment URL request includes `bankCode=INTCARD` and the signed VNPay params include `vnp_BankCode=INTCARD`.

### Payment retry after cancellation fails

Confirm user cancellation response code `24` does not mark the payment as `FAILED`. The payment should remain pending for retry.

## Documentation

More project context is available in:

- `PROJECT_CONTEXT.md` for architecture and development context.
- `docs/README.md` for the documentation index.
- `docs/architecture/PROJECT_LOGIC_SUMMARY.md` for business logic notes.
- `docs/context/AI_ARCHITECTURE_CONTEXT.md` for extended AI/project context.
- `docs/plans/EMAIL_OTP_REGISTRATION_PLAN.md` for email OTP registration planning.

## License

The root frontend package uses MIT metadata. The backend package currently uses ISC metadata. If this repository is prepared for public production use, standardize the license in package metadata and add a root `LICENSE` file.
