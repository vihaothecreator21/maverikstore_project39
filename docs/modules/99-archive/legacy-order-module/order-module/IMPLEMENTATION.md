# Order Module — Implementation Document

> **Version**: 1.0 · **Ngày tạo**: 2026-04-10
> **Phương án triển khai**: Backend API → Frontend UI (Option A)
> **Lý do chọn phương án này**: API phải stable trước để UI có dữ liệu thật để test. Tránh mock data và double-work khi join.

---

## PHƯƠNG ÁN TỐI ƯU: Backend First → Frontend Second

```
[Tuần 1] Backend API hoàn chỉnh
    └─ 8 file backend + cron job + audit helper

[Tuần 2] Frontend UI kết nối API thật
    └─ checkout.html + orders.html + order-detail.html
```

**Lý do không làm song song**: Project dùng Vanilla JS — không có mock layer hay storybook. Nếu làm đồng thời sẽ phải hardcode data giả vào UI rồi xóa đi, lãng phí.

---

## CODING RULES (BẮT BUỘC TUÂN THỦ)

### Backend Rules
| Rule | Chi tiết |
|---|---|
| **Layering** | Route → Controller → Service → Repository. Không skip tầng. Controller KHÔNG gọi trực tiếp Prisma. |
| **Decimal** | Mọi field tiền tệ dùng `Decimal`. Khi trả về JSON dùng `Number(price)` hoặc `.toString()`. |
| **Enum** | Dùng `OrderStatus` enum từ Prisma, không hardcode string "PENDING" |
| **Transaction** | Place Order PHẢI dùng `prisma.$transaction()`. Cancel Order PHẢI trong transaction. |
| **SELECT FOR UPDATE** | Dùng `$queryRaw` với `FOR UPDATE` khi lock stock trong Place Order |
| **AuditLog** | Mọi thay đổi status Order hoặc cancel PHẢI ghi AuditLog |
| **Error** | Dùng `APIError(statusCode, message, details, code)` — không throw Error trần |
| **Validation** | Zod schema validate mọi input trước khi vào Service |
| **Auth** | User routes: `authMiddleware`. Admin routes: `authMiddleware + requireAdmin` |
| **Async** | Tất cả handler wrap trong `catchAsync()` |

### Frontend Rules
| Rule | Chi tiết |
|---|---|
| **API calls** | Dùng `API_BASE_URL` từ `api-config.js`, không hardcode localhost |
| **Auth check** | Mỗi trang protected phải check `localStorage` token, redirect nếu không có |
| **Decimal display** | Format tiền bằng `formatVND()` — không dùng raw number |
| **Error display** | Dùng toast/alert nhất quán với các trang hiện có |
| **CSS** | Dùng Bootstrap class + SCSS đã có. Không thêm inline style |

---

## CẤU TRÚC FILE SẼ TẠO

### Backend (8 files)
```
backend/src/
├── schemas/
│   └── order.schema.ts               ← Zod validation
├── repositories/
│   └── order.repository.ts           ← Prisma queries + SELECT FOR UPDATE
├── services/
│   └── order.service.ts              ← Business logic + atomic transaction
├── controllers/
│   └── order.controller.ts           ← HTTP handlers
├── routes/
│   ├── order.routes.ts               ← User order routes
│   └── admin.routes.ts               ← Admin order routes
├── jobs/
│   └── orderTimeout.job.ts           ← Cron 1 phút
└── utils/
    └── auditLog.helper.ts            ← Ghi AuditLog
```

### Frontend (3 files)
```
src/
├── checkout.html                     ← Form đặt hàng
├── orders.html                       ← Lịch sử đơn
├── order-detail.html                 ← Chi tiết đơn
└── assets/js/
    ├── checkout.js
    ├── orders.js
    └── order-detail.js
```

---

## TASKS — Theo thứ tự thực hiện

### Phase 1: Backend Foundation

