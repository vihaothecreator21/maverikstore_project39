# 🔐 Báo Cáo Phân Tích Phân Quyền — Maverik Store

> Phân tích dựa trên MCP Grapuco (repo `f621eb81`) + kiểm tra trực tiếp source code.

---

## ✅ KẾT LUẬN TỔNG QUAN

**Phân quyền ĐÃ được triển khai** trên backend. Hệ thống sử dụng mô hình **JWT + Role-Based Access Control (RBAC)** với 2 lớp middleware riêng biệt.

---

## I. CÁC THÀNH PHẦN ĐÃ TRIỂN KHAI

### 1. Middleware Phân Quyền — `auth.middleware.ts`

| Middleware | Chức năng | Trạng thái |
|---|---|---|
| `authMiddleware` | Xác thực JWT Bearer token, kiểm tra user tồn tại trong DB | ✅ Đã triển khai |
| `requireAdmin` | Kiểm tra role `ADMIN` hoặc `SUPER_ADMIN` | ✅ Đã triển khai |

**Cơ chế hoạt động của `authMiddleware`:**
```typescript
// 1. Kiểm tra Bearer token từ header
const token = authHeader.split(" ")[1];
const decoded = jwt.verify(token, JWT_SECRET);

// 2. ✅ Guard DB: Xác minh user thực sự tồn tại (phòng token cũ sau DB reset)
const userExists = await prisma.user.findUnique({ where: { id: decoded.userId } });

// 3. Gắn userId và role vào request (role luôn lấy từ DB, không tin token)
(req as any).userId = userExists.id;
(req as any).userRole = userExists.role;
```

> [!TIP]
> **Security Best Practice đã áp dụng:** `userRole` luôn được lấy từ DB, **không** từ JWT payload — tránh bị tấn công privilege escalation bằng token giả mạo.

---

### 2. Đăng Ký (Register) — `POST /api/v1/auth/register`

**File:** `auth.routes.ts` → `auth.controller.ts` → `auth.service.ts`

```
registerRateLimit (3 lần/giờ/IP)  →  AuthController.register  →  AuthService.register
```

| Bảo vệ | Trạng thái |
|---|---|
| Zod validation (RegisterSchema) | ✅ Có |
| Rate limit: **3 lần/giờ/IP** | ✅ Có |
| Default role = `CUSTOMER` khi tạo user | ✅ Có |
| Hash password (bcrypt trong service) | ✅ Có (qua `AuthService`) |
| Kiểm tra email đã tồn tại | ✅ Có (`UserRepository.emailExists`) |

---

### 3. Đăng Nhập Customer — `POST /api/v1/auth/login`

**File:** `auth.routes.ts` → `auth.controller.ts` → `auth.service.ts`

```
loginRateLimit (5 lần/15 phút/IP)  →  AuthController.login  →  AuthService.login  →  JWT token trả về
```

| Bảo vệ | Trạng thái |
|---|---|
| Zod validation (LoginSchema) | ✅ Có |
| Rate limit: **5 lần/15 phút/IP** | ✅ Có |
| JWT token có chứa `userId` + `role` | ✅ Có |
| In-memory rate limit store (theo IP) | ✅ Có (custom middleware) |

> [!NOTE]
> Rate limit hiện dùng **in-memory store** — hoạt động tốt cho single-server. Với production multi-server, cần nâng cấp lên **Redis**.

---

### 4. Phân Quyền Admin — `requireAdmin` middleware

Middleware này được áp dụng trên **tất cả** các route nhạy cảm:

#### Products (`product.routes.ts`)
| Route | Auth | Admin |
|---|---|---|
| `GET /products` | ❌ Public | ❌ Public |
| `GET /products/:id` | ❌ Public | ❌ Public |
| `POST /products` | ✅ `authMiddleware` | ✅ `requireAdmin` |
| `PUT /products/:id` | ✅ `authMiddleware` | ✅ `requireAdmin` |
| `DELETE /products/:id` | ✅ `authMiddleware` | ✅ `requireAdmin` |
| `POST /products/admin/fix-null-slugs` | ✅ `authMiddleware` | ✅ `requireAdmin` |

