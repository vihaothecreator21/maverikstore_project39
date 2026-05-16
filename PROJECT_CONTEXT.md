# PROJECT_CONTEXT.md

## Tech stack
- Frontend: Vite, Vanilla JavaScript ES modules, Bootstrap 5, Bootstrap Icons, SCSS, Swiper.
- Backend: Node.js, Express, TypeScript, Prisma ORM.
- Database: MySQL via Prisma.
- Auth: JWT, bcryptjs, role-based admin/customer access.
- Validation: Zod.
- Payments/integrations: VNPAY, Supabase, Google Generative AI.
- Reports/admin tooling: Chart.js, SheetJS, PapaParse, jsPDF assets.
- Tests: Jest/ts-jest for backend.

## Main features
- Customer storefront with product listing, product detail, homepage merchandising, cart, checkout, profile/order history.
- Admin dashboard for products, categories, orders, revenue, customer/product stats, exports.
- Product and category management with backend-generated slugs.
- Cart support for guest cart storage and authenticated cart sync.
- Order lifecycle with status transitions and stock updates.
- VNPAY payment flow with return/IPN handling.
- Backend layered architecture: `routes -> controllers -> services -> repositories -> Prisma`.
- Support chat route/module exists in backend routes.

## Important paths
- `src`: Vite frontend HTML pages and storefront assets.
- `src/assets/js`: storefront JavaScript modules.
- `src/assets/scss`: frontend SCSS.
- `src/admin`: admin HTML pages.
- `src/admin/assets/js`: admin dashboard JavaScript.
- `backend/src`: Express TypeScript API source.
- `backend/src/routes`: API route definitions.
- `backend/src/controllers`: request/response controllers.
- `backend/src/services`: business logic.
- `backend/src/repositories`: Prisma data access.
- `backend/src/schemas`: Zod validation.
- `backend/src/middlewares`: auth/admin/error/sanitize/rate-limit middleware.
- `backend/src/config`: env, Prisma, VNPAY config.
- `backend/src/gateways`: external gateway integrations.
- `backend/src/jobs`: background jobs.
- `backend/prisma/schema.prisma`: database schema.
- `backend/prisma/seed.ts`: seed data.
- `backend/tests`: backend tests.

## Current known issues / notes
- `backend/.env.example` may be outdated versus `backend/src/config/env.config.ts`.
- Some docs under `module/` may be historical.
- Some frontend modules duplicate API base URL logic instead of using `src/assets/js/api-config.js`.
- Vite build may warn about admin vendor scripts loaded outside ES module bundling.
- Review/favorite models exist, but full public API/routes may not be mounted.
- Payment/order logic is sensitive: check current state before changing status/payment behavior.
- Slug behavior is backend-owned; keep product/category slug generation stable.
- Database schema changes require confirmation first.

## Important commands
Frontend, from project root:

```bash
npm install
npm run dev
npm run build
npm run preview
```

Backend, from `backend`:

```bash
npm install
npm run dev
npm run build
npm start
npm test
npm run test:watch
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
npm run prisma:seed
```

## Environment notes
- Backend env validation lives in `backend/src/config/env.config.ts`.
- `DATABASE_URL` is MySQL.
- `JWT_SECRET` must satisfy backend validation.
- VNPAY env vars are required for payment flows.
- API routes are mounted under `/api` and `/api/v1`.

## Editing rules
- Do not scan the whole repo for a small module task.
- Identify relevant files before editing.
- Keep changes scoped to the requested module.
- Do not refactor broadly unless requested.
- Do not touch auth/payment/database schema unless the task requires it.
- Preserve ESM import style in backend TypeScript files.
- Keep frontend as plain JS modules; do not introduce React/Vue.
