

---


---

## 1. Tổng quan kiến trúc

### Hệ thống theo mô hình **Layered Architecture** (Kiến trúc phân tầng)

```
┌─────────────────────────────────────────────────────────┐
│                   FRONTEND (Browser)                    │
│         checkout.html + checkout.js                     │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP Request (JSON)
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js / Express)           │
│                                                         │
│  ① ROUTE      order.routes.ts   ← "Cổng vào"           │
│       │                                                 │
│  ② MIDDLEWARE  auth.middleware.ts ← "Bảo vệ"           │
│       │                                                 │
│  ③ CONTROLLER  order.controller.ts ← "Điều phối"       │
│       │                                                 │
│  ④ SERVICE     order.service.ts ← "Xử lý logic"        │
│       │                                                 │
│  ⑤ REPOSITORY  order.repository.ts ← "Truy vấn DB"    │
│       │                                                 │
│  ⑥ DATABASE    MySQL (qua Prisma ORM)                   │
└─────────────────────────────────────────────────────────┘
```

> 💡 **Tại sao phân tầng?**  
> Giống như một nhà hàng: **Khách hàng** → **Lễ tân** → **Quản lý** → **Đầu bếp** → **Kho nguyên liệu**.  
> Mỗi người chỉ làm đúng việc của mình. Nếu bếp hỏng, chỉ sửa tầng bếp, không cần sửa lễ tân.

---

## 2. Cấu trúc thư mục

```
backend/src/
│
├── routes/
│   └── order.routes.ts         ← Định nghĩa URL endpoint
│
├── controllers/
│   └── order.controller.ts     ← Nhận request, gọi service
│
├── services/
│   └── order.service.ts        ← Logic nghiệp vụ (business rules)
│
├── repositories/
│   └── order.repository.ts     ← Truy vấn database
│
├── schemas/
│   └── order.schema.ts         ← Validate dữ liệu đầu vào
│
├── utils/
│   └── auditLog.helper.ts      ← Ghi nhật ký thay đổi
│
└── jobs/
    └── orderTimeout.job.ts     ← Cron job tự động hủy đơn

frontend/src/
├── checkout.html               ← Giao diện thanh toán
└── assets/js/
    └── checkout.js             ← Logic tương tác UI
```

---

## 3. Luồng đặt hàng từ A→Z

### Scenario: User bấm "ĐẶT HÀNG NGAY" trên trang checkout

```
[Browser - checkout.js]
  │
  │  1. User điền form (tên, SĐT, địa chỉ, phương thức thanh toán)
  │  2. Bấm nút "ĐẶT HÀNG NGAY"
  │  3. JavaScript validate form (tên ≥ 2 ký tự, SĐT VN, địa chỉ ≥ 10 ký tự)
  │  4. Gửi: POST /api/v1/orders + JWT token trong Header
  │
  ▼
[order.routes.ts] — "Cổng vào"
  │
  │  router.post("/", authMiddleware, catchAsync(OrderController.createOrder))
  │  → Khớp URL "POST /api/v1/orders", chuyển sang middleware
  │
  ▼
[auth.middleware.ts] — "Bảo vệ cổng"
  │
  │  1. Đọc token từ Header: "Authorization: Bearer eyJ..."
  │  2. Giải mã JWT → lấy userId
  │  3. Query DB: user có tồn tại không? (guard tránh FK violation)
  │  4. Nếu OK → gắn req.userId = 3, req.userRole = "USER"
  │  5. Gọi next() → đi tiếp
  │
  ▼
[order.controller.ts] — "Điều phối viên"
  │
  │  1. Đọc req.body (shippingAddress, shippingPhone, paymentMethod, note)
  │  2. Parse + validate qua Zod schema (PlaceOrderSchema)
  │  3. Gọi OrderService.placeOrder(userId, validatedData)
  │  4. Nhận kết quả → trả về JSON response
  │
  ▼
[order.service.ts] — "Não bộ"
  │
  │  1. Lấy giỏ hàng của user từ DB
  │  2. Kiểm tra giỏ có rỗng không?
  │  3. Map cart items → truyền productName vào (để báo lỗi rõ nếu hết hàng)
  │  4. Gọi OrderRepository.createOrderAtomic(userId, input, cartItems, cartId)
  │  5. Nếu lỗi "INSUFFICIENT_STOCK::Sofa Milan::2" → parse và trả 409
  │  6. Format kết quả (convert Decimal → number) → trả về
  │
  ▼
[order.repository.ts] — "Người làm việc với DB"
  │
  │  prisma.$transaction(async (tx) => {
  │    // ── TRONG 1 TRANSACTION DUY NHẤT ──────────────────
  │
  │    1. FOR EACH sản phẩm:
  │       SELECT id, name, stockQuantity FROM Product
  │       WHERE id = ? FOR UPDATE          ← KHÓA HÀNG (row lock)!
  │
  │    2. Kiểm tra tồn kho: stockQuantity >= quantity?
  │       Nếu không → throw Error("INSUFFICIENT_STOCK::Tên SP::còn lại")
  │
  │    3. Tạo Order (status: PENDING) + OrderDetails + Payment (status: PENDING)
  │
  │    4. Trừ tồn kho: product.stockQuantity -= quantity
  │
  │    5. Xóa giỏ hàng (cartItems)
  │  })
  │  → Nếu BẤT KỲ bước nào lỗi → ROLLBACK toàn bộ (không mất dữ liệu)
  │
  ▼
[MySQL Database]
  │
  │  Lưu vào bảng:
  │  ├── Order (id, userId, totalAmount, status="PENDING", ...)
  │  ├── OrderDetail (orderId, productId, quantity, priceAtPurchase, ...)
  │  └── Payment (orderId, paymentMethod, paymentStatus="PENDING", amount)
  │
  ▼
[Quay lại Browser - checkout.js]
  │
  │  response.ok = true
  │  → Hiện màn hình "Đặt hàng thành công! Mã đơn: #123"
```