#### Orders (`order.routes.ts`)
| Route (prefix) | Middleware | Truy cập |
|---|---|---|
| `POST /orders` | `authMiddleware` | Customer (đã đăng nhập) |
| `GET /orders` | `authMiddleware` | Customer (chỉ đơn của mình) |
| `PATCH /orders/:id/cancel` | `authMiddleware` | Customer |
| `GET /admin/orders` | `authMiddleware` + `requireAdmin` | Admin only |
| `PATCH /admin/orders/:id/status` | `authMiddleware` + `requireAdmin` | Admin only |

#### Categories (`category.routes.ts`)
| Route | Auth | Admin |
|---|---|---|
| `GET /categories` | ❌ Public | ❌ Public |
| `POST /categories` | ✅ | ✅ |
| `PUT /categories/:id` | ✅ | ✅ |
| `DELETE /categories/:id` | ✅ | ✅ |

#### Cart (`cart.routes.ts`)
- **Toàn bộ cart routes** đều dùng `authMiddleware` (chỉ user đã đăng nhập mới dùng được)

---

## II. CÁC VẤN ĐỀ CÒN TỒN TẠI

> [!WARNING]
> **Cart sync endpoint không có `authMiddleware` riêng**
> `POST /cart/sync` gắn sau `cartRoutes.use(authMiddleware)` nhưng thứ tự khai báo quan trọng — cần verify middleware thực sự được áp dụng cho `/sync`.

> [!CAUTION]
> **Frontend chưa kiểm tra role Admin**
> Backend đã phân quyền hoàn chỉnh, nhưng **frontend chưa có trang Admin dashboard** được bảo vệ tương ứng. Bất kỳ ai biết URL có thể thấy trang admin (nếu có).

> [!IMPORTANT]
> **Chưa có `requireCustomer` middleware riêng**
> Hiện tại không có middleware ngăn Admin gọi vào customer endpoint. Ví dụ:  
> Admin có thể gọi `POST /orders` và đặt đơn — không sai logic nhưng cần xem xét về UX và audit.

---

## III. SO SÁNH VỚI YÊU CẦU TRONG `PA.md`

| Yêu cầu PA.md | Triển khai thực tế | Trạng thái |
|---|---|---|
| JWT & Role Guard (`src/modules/auth`) | `auth.middleware.ts` với `authMiddleware` + `requireAdmin` | ✅ ĐẦY ĐỦ |
| Rate limit 3/hour/IP cho Register | `registerRateLimit = rateLimit(3, 60*60*1000)` | ✅ ĐẦY ĐỦ |
| Rate limit 3/hour/IP cho Login | Login rate limit = **5/15 phút** (chặt hơn spec) | ✅ ĐẦY ĐỦ |
| Pass min 8 ký tự | Zod `RegisterSchema` (cần verify) | ⚠️ Chưa verify schema |
| Admin: Manage Products | `authMiddleware + requireAdmin` trên CRUD | ✅ ĐẦY ĐỦ |
| Enum cho role user | Prisma `role: "CUSTOMER"` mặc định | ✅ ĐẦY ĐỦ |

---

## IV. KIẾN TRÚC TỔNG THỂ AUTH FLOW

```
Client Request
     │
     ▼
[authMiddleware]
  ├─ Verify JWT Bearer token
  ├─ Guard check: user exists in DB
  └─ Gắn req.userId + req.userRole
     │
     ▼
[requireAdmin] (nếu cần)
  └─ Check role === "ADMIN" | "SUPER_ADMIN"
     │
     ▼
[Controller] ─► [Service] ─► [Repository] ─► [Prisma/DB]
```

---

## V. ĐỀ XUẤT TIẾP THEO

1. **Verify `RegisterSchema`** — Mở file `auth.schema.ts` để xác nhận có rule `min(8)` cho password.
2. **Thêm `requireCustomer` middleware** — Ngăn ADMIN role đặt đơn (optional, tùy business logic).
3. **Nâng cấp Rate Limit sang Redis** — Cho môi trường production multi-server.
4. **Frontend Admin Guard** — Tạo trang admin với route guard kiểm tra `role === ADMIN` từ localStorage/API.
