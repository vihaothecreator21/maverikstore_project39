# Maverik Store Audit Report

Date: 2026-07-26
Branch: `fix/cv-readiness`

## Findings

| Issue | Severity | Affected files | Root cause | Fix applied | Verification command | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| Profile route needed enforced JWT auth and safe profile output. | Critical | `backend/src/routes/auth.routes.ts`, `backend/src/middlewares/auth.middleware.ts` | Profile access must trust verified token/session only. | Confirmed `/profile` uses `authMiddleware`; tests cover missing, malformed, and valid token. | `npm run test:integration` | PASS |
| JWT secrets must not fall back to defaults. | Critical | `backend/src/config/env.config.ts` | Fallback secrets would make deployed tokens guessable. | `JWT_SECRET` is required and min 32 chars during env validation. | `npm run build` | PASS |
| Admin product mutations needed role checks. | High | `backend/src/routes/product.routes.ts`, `backend/src/middlewares/auth.middleware.ts` | Product create/update/delete must reject non-admin users. | Product mutation routes use `authMiddleware` and `requireAdmin`; tests cover customer 403 and admin create. | `npm run test:integration` | PASS |
| Cart add could exceed stock cumulatively. | High | `backend/src/services/cart.service.ts` | Existing cart quantity was not included in the stock check. | Checked `existingQuantity + requestedQuantity <= stock` before upsert. | `npm run test:unit` | PASS |
| Cart sync from `localStorage` could exceed stock when merging. | High | `backend/src/services/cart.service.ts`, `backend/tests/unit/services/cart.service.test.ts` | Sync merged current quantity plus local quantity without stock cap. | Sync now ignores invalid/out-of-stock local items and caps merged quantity by product stock. | `npm run test:unit` | PASS |
| Validation errors lost field details. | Medium | `backend/src/utils/apiResponse.ts` | `ValidationError` prototype was overwritten by the parent `APIError` constructor. | Restored `ValidationError.prototype` and handled validation before generic API errors. | `npm run test:unit` | PASS |
| Unknown production errors must not expose raw internals. | Medium | `backend/src/middlewares/errorHandler.middleware.ts`, `backend/tests/unit/middlewares/errorHandler.middleware.test.ts` | Error responses needed explicit production behavior coverage. | Added tests proving production 500 returns `Internal server error` without raw message/debug data. | `npm run test:unit` | PASS |
| Health endpoint response needed minimal public shape. | Medium | `backend/src/app.ts`, `backend/src/routes/index.ts`, `backend/tests/integration/auth-product.api.test.ts` | Existing `/api/health` response was wrapped and used `healthy`, not the required simple smoke payload. | Added public `/health` and simple `/api/health` responses: `{ "success": true, "status": "ok" }`. | `npm run test:integration` | PASS |
| Docker final image ran a single-stage development install. | High | `backend/Dockerfile` | Production container installed dev dependencies and did not clearly run build output. | Replaced with multi-stage build; runner uses `npm ci --omit=dev`, copies `dist`, Prisma client, Prisma schema, and runs `npm start`. | Static review; Docker daemon unavailable locally. | NOT VERIFIED (config PASS) |
| Docker migration command must avoid data-loss schema push. | High | `backend/docker-entrypoint.sh` | Production startup must not use `prisma db push --accept-data-loss`. | Entry point uses `npx prisma migrate deploy` and `exec npm start`; no `--accept-data-loss` remains. | `Select-String ... "accept-data-loss"` | PASS |
| Smoke script used fixed port that could be occupied by system processes (Windows PID 4 owns port 5000). | High | `backend/scripts/smoke-production.mjs` | Hard-coded port caused port-in-use errors leaving orphan processes across retries. | Script now calls `net.createServer` to find a free OS-assigned port before spawning the server, eliminating collisions. | `npm run smoke:production` | PASS |
| Smoke cleanup mixed server success path with `wait ... \|\| true`. | Medium | `.github/workflows/ci.yml`, `backend/scripts/smoke-production.mjs`, `backend/package.json` | Shell smoke step mixed server lifecycle cleanup with success detection. | Added `npm run smoke:production`, which starts built output, polls `GET /health`, and stops the child server cleanly. No `\|\| true` in success path. | `npm run smoke:production` | PASS |
| Frontend homepage rendered API product data into HTML directly. | High | `src/assets/js/index-page.js` | Product name, description, slug, and image URL were interpolated without escaping. | Added `safeProduct`, HTML escaping, URL encoding, and image URL allow-listing before template rendering. | `npm run lint`; `npm run build` | PASS |
| Frontend product listing rendered API category/product data into HTML directly. | High | `src/assets/js/products.js` | Category and product text/attributes were interpolated without escaping. | Escaped category/product text and attributes, encoded product-detail URLs, and restricted product image URLs. | `npm run lint`; `npm run build` | PASS |
| VNPay return page trusted client-controlled `isSuccess` query parameter. | Medium | `src/vnpay-return.html` | A forged query string could route the user to success UI without VNPay response code `00`. | Success routing now depends on `vnp_ResponseCode === "00"` only. | `npm run build` | PASS |
| Compose frontend port was not allowed by backend production CORS. | Low | `docker-compose.yml` | Frontend service publishes `localhost:8080`, but backend CORS allowed only `localhost:80` and dev ports. | Added `http://localhost:8080` to compose CORS origins. | Static review | PASS |
| Docker image build was not represented in GitHub Actions. | Medium | `.github/workflows/docker-build.yml` | Main CI validates app build/test/smoke but not Docker image build. | Added Docker Build workflow for frontend/backend image builds and compose config validation. | Static review; Docker daemon unavailable locally. | NOT VERIFIED (config PASS) |
| README/test docs needed current verification facts. | Medium | `README.md`, `backend/tests/integration/README.md`, `AUDIT_REPORT.md` | Test counts and status changed during this pass. | Updated docs to state 38 unit tests, 23 integration/API tests, and unverified local Docker/runtime limits. | Documentation review | PASS |