---

## 4. Giải thích từng tầng (Layer)

### ① `order.routes.ts` — Định nghĩa "Địa chỉ"

```typescript
// Đây là nơi bạn khai báo: URL nào → làm gì → ai được phép
router.post("/",            authMiddleware, OrderController.createOrder)
router.get("/",             authMiddleware, OrderController.getMyOrders)
router.get("/:id",          authMiddleware, OrderController.getOrderById)
router.patch("/:id/cancel", authMiddleware, OrderController.cancelOrder)

// Admin routes (cần quyền ADMIN)
adminRouter.get("/",        requireAdmin,   OrderController.adminGetOrders)
adminRouter.patch("/:id/status", requireAdmin, OrderController.adminUpdateStatus)
```

> 💡 **Analogy:** Routes giống như bảng chỉ đường. "POST /orders → đến quầy tạo đơn hàng", "GET /orders/:id → đến quầy tra cứu đơn".

---

### ② `order.controller.ts` — Điều phối, không xử lý logic

```typescript
static async createOrder(req: Request, res: Response) {
  // 1. Lấy userId từ middleware (đã gắn vào)
  const userId = req.userId;

  // 2. Validate input bằng Zod
  const parsed = PlaceOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, parsed.error, "VALIDATION_ERROR", 400);
  }

  // 3. Gọi service — Controller KHÔNG tự xử lý logic
  const order = await OrderService.placeOrder(userId, parsed.data);

  // 4. Trả về kết quả
  return sendSuccess(res, order, "Đặt hàng thành công", 201);
}
```

> 💡 **Nguyên tắc:** Controller chỉ làm 3 việc: **đọc input → gọi service → trả output**. Không có if/else phức tạp ở đây.

---

### ③ `order.service.ts` — Toàn bộ Business Rules ở đây

```typescript
// Ví dụ: Quy tắc hủy đơn trong 24 giờ
static async cancelOrder(orderId: number, userId: number) {
  const order = await OrderRepository.findById(orderId);

  // Rule 1: Đơn phải tồn tại
  if (!order) throw new APIError(404, "Không tìm thấy đơn hàng");

  // Rule 2: Chỉ được hủy đơn của mình
  if (order.userId !== userId) throw new APIError(403, "Không có quyền");

  // Rule 3: Chỉ hủy khi đang PENDING hoặc CONFIRMED
  if (!["PENDING", "CONFIRMED"].includes(order.status))
    throw new APIError(400, "Không thể hủy đơn ở trạng thái này");

  // Rule 4: Chỉ trong 24 giờ
  const hoursSinceCreated = (Date.now() - order.createdAt.getTime()) / 3600000;
  if (hoursSinceCreated > 24)
    throw new APIError(400, "Đã quá 24 giờ, không thể hủy");

  // Tất cả rule pass → gọi repository
  return OrderRepository.updateStatusWithRollback(
    orderId,
    OrderStatus.CANCELLED,
    true,                    // hoàn kho
    { action: "CANCEL", userId, oldStatus: order.status }
  );
}
```

