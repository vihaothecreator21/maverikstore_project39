# Maverik Store Audit Report

Date: 2026-07-25
Branch: `fix/cv-readiness`

## Findings

| Severity | Issue | Files | Fix | Status |
| --- | --- | --- | --- | --- |
| Critical | Profile route must require valid JWT and never return password hash. | `backend/src/routes/auth.routes.ts`, `backend/src/middlewares/auth.middleware.ts`, `backend/src/repositories/user.repository.ts` | Confirmed `/profile` uses `authMiddleware`; repository selects safe profile fields only. | Fixed/verified |
| Critical | JWT secret must not use fallback defaults. | `backend/src/config/env.config.ts` | Confirmed `JWT_SECRET` is required and at least 32 chars; missing config fails startup. | Fixed/verified |
| High | Admin product mutations must reject unauthenticated/customer users. | `backend/src/routes/product.routes.ts`, `backend/src/routes/admin.routes.ts`, `backend/src/middlewares/auth.middleware.ts` | Confirmed product/admin routes use `authMiddleware` and `requireAdmin`; added API tests for customer 403 and admin create. | Fixed/verified |
| High | Cart add allowed cumulative quantity to exceed stock. | `backend/src/services/cart.service.ts` | Added existing cart item quantity check before upsert. | Fixed |
| High | Cart sync could merge existing item above stock. | `backend/src/services/cart.service.ts` | Capped merged sync quantity by `product.stockQuantity`. | Fixed |
| Medium | Registration email should be normalized before service logic. | `backend/src/schemas/auth.schema.ts` | Added trim/lowercase normalization for register/login/OTP email schemas. | Fixed |
| Medium | Auto-generated username could collide with unique constraint. | `backend/src/services/auth.service.ts` | Added transaction-safe username suffix generation. | Fixed |
| Medium | Backend tests needed broader auth/authorization/product/cart coverage. | `backend/tests/integration/auth-product.api.test.ts`, `backend/tests/unit/services/cart.service.test.ts` | Added Supertest and unit cases; backend test suite passes with 53 tests. | Fixed |
| Medium | README overstated readiness and needed clearer CV-oriented status. | `README.md` | Rewrote README with completed/in-progress/planned sections and honest limitations. | Fixed |
| Medium | CI workflow required frontend build and backend test/build. | `.github/workflows/ci.yml` | Confirmed workflow exists for push/PR, Node 20, `npm ci`, build, Prisma generate, tests. | Fixed/verified |
| Medium | Backend CI used `npm ci` but backend lockfile was ignored. | `backend/.gitignore`, `.gitignore`, `backend/package-lock.json` | Stopped ignoring lockfiles so clean CI can install backend dependencies reproducibly. | Fixed |
| Low | Money fields should avoid Float. | `backend/prisma/schema.prisma` | Confirmed product price/discount fields use Prisma `Decimal`. | Fixed/verified |
| Low | Frontend cart/server cart mismatch should be documented. | `README.md` | Documented `localStorage` frontend cart limitation. | Fixed |

## Verification

- Backend tests: PASS, 53 tests.
- Backend build: PASS.
- Frontend build: PASS.
- GitHub Actions config: present.

## Remaining Limitations

- VNPay and checkout require sandbox end-to-end verification with real callback URLs.
- Frontend cart is not fully server-synchronized in every flow.
- Screenshots are not yet added.
- Real MySQL migration/seed verification was completed on `localhost:3306/maverik_store`: 4 migrations, 4 users, 5 categories, 19 products, 21 product images, 1 cart, 3 cart items, 2 orders, 4 reviews, and 6 favorites.
