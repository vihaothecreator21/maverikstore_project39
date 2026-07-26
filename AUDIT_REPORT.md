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
| High | Integration tests were excluded from default Jest discovery. | `backend/jest.config.cjs`, `backend/package.json`, `.github/workflows/ci.yml` | Removed integration ignore from Jest default, added explicit `test:unit` and `test:integration`, and updated CI to run both. | Fixed/verified |
| High | Backend production build entrypoint was missing and server/app responsibilities were mixed in historical code. | `backend/src/app.ts`, `backend/src/server.ts`, `backend/tsconfig.json` | Restored `app.ts`, split `createApp()` from server startup, switched TypeScript runtime module settings to `NodeNext`, and verified `dist/src/server.js` starts. | Fixed/verified |
| High | Docker startup used unsafe schema push with `--accept-data-loss` and development runtime. | `backend/docker-entrypoint.sh` | Replaced `prisma db push --accept-data-loss` with `npx prisma migrate deploy` and changed startup to `npm start`. | Fixed |
| Medium | Lint scripts were missing or optional in CI. | `package.json`, `eslint.config.js`, `backend/package.json`, `backend/eslint.config.js`, `.github/workflows/ci.yml` | Added ESLint configs/scripts for frontend and backend; CI now runs `npm run lint` without `--if-present`. | Fixed/verified |
| Medium | Error handler could expose unknown error messages outside development. | `backend/src/middlewares/errorHandler.middleware.ts`, `backend/src/utils/apiResponse.ts` | Unknown errors now default to `Internal server error`; stack/debug remains development-only; response includes `success: false` while preserving existing `status: "error"` contract. | Fixed |
| Medium | Backend CI used `npm ci` but backend lockfile was ignored. | `backend/.gitignore`, `.gitignore`, `backend/package-lock.json` | Stopped ignoring lockfiles so clean CI can install backend dependencies reproducibly. | Fixed |
| Low | Money fields should avoid Float. | `backend/prisma/schema.prisma` | Confirmed product price/discount fields use Prisma `Decimal`. | Fixed/verified |
| Low | Frontend cart/server cart mismatch should be documented. | `README.md` | Documented `localStorage` frontend cart limitation. | Fixed |

## Verification

- Backend unit tests: PASS, 32 tests.
- Backend integration tests: PASS, 21 tests.
- Backend tests: PASS, 53 tests.
- Backend lint: PASS.
- Backend build: PASS.
- Production start from build output: PASS; `dist/src/server.js` connected to local MySQL and listened on port 5001.
- Health-check smoke test: NOT VERIFIED locally because background process execution was rejected by the local approval system; configured in CI.
- Frontend lint: PASS.
- Frontend build: PASS.
- GitHub Actions config: present; remote run not verified in this session because `gh` is not installed and pull/fetch was blocked by `.git/FETCH_HEAD` sandbox permission.

## Remaining Limitations

- VNPay and checkout require sandbox end-to-end verification with real callback URLs.
- Frontend cart is not fully server-synchronized in every flow.
- Screenshots are not yet added.
- No live demo URL is currently documented.
- GitHub Actions must be checked on GitHub after pushing this branch.