> 💡 **Nguyên tắc:** Service là "bộ luật" của ứng dụng. Mọi điều kiện kinh doanh đều sống ở đây. Repository KHÔNG biết rule, Controller KHÔNG biết rule.

---

### ④ `order.repository.ts` — Chỉ làm việc với DB

```typescript
// Repository chỉ biết: SELECT, INSERT, UPDATE, DELETE
// Không có business logic ở đây

async findById(id: number) {
  return prisma.order.findUnique({
    where: { id },
    include: { details: true, payment: true, user: true }
  });
}
```

---

### ⑤ `order.schema.ts` — Validate dữ liệu đầu vào

```typescript
export const PlaceOrderSchema = z.object({
  shippingAddress: z.string().min(10, "Địa chỉ phải ≥ 10 ký tự"),
  shippingPhone:   z.string().regex(/^\+84[0-9]{9}$/, "SĐT không hợp lệ"),
  paymentMethod:   z.enum(["COD", "BANK_TRANSFER", "CREDIT_CARD", "MOMO"]),
  note:            z.string().max(500).optional(),
});
```

> 💡 **Tại sao dùng Zod?**  
> Nếu user gửi `{ shippingAddress: "" }` hoặc `{ paymentMethod: "BITCOIN" }` → Zod tự động từ chối và báo lỗi rõ ràng. Không cần viết if/else thủ công.

---

## 5. State Machine — Máy trạng thái đơn hàng

> 🎓 **State Machine là gì?**  
> Giống như đèn giao thông: `Xanh → Vàng → Đỏ → Xanh`. Không được nhảy từ `Xanh → Đỏ` trực tiếp.  
> Đơn hàng cũng vậy — không được nhảy từ `PENDING` sang `DELIVERED` một bước.

```
                    ┌─────────────┐
                    │   PENDING   │ ← Vừa đặt hàng, chưa xác nhận
                    └──────┬──────┘
                           │ Admin xác nhận
                           ▼
                    ┌─────────────┐
                    │  CONFIRMED  │ ← Đã xác nhận, chưa xử lý
                    └──────┬──────┘
                           │ Bắt đầu xử lý
                           ▼
                    ┌─────────────┐
                    │ PROCESSING  │ ← Đang đóng gói
                    └──────┬──────┘
                           │ Giao cho shipper
                           ▼
                    ┌─────────────┐
                    │  SHIPPING   │ ← Đang vận chuyển
                    └──────┬──────┘
                           │ Shipper giao thành công
                           ▼
                    ┌─────────────┐
                    │  DELIVERED  │ ← Đã giao
                    └──────┬──────┘
                           │ Xác nhận hoàn tất
                           ▼
                    ┌─────────────┐
                    │  COMPLETED  │ ← Hoàn thành
                    └─────────────┘

Đặc biệt — có thể CANCEL từ PENDING hoặc CONFIRMED:
PENDING   ──→ CANCELLED  (trong 24h, user tự hủy)
CONFIRMED ──→ CANCELLED  (trong 24h, user tự hủy HOẶC admin)
```

**Code implementation:**
```typescript
// order.repository.ts
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:    [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED:  [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPING],
  SHIPPING:   [OrderStatus.DELIVERED],
  DELIVERED:  [OrderStatus.COMPLETED, OrderStatus.RETURNED],
  COMPLETED:  [],   // Trạng thái cuối — không đi đâu được nữa
  CANCELLED:  [],
  RETURNED:   [],
};

// Trong service, admin cập nhật status:
const allowed = VALID_TRANSITIONS[order.status];
if (!allowed.includes(newStatus)) {
  throw new APIError(400, `Không thể chuyển từ ${order.status} sang ${newStatus}`);
}
```

---

