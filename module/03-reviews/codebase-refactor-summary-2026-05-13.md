# Codebase Refactor Summary - 2026-05-13

## Scope

This document summarizes the review, bug fixes, refactors, and cleanup completed for Maverik Store during the current work session.

## Review Findings Addressed

- Fixed order timeout behavior so only unpaid VNPay orders are auto-cancelled.
- Hardened order status updates against concurrent transitions.
- Hardened VNPay IPN handling so cancelled or already-mutated orders are not revived.
- Corrected admin product/category revenue math.
- Normalized admin export status fields so frontend no longer guesses whether status is an enum or label.
- Centralized frontend API base URL config.
- Removed unused debug/manual scripts and stale VNPay helper code.

## Order And Payment Fixes

### Order Timeout

- Updated `OrderRepository.findTimedOutOrders()` to only select:
  - `status = PENDING_PAYMENT`
  - `payment.paymentMethod = VNPAY`
  - `createdAt < now - 15 minutes`
- COD, bank transfer, and MOMO orders in `PENDING` now remain available for admin processing.

### Atomic Status Transition

- Updated `updateStatusWithRollback()` to use a conditional status update:
  - `where: { id: orderId, status: expectedStatus }`
- If the order changed between read and write, the repository throws `ORDER_STATUS_CHANGED`.
- Stock restore now happens only after the status transition wins, preventing duplicate stock increments.
- Service layer maps this conflict to a `409 ORDER_STATUS_CHANGED` API error.

### VNPay IPN Guard

- `confirmPaymentAndOrder()` now refetches order/payment inside the transaction.
- It only confirms payment when:
  - order status is `PENDING_PAYMENT`
  - payment status is `PENDING`
  - current caller state is still `PENDING_PAYMENT`
- If the order is already cancelled, confirmed, or otherwise changed, the IPN is ignored safely.

## Admin Revenue And Export Fixes

### Product/Category Revenue

- Replaced incorrect `_sum.priceAtPurchase` usage with:
  - `SUM(priceAtPurchase * quantity)`
- Applied to:
  - best-selling product revenue
  - category revenue

### Export DTO

- Added explicit admin export fields:
  - `statusCode`: enum value, e.g. `COMPLETED`
  - `statusLabel`: display label, e.g. Vietnamese status text
- Kept legacy `status` for compatibility.
- Updated admin revenue frontend to use:
  - `statusCode` for filtering, badge class, cancelled count, and XLSX summary
  - `statusLabel` for display/export text

## Refactors

### Order Status Policy

Added `backend/src/policies/orderStatus.policy.ts` with:

- `ORDER_STATUS_TRANSITIONS`
- `allowedTransitions()`
- `canTransition()`
- `shouldRestoreStock()`
- `shouldMarkPaymentSuccess()`

Order transition logic is now centralized instead of living partly in repository/service code.

### VNPay Gateway

Added `backend/src/gateways/vnpay.gateway.ts` with:

- `buildVNPayPaymentUrl()`
- `verifyVNPayReturn()`
- `VNPayVerificationResult`

`PaymentService` now focuses on orchestration and delegates VNPay signing/verification to the gateway.

### Frontend API Base

- Added `getApiBase()` export from `src/assets/js/api-config.js`.
- Replaced duplicated local `getApiBase()` helpers in customer frontend modules.
- Admin guard now re-exports the centralized API helper for existing admin modules.

## Cleanup

Removed unused/manual debug assets:

- `backend/src/utils/vnpay.util.ts`
- root VNPay debug scripts under `backend/`
- duplicated VNPay dev scripts under `backend/devtools/vnpay/`
- manual scripts under `backend/scratch/`

Documentation tree was reorganized:

- Current docs live under:
  - `module/00-overview/`
  - `module/01-architecture/`
  - `module/02-features/`
  - `module/03-reviews/`
- Legacy docs moved under:
  - `module/99-archive/`

## Encoding Check

- Scanned main backend/frontend source for mojibake markers.
- No broad encoding rewrite was applied because active source files built successfully and did not show remaining corrupted markers after cleanup.
- Existing Vietnamese text that is valid UTF-8 was preserved.

## Verification

Commands run successfully:

```bash
cd backend && npm run build
cd backend && npm test
npm run build
```

Results:

- Backend TypeScript build: pass
- Backend Jest tests: pass, 10/10
- Frontend Vite build: pass
- Existing Vite warnings remain for non-module vendor scripts in admin pages.

## Notes

- The current branch is `semifix`.
- This summary covers the current review, bug fix, refactor, and cleanup session.
