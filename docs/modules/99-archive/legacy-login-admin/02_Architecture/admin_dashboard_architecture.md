

## 1. Toàn cảnh: Project được chia làm 2 tầng

```
maverikstore_project39/
├── src/                        ← FRONTEND (HTML + JS thuần)
│   └── admin/
│       ├── index.html          ← Trang Dashboard
│       ├── revenue.html        ← Báo cáo doanh thu
│       └── assets/js/
│           ├── admin-guard.js  ← 🔐 Kiểm tra quyền phía CLIENT
│           ├── admin-dashboard.js
│           └── admin-revenue.js
│
└── backend/src/                ← BACKEND (Node.js + Express + TypeScript)
    ├── server.ts               ← Khởi động server
    ├── config/
    │   └── database.ts         ← Kết nối Prisma ↔ Database
    ├── routes/
    │   ├── index.ts            ← Tổng hợp tất cả routes
    │   └── admin.routes.ts     ← Route của Admin API
    ├── middlewares/
    │   └── auth.middleware.ts  ← 🔐 Kiểm tra quyền phía SERVER
    ├── controllers/
    │   └── admin.controller.ts ← Tiếp nhận request, gọi Service
    └── services/
        └── admin.service.ts    ← Logic nghiệp vụ, truy vấn DB
```

> **Analogỳ thực tế:** Tưởng tượng một nhà hàng cao cấp:
> - **Frontend** = Quầy lễ tân (nhìn đẹp, tiếp khách)
> - **Backend** = Bếp + Kho hàng + Sổ sách (logic thật sự)

---

## 2. Cơ chế Phân quyền (Authorization) — **2 lớp bảo vệ**

Hệ thống này dùng **2 lớp bảo vệ độc lập**, như nhà có cả khóa cửa ngoài lẫn camera an ninh trong nhà.

### Lớp 1: Guard phía Client (Frontend)