## 6. Atomic Transaction — Giao dịch nguyên tử

> 🎓 **Transaction là gì?**  
> Giống như rút tiền ATM: hệ thống phải **trừ tiền trong tài khoản** VÀ **in ra tờ tiền** cùng lúc.  
> Nếu máy in tiền hỏng sau khi đã trừ tiền → **rollback**: tiền được trả lại, giao dịch coi như chưa xảy ra.

### Vấn đề: Race Condition (Điều kiện cạnh tranh)

```
User A thêm giỏ: Sofa Milan còn 1 chiếc
User B thêm giỏ: Sofa Milan còn 1 chiếc  (cùng lúc!)

User A kiểm tra: còn 1 ✅
User B kiểm tra: còn 1 ✅ (chưa kịp trừ)

User A tạo đơn → trừ tồn kho → còn 0
User B tạo đơn → trừ tồn kho → còn -1 ← 💥 VÍ DỤ

→ Overselling! Bán nhiều hơn hàng có trong kho!
```

### Giải pháp: `SELECT FOR UPDATE` (Row-level Lock)

```typescript
// order.repository.ts — createOrderAtomic
return prisma.$transaction(async (tx) => {
  for (const item of cartItems) {
    // 🔒 KHÓA ROW: Không ai được đọc/sửa row này cho đến khi transaction kết thúc
    const locked = await tx.$queryRaw<StockLockRow[]>`
      SELECT id, name, stockQuantity FROM Product
      WHERE id = ${item.productId}
      FOR UPDATE   ← ĐÂY là chìa khóa
    `;

    if (locked[0].stockQuantity < item.quantity) {
      throw new Error(`INSUFFICIENT_STOCK::${item.productName}::${locked[0].stockQuantity}`);
    }
  }

  // Tất cả OK → tạo order, payment, trừ kho, xóa cart
  // Nếu bất kỳ lỗi nào → AUTO ROLLBACK toàn bộ
});
```

```
Timeline với SELECT FOR UPDATE:

User A lock row Sofa Milan (stockQty=1) ←── User B phải CHỜ
User A kiểm tra: 1 ≥ 1 ✅
User A tạo đơn, trừ kho → stockQty=0
User A commit → UNLOCK

User B tiếp tục (đã chờ xong)
User B kiểm tra stockQty=0 → 0 < 1 ✗
User B: INSUFFICIENT_STOCK → thông báo lỗi cho user B
```

---

## 7. Audit Log — Nhật ký kiểm toán

> 🎓 **Audit Log là gì?**  
> Giống như camera an ninh trong ngân hàng — ghi lại MỌI thay đổi: ai làm gì, lúc nào, thay đổi gì.  
> Nếu có tranh chấp "tôi không hủy đơn đó!", admin có thể xem lịch sử.

```typescript
// auditLog.helper.ts
export const writeAuditLog = async (input: AuditLogInput, tx?: PrismaClient) => {
  const client = tx ?? prisma;  // Dùng transaction client nếu có
  await client.auditLog.create({
    data: {
      action:   "CANCEL",              // Hành động gì
      entity:   "Order",               // Đối tượng nào
      entityId: orderId,               // ID của đối tượng
      oldValue: { status: "PENDING" }, // Trước thay đổi
      newValue: { status: "CANCELLED", note: "User request" }, // Sau thay đổi
      userId:   3,                     // Ai làm
    }
  });
};
```

### ⚠️ Bug quan trọng đã fix: AuditLog phải nằm TRONG transaction

```typescript
// ❌ SAI — Nếu writeAuditLog crash, đơn đã bị hủy nhưng không có log
const updated = await updateStatusWithRollback(orderId, CANCELLED, true);
await writeAuditLog({ ... }); // Crash ở đây → mất audit trail!

// ✅ ĐÚNG — AuditLog nằm trong transaction
// Nếu writeAuditLog fail → rollback cả updateStatus
await updateStatusWithRollback(orderId, CANCELLED, true, {
  action: "CANCEL",
  userId: userId,
  // → Repository ghi AuditLog TRONG cùng transaction
});
```

---

## 8. Cron Job — Tự động hủy đơn timeout

