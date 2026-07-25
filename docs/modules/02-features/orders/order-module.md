# Order Module

## Scope

Order module covers checkout, order creation, stock locking, order status lifecycle, user cancellation, admin order management, payment status synchronization, audit log, and timeout cleanup.

## Important Files

| Area | Files |
| --- | --- |
| Routes | `backend/src/routes/order.routes.ts` |
| Controller | `backend/src/controllers/order.controller.ts` |
| Service | `backend/src/services/order.service.ts` |
| Repository | `backend/src/repositories/order.repository.ts` |
| Schema | `backend/src/schemas/order.schema.ts` |
| Payment | `backend/src/services/payment.service.ts`, `backend/src/repositories/payment.repository.ts` |
| Cron | `backend/src/jobs/orderTimeout.job.ts` |
| Frontend checkout | `src/checkout.html`, `src/assets/js/checkout.js` |
| Frontend profile orders | `src/profile.html`, `src/assets/js/profile.js` |
| Admin orders | `src/admin/orders.html`, `src/admin/assets/js/admin-orders.js` |

## Order Lifecycle

```text
PENDING_PAYMENT -> PENDING -> CONFIRMED -> PROCESSING -> SHIPPING -> DELIVERED -> COMPLETED
       |              |          |                                      |
       v              v          v                                      v
   CANCELLED      CANCELLED  CANCELLED                              RETURNED
```

| Status | Meaning |
| --- | --- |
| `PENDING_PAYMENT` | VNPay order created, waiting payment/IPN |
| `PENDING` | COD order or paid VNPay order waiting admin confirmation |
| `CONFIRMED` | Admin accepted order |
| `PROCESSING` | Preparing/packing |
| `SHIPPING` | In delivery |
| `DELIVERED` | Delivered to customer |
| `COMPLETED` | Final successful state |
| `CANCELLED` | Cancelled by user/admin/timeout |
| `RETURNED` | Returned after delivery |

State transitions are defined in `VALID_TRANSITIONS` in `order.repository.ts`.

## Place Order Flow

1. Frontend validates shipping form in `checkout.js`.
2. Client sends `POST /api/v1/orders` with Bearer token.
3. `authMiddleware` attaches `req.userId`.
4. Controller validates `PlaceOrderSchema`.
5. Service loads user cart.
6. Repository creates order inside `prisma.$transaction`.
7. Each product row is locked with `SELECT ... FOR UPDATE`.
8. Server calculates total from database prices.
9. Order, details, payment are created.
10. Stock is decremented and cart is cleared.

## Cancellation And Stock Rollback

- User can cancel allowed states within the service rule window.
- Admin can move allowed states according to state machine.
- `updateStatusWithRollback()` restores stock when cancellation requires it.
- Cancellation sets related payment to `FAILED`.
- Delivery/completion sets payment to `SUCCESS` for COD-like flows.
- Important status changes write `AuditLog`.

## Payment Notes

| Method | Initial order status | Payment behavior |
| --- | --- | --- |
| `COD` | `PENDING` | Payment starts `PENDING`, later becomes `SUCCESS` on delivered/completed |
| `BANK_TRANSFER` | `PENDING` | Same general non-VNPay behavior |
| `MOMO` | `PENDING` | Placeholder/general behavior |
| `VNPAY` | `PENDING_PAYMENT` | Creates VNPay URL, IPN confirms payment and order |

VNPay return URL is user-facing; VNPay IPN is server-to-server and must remain idempotent.

## Admin Order UI

`admin-orders.js` mirrors backend transitions and currently allows manual cancellation from `PENDING_PAYMENT` if payment fails/stalls. Backend remains the source of truth.

## Known Risks / Follow-ups

- Timeout job currently handles stale pending/unpaid orders; verify exact statuses before changing business rules.
- Date reporting and order status dates may use `createdAt` or `updatedAt` depending on context; revenue reports use `updatedAt`.
- Keep order status labels synchronized between backend export labels, `profile.js`, and `admin-guard.js`.