**File:** [`src/admin/assets/js/admin-guard.js`](file:///c:/Users/vihao/.gemini/antigravity/scratch/maverikstore_project39/src/admin/assets/js/admin-guard.js)

```js
// Dòng 7-18
export function requireAdminAccess() {
  const token = localStorage.getItem("authToken");          // ① Lấy token
  const user  = JSON.parse(localStorage.getItem("user") || "{}"); // ② Lấy info user

  if (!token || !user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    // ③ Nếu KHÔNG phải admin → redirect về trang login
    sessionStorage.setItem("redirectAfterLogin", window.location.href);
    window.location.href = "/login.html";
    return null;
  }
  return { token, user };  // ④ Trả về token để dùng cho API calls
}
```

**Cách hoạt động:** Khi bạn mở `admin/index.html`, dòng đầu tiên trong `admin-dashboard.js` sẽ gọi:
```js
// admin-dashboard.js dòng 9-10
const auth = requireAdminAccess();
if (!auth) throw new Error("Unauthorized");
```

Nếu user không có `role = ADMIN | SUPER_ADMIN` trong `localStorage` → bị đá ra trang login ngay, **không cần đợi server**.

> ⚠️ **Quan trọng cần hiểu:** Lớp 1 này chỉ là UX — nó **không bảo mật thật sự**. Kẻ xấu vẫn có thể dùng Postman hoặc DevTools để gọi API trực tiếp. Đó là lý do cần **Lớp 2**.

---

### Lớp 2: Middleware phía Server (Backend) — Lớp bảo vệ thật sự

**File:** [`backend/src/middlewares/auth.middleware.ts`](file:///c:/Users/vihao/.gemini/antigravity/scratch/maverikstore_project39/backend/src/middlewares/auth.middleware.ts)

Có **2 middleware** hoạt động tuần tự:

#### Middleware ①: `authMiddleware` — Xác thực danh tính (Authentication)

```ts
// Dòng 7-54
export const authMiddleware = async (req, res, next) => {
  // Bước 1: Đọc token từ header "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // ❌ Không có token → trả 401 Unauthorized
    sendError(res, ..., HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  // Bước 2: Giải mã JWT để lấy userId và role
  const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, getEnv().JWT_SECRET) as {
    userId: number;
    role: string;
  };

  // Bước 3: ⚡ Check DB — User có còn tồn tại không?
  // (Phòng TH xóa user nhưng token vẫn còn hiệu lực)
  const userExists = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, role: true },
  });

  if (!userExists) {
    sendError(res, ..., HTTP_STATUS.UNAUTHORIZED); // ❌ User bị xóa
    return;
  }

  // ✅ Đính kèm thông tin vào request để các middleware sau dùng
  (req as any).userId   = userExists.id;
  (req as any).userRole = userExists.role; // Lấy role từ DB, KHÔNG tin token

  next(); // → Chuyển qua middleware tiếp theo
};
```

> **Lưu ý cực kỳ quan trọng ở dòng 48:**  
> `userRole = userExists.role` — role được lấy từ **Database**, KHÔNG phải từ token.  
> Lý do: Nếu ai đó sửa role trong DB (downgrade từ ADMIN → CUSTOMER), token cũ vẫn còn hạn nhưng sẽ bị deny. Đây là **Security Best Practice**.

---

#### Middleware ②: `requireAdmin` — Kiểm tra quyền (Authorization)

```ts
// Dòng 60-76
export const requireAdmin = (req, res, next) => {
  const role = (req as any).userRole; // Lấy role đã được authMiddleware gán

  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    // ❌ User đã đăng nhập nhưng không phải Admin → 403 Forbidden
    sendError(res, ..., HTTP_STATUS.FORBIDDEN);
    return;
  }
  next(); // ✅ Admin hợp lệ → cho đi tiếp
};
```

> **Phân biệt 401 vs 403:**
> - `401 Unauthorized` = "Tôi không biết bạn là ai" (chưa đăng nhập)
> - `403 Forbidden` = "Tôi biết bạn là ai nhưng bạn không được phép vào đây"

---

### Nơi 2 middleware được gắn vào

**File:** [`backend/src/routes/admin.routes.ts`](file:///c:/Users/vihao/.gemini/antigravity/scratch/maverikstore_project39/backend/src/routes/admin.routes.ts)

```ts
// Dòng 24 — Áp dụng cho TẤT CẢ routes trong file này
adminRoutes.use(authMiddleware, requireAdmin);

// Sau đó mới đến các routes thật sự:
adminRoutes.get("/stats",           catchAsync(AdminController.getDashboardStats));
adminRoutes.get("/revenue",         catchAsync(AdminController.getRevenue));
adminRoutes.get("/products/stats",  catchAsync(AdminController.getProductStats));
// ...
```

`adminRoutes.use(...)` nghĩa là: **mọi request đến bất kỳ route nào trong file này đều phải vượt qua 2 middleware trên trước**.

---

## 3. Data Flow — Hành trình của một Request

Khi bạn mở trang Dashboard, `admin-dashboard.js` gọi `GET /api/v1/admin/stats`. Dưới đây là toàn bộ hành trình của request đó:

```
Browser
  │
  │  GET /api/v1/admin/stats
  │  Header: Authorization: Bearer eyJhbGci...
  │
  ▼
[server.ts dòng 57] → app.use("/api", apiRoutes)
  │
  ▼
[routes/index.ts dòng 79] → router.use("/v1/admin", adminRoutes)
  │
  ▼
[routes/admin.routes.ts dòng 24] → adminRoutes.use(authMiddleware, requireAdmin)
  │
  ├─── ① authMiddleware (auth.middleware.ts:7)
  │       - Tách token từ header
  │       - Giải mã JWT → {userId, role}
  │       - Query DB: prisma.user.findUnique({id})
  │       - Gán req.userId, req.userRole
  │
  ├─── ② requireAdmin (auth.middleware.ts:60)
  │       - Đọc req.userRole
  │       - Kiểm tra: "ADMIN" hoặc "SUPER_ADMIN"?
  │       - Không → 403 Forbidden ❌
  │       - Có → next() ✅
  │
  ▼
[routes/admin.routes.ts dòng 26] → catchAsync(AdminController.getDashboardStats)
  │
  ▼
[controllers/admin.controller.ts dòng 14]
  │   static async getDashboardStats(req, res) {
  │     const stats = await AdminService.getDashboardStats();
  │     return sendSuccess(res, stats, "Dashboard statistics retrieved");
  │   }
  │
  ▼
[services/admin.service.ts dòng 18]
  │   static async getDashboardStats() {
  │     // Gọi Prisma để truy vấn Database
  │     const [totalOrders, ordersByStatus, ..., todayRevenue, ...] =
  │       await Promise.all([
  │         prisma.order.count(),
  │         prisma.order.groupBy({ by: ["status"], _count: ... }),
  │         prisma.product.count(),
  │         // ... 8 queries chạy song song
  │       ]);
  │
  │     // Tính toán: aov, cancelRate, todayGross...
  │     return { revenue, today, orders, products, customers };
  │   }
  │
  ▼
[config/database.ts dòng 13] → Prisma Client → PostgreSQL/MySQL
  │
  │  SELECT COUNT(*) FROM orders WHERE createdAt >= '2026-04-17'...
  │
  ▼
Database → trả kết quả về Prisma
  │
  ▼
service → trả object { revenue, today, orders, products, customers }
  │
  ▼
controller → sendSuccess(res, stats, "Dashboard statistics retrieved")
  │
  ▼
Browser nhận JSON:
  {
    "success": true,
    "data": {
      "today": { "gross": 0, "net": 0, "orderCount": 0 },
      "revenue": { "gross": 24000000, ... },
      "orders": { "total": 15, "pending": 3 },
      ...
    }
  }
  │
  ▼
[admin-dashboard.js dòng 36-48]
  setEl("stat-revenue", formatVND(s.today.gross)); // → "0đ" hôm nay
  setEl("stat-orders",  s.orders.total);           // → "15"
```

---

## 4. Vai trò từng lớp — Tóm tắt bằng ví dụ thực tế

| Lớp | File | Vai trò | Ví dụ thực tế |
|-----|------|---------|---------------|
| **Route** | `admin.routes.ts` | Cánh cửa + biển chỉ đường | Quầy Reception khách sạn |
| **Middleware** | `auth.middleware.ts` | Bảo vệ an ninh | Nhân viên bảo vệ kiểm tra thẻ |
| **Controller** | `admin.controller.ts` | Điều phối | Manager nhận yêu cầu, phân công |
| **Service** | `admin.service.ts` | Logic nghiệp vụ | Kế toán tính toán số liệu |
| **Prisma/DB** | `config/database.ts` | Kho dữ liệu | Kho hàng, sổ sách |

---

## 5. Điều thú vị đáng học: `catchAsync`

**File:** [`backend/src/utils/catchAsync.ts`](file:///c:/Users/vihao/.gemini/antigravity/scratch/maverikstore_project39/backend/src/utils/catchAsync.ts)

```ts
// Dòng 15-19
export const catchAsync =
  (fn: async (req, res, next) => Promise<any>) =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next); // Tự động catch lỗi async
  };
```

Express không tự xử lý lỗi từ `async/await`. Nếu không có `catchAsync`, mỗi controller phải tự viết `try/catch`. Wrapper này giải quyết vấn đề đó.

**Dùng trong route:**
```ts
// Thay vì:
adminRoutes.get("/stats", async (req, res, next) => {
  try {
    const stats = await AdminService.getDashboardStats();
    res.json(stats);
  } catch (err) {
    next(err); // Phải nhớ gọi next(err)
  }
});

// Viết gọn hơn:
adminRoutes.get("/stats", catchAsync(AdminController.getDashboardStats));
// ↑ Tự động catch mọi lỗi async và chuyển đến errorHandler
```

---

## 6. JWT hoạt động như thế nào?

Khi user đăng nhập thành công, backend tạo một **JWT token** (chuỗi mã hóa) có dạng:

```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJBRE1JTiJ9.xxx
         ↑ Header          ↑ Payload (userId, role, exp)      ↑ Signature
```

- **Payload** chứa `userId` và `role` — **có thể đọc được** (base64)
- **Signature** đảm bảo không ai sửa được payload mà không có `JWT_SECRET`
- Token được lưu vào `localStorage` và gửi kèm mọi request admin

> **Tại sao vẫn query DB trong `authMiddleware` dù JWT đã có `role`?**  
> Vì nếu Admin A bị downgrade thành Customer trong DB, token của A vẫn còn hạn dùng.  
> Bằng cách luôn lấy `role` từ DB (dòng 48: `userExists.role`), hệ thống đảm bảo  
> role **luôn phản ánh trạng thái hiện tại** trong Database, không phải lúc đăng nhập.

---

## 7. Sơ đồ tổng hợp

```mermaid
graph TD
    A["🌐 Browser mở admin/index.html"] --> B

    B["admin-guard.js\nrequireAdminAccess()\nKiểm tra localStorage"] -->|Không phải Admin| C["❌ Redirect → /login.html"]
    B -->|Admin hợp lệ| D

    D["Gọi fetch(GET /api/v1/admin/stats)\nHeader: Bearer token"] --> E

    E["server.ts\napp.use('/api', apiRoutes)"] --> F
    F["routes/index.ts\nrouter.use('/v1/admin', adminRoutes)"] --> G
    G["admin.routes.ts\nadminRoutes.use(authMiddleware, requireAdmin)"] --> H

    H["authMiddleware\n① Đọc token\n② jwt.verify()\n③ findUnique DB"] -->|User không tồn tại| I["❌ 401 Unauthorized"]
    H -->|User tồn tại| J

    J["requireAdmin\nKiểm tra req.userRole"] -->|Không phải Admin| K["❌ 403 Forbidden"]
    J -->|ADMIN/SUPER_ADMIN| L

    L["AdminController\n.getDashboardStats()"] --> M
    M["AdminService\nQuery DB song song\nTính revenue, orders..."] --> N
    N["Prisma Client\nSQL → Database"] -->|Kết quả| M
    M -->|stats object| L
    L -->|sendSuccess(res, stats)| O

    O["🌐 Browser nhận JSON\nRender stats cards + charts"]
```

---

## 8. Câu hỏi để tự kiểm tra

1. Nếu xóa `requireAdmin` khỏi `admin.routes.ts`, chuyện gì xảy ra?
2. Tại sao lớp 1 (client-side guard) vẫn cần thiết dù không bảo mật thật sự?
3. `Promise.all([...8 queries...])` trong `getDashboardStats` có ý nghĩa gì về hiệu suất?
4. Tại sao `userRole` được lấy từ Database thay vì từ token?
5. `catchAsync` giải quyết vấn đề gì của Express mặc định?