> 🎓 **Cron Job là gì?**  
> Giống như báo thức — chạy một đoạn code theo lịch định kỳ.  
> "Mỗi phút, kiểm tra xem có đơn PENDING nào quá 15 phút không → hủy tự động"

```typescript
// orderTimeout.job.ts
export async function runOrderTimeoutJob() {
  // 1. Tìm tất cả đơn PENDING tạo > 15 phút trước
  const timedOutOrders = await OrderRepository.findTimedOutOrders();
  // SQL: WHERE status = 'PENDING' AND createdAt < NOW() - INTERVAL 15 MINUTE

  for (const order of timedOutOrders) {
    try {
      // 2. Hủy từng đơn (có hoàn kho + ghi AuditLog "TIMEOUT")
      await OrderRepository.updateStatusWithRollback(
        order.id,
        OrderStatus.CANCELLED,
        true, // hoàn kho
        { action: "TIMEOUT", userId: order.userId, oldStatus: "PENDING" }
      );
      console.log(`⏰ Auto-cancelled order #${order.id}`);
    } catch (err) {
      // Lỗi 1 đơn không dừng cả job
      console.error(`Failed to cancel order #${order.id}:`, err);
    }
  }
}

// server.ts — Đăng ký chạy mỗi 60 giây
setInterval(runOrderTimeoutJob, 60 * 1000);
```

**Tại sao xử lý từng đơn riêng lẻ (trong vòng lặp)?**  
Nếu đơn #5 bị lỗi (ví dụ: product đã bị xóa), đơn #6, #7, #8 vẫn tiếp tục được xử lý. Không để 1 record hỏng làm hỏng toàn bộ job.

---

## 9. Frontend — Checkout Flow

### File: `checkout.js` làm gì?

```
1. DOMContentLoaded:
   ├── Kiểm tra localStorage["authToken"]
   │   ├── Không có → hiện màn hình "Vui lòng đăng nhập"
   │   └── Có → tiếp tục
   │
   ├── Gọi GET /api/v1/cart (xác nhận giỏ hàng từ server)
   │   ├── 401 → token hết hạn → xóa token, hiện auth gate
   │   ├── Giỏ trống → hiện màn hình "Giỏ hàng trống"
   │   └── Có hàng → render summary sidebar bên phải
   │
   └── Setup các event listeners

2. User bấm "ĐẶT HÀNG NGAY":
   ├── Validate form:
   │   ├── Tên ≥ 2 ký tự
   │   ├── SĐT: regex /^(\+84|84|0)[0-9]{8,10}$/
   │   │     → Convert: "0912345678" → "+84912345678"
   │   └── Địa chỉ ≥ 10 ký tự
   │
   ├── POST /api/v1/orders {
   │     shippingAddress, shippingPhone (đã format +84),
   │     paymentMethod (COD/BANK_TRANSFER/MOMO), note?
   │   }
   │
   ├── Response OK:
   │   └── Hiện màn hình thành công + Mã đơn #123
   │
   └── Response Error:
       ├── 409 INSUFFICIENT_STOCK → "Sofa Milan chỉ còn 2 sản phẩm"
       ├── 400 CART_EMPTY → "Giỏ hàng trống"
       └── 401 → về trang login
```

---

## 10. Các lỗi đã fix và tại sao

### Bug #1 — Double Query sau SELECT FOR UPDATE

```typescript
// ❌ LỖI CŨ: Sau khi lock row, query THÊM LẦN NỮA để lấy tên
const locked = await tx.$queryRaw`SELECT stockQuantity FROM Product WHERE id = ? FOR UPDATE`;
const product = await tx.product.findUnique({ select: { name: true } }); // ← QUERY THỨ 2!
// Nếu product bị xóa giữa 2 query → crash

// ✅ FIX: Gộp vào 1 query duy nhất
const locked = await tx.$queryRaw`SELECT id, name, stockQuantity FROM Product WHERE id = ? FOR UPDATE`;
```

---

### Bug #2 — AuditLog ngoài Transaction

```typescript
// ❌ Nếu server crash sau dòng này → order đã CANCEL nhưng không có log
const updated = await repo.updateStatus(orderId, CANCELLED);
await writeAuditLog({ ... }); // ← Crash ở đây