- [x] Schema đã migrate (Decimal, Enum, AuditLog)
- [ ] **Task 1**: `utils/auditLog.helper.ts` — Helper ghi AuditLog
- [ ] **Task 2**: `schemas/order.schema.ts` — Zod validation (PlaceOrder, Cancel, AdminUpdateStatus)
- [ ] **Task 3**: `repositories/order.repository.ts` — Prisma queries
- [ ] **Task 4**: `services/order.service.ts` — Business logic
- [ ] **Task 5**: `controllers/order.controller.ts` — HTTP handlers
- [ ] **Task 6**: `routes/order.routes.ts` + `admin.routes.ts`
- [ ] **Task 7**: Register routes vào `routes/index.ts`
- [ ] **Task 8**: `jobs/orderTimeout.job.ts` — Cron job
- [ ] **Task 9**: Register cron vào `server.ts`

### Phase 2: Frontend

- [ ] **Task 10**: `checkout.html` + `checkout.js`
- [ ] **Task 11**: `orders.html` + `orders.js`
- [ ] **Task 12**: `order-detail.html` + `order-detail.js`

---

## API CONTRACT

### POST /api/v1/orders — Place Order
**Request Body:**
```json
{
  "shippingAddress": "88 Hoàng Văn Thụ, Phú Nhuận, HCM",
  "shippingPhone": "+84912345678",
  "paymentMethod": "COD",
  "note": "Giao buổi sáng"
}
```
**Response 201:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "status": "PENDING",
    "totalAmount": "2850000.00",
    "details": [...],
    "payment": { "status": "PENDING", "method": "COD" }
  }
}
```
**Errors:**
- `400` — Giỏ hàng trống
- `409` — Hết hàng: "Sofa Milan chỉ còn 2 sản phẩm"

---

### GET /api/v1/orders — My Orders
**Response 200:**
```json
{
  "data": {
    "orders": [...],
    "pagination": { "page": 1, "total": 5 }
  }
}
```

---

### PATCH /api/v1/orders/:id/cancel — Cancel Order
**Response 200:**
```json
{
  "data": { "id": 1, "status": "CANCELLED" },
  "message": "Đơn hàng đã được hủy thành công"
}
```
**Errors:**
- `403` — Không phải đơn của bạn
- `400` — Quá 24h: "Đã quá thời gian cho phép hủy đơn"
- `400` — Sai status: "Không thể hủy đơn đang ở trạng thái SHIPPING"

---

### PATCH /api/v1/admin/orders/:id/status — Admin Update
**Request Body:**
```json
{ "status": "CONFIRMED", "note": "Đã kiểm tra hàng" }
```

---

## STATE MACHINE — Transition Rules

```typescript
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:    [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED:  [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPING],
  SHIPPING:   [OrderStatus.DELIVERED],
  DELIVERED:  [OrderStatus.COMPLETED, OrderStatus.RETURNED],
  COMPLETED:  [],   // terminal
  CANCELLED:  [],   // terminal
  RETURNED:   [],   // terminal
};
```

---

## BUSINESS RULES CHECKLIST

Trước khi merge mỗi task, verify:

**Place Order:**
- [ ] Giỏ hàng không được trống
- [ ] Tồn kho kiểm tra trong transaction (SELECT FOR UPDATE)
- [ ] `priceAtPurchase` lấy từ DB, không từ request body
- [ ] `totalAmount` tính trong server, không từ client
- [ ] Xóa CartItems sau khi tạo Order thành công
- [ ] Payment tạo cùng lúc với Order

**Cancel Order:**
- [ ] Order phải thuộc về user đang login
- [ ] Kiểm tra `createdAt + 24h > now()`
- [ ] Status chỉ là `PENDING` hoặc `CONFIRMED`
- [ ] Hoàn kho trong transaction
- [ ] Ghi AuditLog: action=CANCEL

**Order Timeout Cron:**
- [ ] Query: `status = PENDING AND createdAt < now() - 15min`
- [ ] Xử lý từng order trong transaction riêng (không batch)
- [ ] Bắt lỗi từng record, không để cron crash
- [ ] Ghi AuditLog: action=TIMEOUT

**Security:**
- [ ] User chỉ thấy đơn của mình (`userId = req.userId`)
- [ ] Admin mới update được status
- [ ] Không expose `passwordHash` trong response
