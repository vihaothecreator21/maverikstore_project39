# Maverik Store Audit Report

Date: 2026-07-26
Branch: `fix/cv-readiness`

## Findings

| Issue | Severity | Affected files | Root cause | Fix applied | Verification command | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| Profile route needed enforced JWT auth and safe profile output. | Critical | `backend/src/routes/auth.routes.ts`, `backend/src/middlewares/auth.middleware.ts` | Profile access must trust verified token/session only. | Confirmed `/profile` uses `authMiddleware`; tests cover missing, malformed, and valid token. | `npm.cmd run test:integration` | PASS |
| JWT secrets must not fall back to defaults. | Critical | `backend/src/config/env.config.ts` | Fallback secrets would make deployed tokens guessable. | `JWT_SECRET` is required and min 32 chars during env validation. | `npm.cmd run build` | PASS |
| Admin product mutations needed role checks. | High | `backend/src/routes/product.routes.ts`, `backend/src/middlewares/auth.middleware.ts` | Product create/update/delete must reject non-admin users. | Product mutation routes use `authMiddleware` and `requireAdmin`; tests cover customer 403 and admin create. | `npm.cmd run test:integration` | PASS |
| Cart add could exceed stock cumulatively. | High | `backend/src/services/cart.service.ts` | Existing cart quantity was not included in the stock check. | Checked `existingQuantity + requestedQuantity <= stock` before upsert. | `npm.cmd run test:unit` | PASS |
| Cart sync from `localStorage` could exceed stock when merging. | High | `backend/src/services/cart.service.ts`, `backend/tests/unit/services/cart.service.test.ts` | Sync merged current quantity plus local quantity without stock cap. | Sync now ignores invalid/out-of-stock local items and caps merged quantity by product stock. | `npm.cmd run test:unit` | PASS |
| Validation errors lost field details. | Medium | `backend/src/utils/apiResponse.ts` | `ValidationError` prototype was overwritten by the parent `APIError` constructor. | Restored `ValidationError.prototype` and handled validation before generic API errors. | `npm.cmd run test:unit` | PASS |
| Unknown production errors must not expose raw internals. | Medium | `backend/src/middlewares/errorHandler.middleware.ts`, `backend/tests/unit/middlewares/errorHandler.middleware.test.ts` | Error responses needed explicit production behavior coverage. | Added tests proving production 500 returns `Internal server error` without raw message/debug data. | `npm.cmd run test:unit` | PASS |
| Health endpoint response needed minimal public shape. | Medium | `backend/src/app.ts`, `backend/src/routes/index.ts`, `backend/tests/integration/auth-product.api.test.ts` | Existing `/api/health` response was wrapped and used `healthy`, not the required simple smoke payload. | Added public `/health` and simple `/api/health` responses: `{ "success": true, "status": "ok" }`. | `npm.cmd run test:integration` | PASS |
| Docker final image ran a single-stage development install. | High | `backend/Dockerfile` | Production container installed dev dependencies and did not clearly run build output. | Replaced with multi-stage build; runner uses `npm ci --omit=dev`, copies `dist`, Prisma client, Prisma schema, and runs `npm start`. | Static review; Docker daemon unavailable locally. | NOT VERIFIED |
| Docker migration command must avoid data-loss schema push. | High | `backend/docker-entrypoint.sh` | Production startup must not use `prisma db push --accept-data-loss`. | Entry point uses `npx prisma migrate deploy` and `exec npm start`; no `--accept-data-loss` remains. | `Select-String ... "accept-data-loss"` | PASS |
| CI smoke cleanup mixed server success with `wait ... || true`. | Medium | `.github/workflows/ci.yml` | Smoke step contained `|| true` in the main success path. | Added trap cleanup; health success exits only after `curl --fail` succeeds. | Static review plus `npm.cmd run build` | PASS |
| Frontend homepage rendered API product data into HTML directly. | High | `src/assets/js/index-page.js` | Product name, description, slug, and image URL were interpolated without escaping. | Added `safeProduct`, HTML escaping, URL encoding, and image URL allow-listing before template rendering. | `npm.cmd run lint`; `npm.cmd run build` | PASS |
| Frontend product listing rendered API category/product data into HTML directly. | High | `src/assets/js/products.js` | Category and product text/attributes were interpolated without escaping. | Escaped category/product text and attributes, encoded product-detail URLs, and restricted product image URLs. | `npm.cmd run lint`; `npm.cmd run build` | PASS |
| VNPay return page trusted client-controlled `isSuccess` query parameter. | Medium | `src/vnpay-return.html` | A forged query string could route the user to success UI without VNPay response code `00`. | Success routing now depends on `vnp_ResponseCode === "00"` only. | `npm.cmd run build` | PASS |
| Compose frontend port was not allowed by backend production CORS. | Low | `docker-compose.yml` | Frontend service publishes `localhost:8080`, but backend CORS allowed only `localhost:80` and dev ports. | Added `http://localhost:8080` to compose CORS origins. | Static review | PASS |
| Docker image build was not represented in GitHub Actions. | Medium | `.github/workflows/docker-build.yml` | Main CI validates app build/test/smoke but not Docker image build. | Added Docker Build workflow for frontend/backend image builds and compose config validation. | Static review; Docker daemon unavailable locally. | NOT VERIFIED |
| README/test docs needed current verification facts. | Medium | `README.md`, `backend/tests/integration/README.md`, `AUDIT_REPORT.md` | Test counts and status changed during this pass. | Updated docs to state 38 unit tests, 23 integration/API tests, and unverified local Docker/runtime limits. | Documentation review | PASS |

## Verification Snapshot

| Check | Result |
| --- | --- |
| Frontend lint | PASS |
| Frontend build | PASS |
| Backend lint | PASS |
| Unit tests | PASS: 5 suites, 38 tests |
| Integration tests | PASS: 2 suites, 23 tests |
| Backend build | PASS |
| Production start | NOT VERIFIED locally: no MySQL service available |
| Health-check smoke | PASS in Supertest; NOT VERIFIED against local `npm start` |
| Docker build | NOT VERIFIED: Docker daemon unavailable |
| Docker Build workflow | NOT VERIFIED: remote workflow result not checked |
| Docker configuration safety | PASS by static scan |
| GitHub Actions | NOT VERIFIED: remote workflow result not checked |

## Remaining Limitations

- Local production `npm start` and HTTP smoke need a reachable MySQL test database.
- Docker runtime/build could not be verified because the Docker daemon was unavailable.
- GitHub Actions result is not verified in this local session.
- VNPay sandbox checkout is not verified end-to-end.
- Frontend cart still primarily uses `localStorage`; backend sync exists but is not a full frontend server-cart migration.
- Inventory concurrency is not fully solved with DB-level locking/transactions.
- No live demo URL or screenshots are documented.