// ✅ Truyền auditData vào TRONG transaction
await repo.updateStatusWithRollback(orderId, CANCELLED, true, { action: "CANCEL" });
//                                                              ↑ Ghi log bên trong tx
```

---

### Bug #3 — PaymentStatus string thay vì Enum

```typescript
// ❌ Hardcode string — nếu đổi tên enum thì không báo lỗi compile time
paymentStatus: "PENDING"

// ✅ Dùng enum → TypeScript báo lỗi ngay nếu viết sai
paymentStatus: PaymentStatus.PENDING
```

---

### Bug #4 — authMiddleware type `any` trong JWT decode

```typescript
// ❌ Unsafe
const decoded = jwt.verify(token, secret) as any;
(req as any).userId = decoded.userId; // Không biết decoded có userId không

// ✅ Typed
const decoded = jwt.verify(token, secret) as { userId: number; role: string };
// + Thêm check user EXISTS trong DB để tránh stale token
```

---

### Bug #5 — ESM Module Level getEnv() crash

```typescript
// ❌ Gọi getEnv() khi file được IMPORT (trước khi initializeEnv() chạy)
import apiRoutes from "./routes"; // → routes/index.ts chạy ngay
// routes/index.ts:
router.use(`/${getEnv().API_VERSION}/auth`); // ← CRASH! env chưa init

// ✅ Dùng process.env với fallback tại module level
const V = process.env["API_VERSION"] ?? "v1"; // Safe: fallback về "v1"
router.use(`/${V}/auth`);

// getEnv() chỉ gọi bên trong request handler (lazy)
router.get("/health", (req, res) => {
  const env = getEnv(); // ← OK: chạy lúc có request, env đã init
});
```

---

## 🎓 Tóm tắt bài học

| Concept | Ví dụ thực tế | Trong code |
|---|---|---|
| **Layered Architecture** | Nhà hàng: Khách → Lễ tân → Quản lý → Bếp | Route → Controller → Service → Repository |
| **Atomic Transaction** | Rút tiền ATM: phải trừ TK VÀ ra tiền cùng lúc | `prisma.$transaction()` |
| **SELECT FOR UPDATE** | Đặt chỗ: khóa ghế đang xem để người khác không lấy | `FOR UPDATE` trong raw query |
| **State Machine** | Đèn giao thông: chỉ đi đúng chiều | `VALID_TRANSITIONS` map |
| **Audit Log** | Camera ngân hàng: ghi mọi hành động | `writeAuditLog()` trong transaction |
| **Cron Job** | Báo thức: nhắc tự động | `setInterval(runOrderTimeoutJob, 60000)` |
| **Zod Validation** | Bảo vệ biên giới: kiểm tra giấy tờ đầu vào | `PlaceOrderSchema.safeParse(req.body)` |

---

## 📁 File Map Tổng hợp

```
REQUEST: POST /api/v1/orders
    │
    ├─→ backend/src/routes/index.ts           (đăng ký route)
    ├─→ backend/src/routes/order.routes.ts    (định nghĩa endpoint)
    ├─→ backend/src/middlewares/auth.middleware.ts  (xác thực token)
    ├─→ backend/src/controllers/order.controller.ts (đọc input, gọi service)
    ├─→ backend/src/schemas/order.schema.ts   (validate input)
    ├─→ backend/src/services/order.service.ts (business rules)
    ├─→ backend/src/repositories/order.repository.ts (DB queries)
    ├─→ backend/src/utils/auditLog.helper.ts  (ghi audit log)
    └─→ backend/prisma/schema.prisma          (định nghĩa DB schema)

CRON (mỗi 60 giây):
    ├─→ backend/src/server.ts                 (khởi động cron)
    ├─→ backend/src/jobs/orderTimeout.job.ts  (logic timeout)
    └─→ backend/src/repositories/order.repository.ts (DB queries)

FRONTEND:
    ├─→ src/checkout.html                     (giao diện)
    └─→ src/assets/js/checkout.js             (logic UI + gọi API)
```

---

> ✍️ **Ghi chú của Senior:**  
> Code tốt không chỉ là code chạy được — mà là code **người khác đọc vào 6 tháng sau vẫn hiểu**.  
> Mỗi hàm chỉ làm 1 việc. Mỗi tầng chỉ biết công việc của mình.  
> Đây là nền tảng của mọi hệ thống enterprise thực tế.