## Verification Snapshot

| Check | Result |
| --- | --- |
| Frontend lint | PASS |
| Frontend build | PASS |
| Backend lint | PASS |
| Unit tests | PASS: 5 suites, 38 tests |
| Integration/API tests | PASS: 2 suites, 23 tests |
| Backend build | PASS |
| Production start | PASS: built output started; server bound on OS-assigned free port |
| Health-check smoke | PASS: `npm run smoke:production` returned `{ success: true, status: "ok" }` from `/health`; no residual listener after exit |
| Docker build | NOT VERIFIED: Docker daemon unavailable in this environment |
| Docker Build workflow | NOT VERIFIED: remote workflow result not checked |
| Docker configuration safety | PASS by static scan (no `--accept-data-loss`, no `continue-on-error`, no `--if-present`) |
| Secret scan | PASS: `git grep` matches are vendor-minified false positives only |
| GitHub Actions | NOT VERIFIED: pending push result |

## Commands Executed (Final Verification Pass)

```text
# Kill orphan processes from previous smoke runs
Stop-Process -Id 26420,20276,17680,20152 -Force -ErrorAction SilentlyContinue

# Backend
npm run build                         -> EXIT 0
npm run lint                          -> EXIT 0
npm run test:unit                     -> EXIT 0 (5 suites, 38 tests)
npm run test:integration              -> EXIT 0 (2 suites, 23 tests)
npm run smoke:production              -> EXIT 0 (auto free port, no orphan)

# Frontend / root
npm run lint                          -> EXIT 0
npm run build                         -> EXIT 0

# Safety
git diff --check                      -> EXIT 0
git grep -n -I -E "(JWT_SECRET=|DATABASE_URL=|API_KEY=|PRIVATE_KEY|BEGIN RSA|password=)" -> only vendor/minified false positives
Select-String workflows/Dockerfile/entrypoint "accept-data-loss|continue-on-error|--if-present" -> no matches
```

## Remaining Limitations

- Local production start and HTTP smoke passed; CI GitHub Actions result is still pending after push.
- Docker runtime/build could not be verified because the Docker daemon was unavailable in this environment.
- VNPay sandbox checkout is not verified end-to-end.
- Frontend cart still primarily uses `localStorage`; backend sync exists but is not a full frontend server-cart migration.
- Inventory concurrency is not fully solved with DB-level locking/transactions (documented as technical debt).
- No live demo URL or screenshots are documented.
- `price` and monetary fields use `Float` in Prisma schema; migration to `Decimal` is a documented future improvement.
