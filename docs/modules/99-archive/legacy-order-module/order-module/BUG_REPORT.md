# 🐛 Bug Report — Order Module

> Phát hiện qua code review ngày 2026-04-10 · TypeScript: 0 errors nhưng có logic bugs

---

## BUG #1 — 🔴 CRITICAL: Double SELECT + Race Condition trong `createOrderAtomic`

**File**: `order.repository.ts` · Line 93-96

```typescript
// ❌ BUG: Sau khi SELECT FOR UPDATE xác nhận đủ hàng,
// lại query thêm 1 lần nữa để lấy tên sản phẩm.
// Giữa 2 query này, product có thể bị xóa → crash.
if (!locked[0] || locked[0].stockQuantity < item.quantity) {
  const productName = await tx.product   // ← Query thứ 2, không cần thiết
    .findUnique({ where: { id: item.productId }, select: { name: true } })
    ...
```

**Fix**: Gộp tên sản phẩm vào SELECT FOR UPDATE ngay từ đầu, hoặc truyền `name` vào từ cart items (đã có sẵn ở service).

---

## BUG #2 — 🔴 CRITICAL: AuditLog viết SAU transaction, có thể mất log

**File**: `order.service.ts` · Line 122-136 (cancelOrder) và Line 166-180 (adminUpdateStatus)

```typescript
// ❌ BUG: Nếu writeAuditLog() fail → kho đã được hoàn, đơn đã CANCELLED
// nhưng KHÔNG có AuditLog. Vi phạm PA.md "Mỗi thay đổi PHẢI insert AuditLog".
const updated = await OrderRepository.updateStatusWithRollback(...); // ← Transaction commit
await writeAuditLog({ ... }); // ← Nếu crash ở đây → mất log!
```

**Fix**: Truyền `writeAuditLog` vào bên trong transaction của `updateStatusWithRollback`.

---

## BUG #3 — 🟠 HIGH: `paymentStatus: "PENDING"` hardcode String thay vì Enum

**File**: `order.repository.ts` · Line 131

```typescript
payment: {
  create: {
    paymentMethod: input.paymentMethod,
    paymentStatus: "PENDING",  // ❌ Hardcode string — nên dùng PaymentStatus.PENDING
    amount: totalAmount,
  },
},
```

**Fix**: Import `PaymentStatus` enum từ `@prisma/client` và dùng `PaymentStatus.PENDING`.

---

## BUG #4 — 🟠 HIGH: `auditLog.helper.ts` — parameter `tx` type sai

**File**: `auditLog.helper.ts` · Line 22

```typescript
// ❌ tx?: typeof prisma — đây là type của PrismaClient instance
// nhưng Prisma transaction trả về Prisma.TransactionClient (khác type)
export const writeAuditLog = async (
  input: AuditLogInput,
  tx?: typeof prisma,   // ← SAITYPE: không nhận được Prisma transaction client
```

**Fix**: Dùng `Prisma.TransactionClient | typeof prisma` hoặc đơn giản hơn là dùng union type.

---

## BUG #5 — 🟡 MEDIUM: `_formatOrder` dùng `any` — không type-safe

**File**: `order.service.ts` · Line 202

```typescript
private static _formatOrder(order: any) { // ← any không bắt được lỗi
```

**Fix**: Dùng return type từ Prisma hoặc tạo interface riêng.

---

## BUG #6 — 🟡 MEDIUM: Cart items có thể có `stockQuantity` âm sau khi cancel

**Scenario**:
1. User A đặt đơn → kho SP X: 5 → trừ → còn 2
2. User A hủy đơn → hoàn kho → còn 5 ✅
3. Nhưng nếu Admin đã bổ sung kho lên 8 giữa bước 1 và 2
4. Sau khi hoàn: 8 + 3 = 11 → VƯỢT SỐ LƯỢNG ĐÃ NHẬP KHO

Không phải bug cực kỳ nguy hiểm (không thể âm), nhưng cần lưu ý.

---

## BUG #7 — 🟡 MEDIUM: `findByUserId` không format Decimal

**File**: `order.service.ts` · Line 57

```typescript
orders: orders.map(OrderService._formatOrder),
```

`findByUserId` trả về object với `totalAmount` là `Decimal` — nhưng `_formatOrder` chỉ access `order.totalAmount`, `order.details`, `order.payment`. Tuy nhiên, `findByUserId` **không include `details`** đầy đủ:

```typescript
// findByUserId chỉ select: { quantity: true }
// _formatOrder cố map details.priceAtPurchase → undefined, không crash
// nhưng totalAmount vẫn là Decimal object trong JSON → serialize thành object {d: [...]}
```

**Fix**: `findByUserId` cần cast `totalAmount` hoặc format riêng.

---

## SUMMARY TABLE

| # | Severity | File | Vấn đề | Ảnh hưởng |
|---|---|---|---|---|
| 1 | 🔴 CRITICAL | `order.repository.ts:93` | Double query sau SELECT FOR UPDATE | Tiềm ẩn crash khi SP bị xóa giữa chừng |
| 2 | 🔴 CRITICAL | `order.service.ts:136` | AuditLog ngoài transaction | Mất audit trail khi crash |
| 3 | 🟠 HIGH | `order.repository.ts:131` | String "PENDING" thay vì enum | Non-type-safe, break nếu đổi enum |
| 4 | 🟠 HIGH | `auditLog.helper.ts:22` | `tx` type sai | Helper không nhận được transaction client |
| 5 | 🟡 MEDIUM | `order.service.ts:202` | `any` type trong format | Không bắt được lỗi compile time |
| 6 | 🟡 MEDIUM | `order.service.ts:122` | Kho sau hoàn có thể vượt nhập | Logic edge case |
| 7 | 🟡 MEDIUM | `order.service.ts:57` | Decimal không format khi list | JSON trả sai format |
