# Kế Hoạch Triển Khai — Maverik Store Auth + Admin Dashboard
> Cập nhật: 2026-04-11 | Dựa trên Grapuco MCP scan (37 data flows)

---

## Phân Tích Hiện Trạng

### ✅ Đã Có — Giữ Nguyên
| File | Trạng thái | Ghi chú |
|---|---|---|
| `auth.middleware.ts` | ✅ Hoàn chỉnh | `authMiddleware` + `requireAdmin` |
| `auth.service.ts` | ✅ Hoàn chỉnh | register / login / getProfile |
| `user.repository.ts` | ✅ Có sẵn | `updateProfile()` + `changePassword()` đã có |
| `order.routes.ts` | ✅ Hoàn chỉnh | User routes + Admin routes tách riêng |
| `order.service.ts` | ✅ Hoàn chỉnh | State machine, atomic transaction, AuditLog |
| `order.repository.ts` | ✅ Hoàn chỉnh | SELECT FOR UPDATE, findAll, updateStatus |
| `product.routes.ts` | ✅ Hoàn chỉnh | CRUD + requireAdmin |
| `category.routes.ts` | ✅ Hoàn chỉnh | CRUD + requireAdmin |
| `rateLimit.middleware.ts` | ✅ Hoàn chỉnh | In-memory 5/15min login, 3/h register |
| `auth-utils.js` | ✅ Hoàn chỉnh | syncCartAfterLogin, clearAuthData |
| `checkout.html` + `checkout.js` | ✅ Có sẵn | Chưa có auto-fill |

### ❌ Cần Xây Dựng
| Cần tạo | Lý do |
|---|---|
| `user.routes.ts` + `user.controller.ts` | Chưa có API profile/update cho customer |
| `profile.html` + `profile.js` | Khách chưa có trang sửa thông tin tài khoản |
| `admin.service.ts` + `admin.controller.ts` | Chưa có API stats/revenue/export |
| `admin.routes.ts` | Chưa mount admin analytics routes |
| `src/admin/` (toàn bộ) | Admin Dashboard UI chưa tồn tại |
| Redesign `login.html` + `register.html` | Dùng `alert()`, chưa tiếng Việt, chưa Maverik style |
| `login.js` + `register.js` (tách ra) | JS đang inline trong HTML — bad practice |
| Prefill trong `checkout.js` | Không tải thông tin tự động từ profile |

---

## PHASE 1 — Backend: User Profile API

**Mục tiêu:** Cho phép khách hàng xem và sửa thông tin tài khoản qua API.
`UserRepository.updateProfile()` và `changePassword()` **đã có** — chỉ cần thêm Controller + Route.

### Files cần tạo / sửa

#### [NEW] `backend/src/controllers/user.controller.ts`
```typescript
export class UserController {
  // GET  /api/v1/users/profile  → trả thông tin user hiện tại
  static async getProfile(req, res) { ... }

  // PUT  /api/v1/users/profile  → sửa username, email, phone, address
  static async updateProfile(req, res) { ... }

  // PUT  /api/v1/users/password → đổi mật khẩu (verify old password trước)
  static async changePassword(req, res) { ... }
}
```
- Dùng `req.userId` từ `authMiddleware` (không cần param `:id`)
- `updateProfile()` check unique email nếu user thay đổi email

#### [NEW] `backend/src/routes/user.routes.ts`
```typescript
userRoutes.get('/profile',  authMiddleware, catchAsync(UserController.getProfile));
userRoutes.put('/profile',  authMiddleware, catchAsync(UserController.updateProfile));
userRoutes.put('/password', authMiddleware, catchAsync(UserController.changePassword));
```

#### [MODIFY] `backend/src/routes/index.ts`
```typescript
// Bỏ comment @TODO, thêm:
import { userRoutes } from './user.routes';
router.use(`/${V}/users`, userRoutes);
```

#### [MODIFY] `backend/src/schemas/auth.schema.ts`
Cập nhật `UpdateProfileSchema` thêm `email` field:
```typescript
export const UpdateProfileSchema = z.object({
  fullName: z.string().min(2).max(50).optional(),
  email:    z.string().email().optional(),
  phone:    z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  address:  z.string().max(500).optional().nullable(),
});
```

#### [MODIFY] `backend/src/repositories/user.repository.ts`
Thêm method:
```typescript
static async isEmailTaken(email: string, excludeId: number): Promise<boolean>
static async updateEmail(id: number, email: string)
```

---

## PHASE 2 — Backend: Admin Stats & Revenue API

**Mục tiêu:** Cung cấp data cho Admin Dashboard — stats, revenue charts, export.

### Files cần tạo

#### [NEW] `backend/src/services/admin.service.ts`
```typescript
export class AdminService {
  // Dashboard tổng quan
  static async getDashboardStats()
  // → totalRevenue, grossRevenue, totalOrders, ordersByStatus,
  //   totalProducts, totalCustomers, pendingOrders, lowStockCount

  // Doanh thu theo thời gian (cho Bar Chart)
  static async getRevenueByPeriod(
    period: 'day'|'week'|'month'|'year',
    startDate: Date, endDate: Date
  )
  // → [{ date: '2026-04-01', revenue: 1500000, orderCount: 5 }]

  // Doanh thu theo phương thức thanh toán (cho Pie Chart)
  static async getRevenueByPaymentMethod(startDate: Date, endDate: Date)
  // → [{ method: 'COD', total: ..., count: ... }]

  // Top sản phẩm bán chạy
  static async getBestSellers(limit = 10)

  // Sản phẩm sắp hết hàng
  static async getLowStockProducts(threshold = 10)

  // Doanh thu theo danh mục
  static async getRevenueByCategory()

  // Thống kê khách hàng
  static async getCustomerStats()
  // → totalCustomers, newCustomersThisMonth, topSpenders[]

  // Export raw data cho client format
  static async getOrdersForExport(startDate: Date, endDate: Date)
  // → full order rows: id, date, customerName, phone, address,
  //   items, paymentMethod, totalAmount, status

  // AOV - Average Order Value
  static async getAOV(startDate: Date, endDate: Date)
}
```

#### [NEW] `backend/src/controllers/admin.controller.ts`
```typescript
// GET /api/v1/admin/stats
// GET /api/v1/admin/revenue?period=month&start=&end=
// GET /api/v1/admin/revenue/payment?start=&end=
// GET /api/v1/admin/products/stats
// GET /api/v1/admin/customers/stats
// GET /api/v1/admin/export/orders?start=&end=
```

#### [NEW] `backend/src/routes/admin.routes.ts`
```typescript
// Tất cả dùng authMiddleware + requireAdmin
adminRoutes.get('/stats',             ...AdminController.getDashboardStats);
adminRoutes.get('/revenue',           ...AdminController.getRevenue);
adminRoutes.get('/revenue/payment',   ...AdminController.getRevenueByPayment);
adminRoutes.get('/products/stats',    ...AdminController.getProductStats);
adminRoutes.get('/customers/stats',   ...AdminController.getCustomerStats);
adminRoutes.get('/export/orders',     ...AdminController.exportOrders);
```

#### [MODIFY] `backend/src/routes/index.ts`
```typescript
import { adminRoutes } from './admin.routes';
router.use(`/${V}/admin`, adminRoutes);
// Lưu ý: adminOrderRoutes vẫn giữ tại /admin/orders — không thay đổi
```

---

## PHASE 3 — Frontend: Auth Pages Redesign

**Mục tiêu:** Tiếng Việt, Maverik style, toast notification, redirect theo role.

### Files cần tạo / sửa

#### [MODIFY] `src/login.html` — Redesign
- Tiếng Việt: "Đăng nhập", "Email", "Mật khẩu"
- Xóa JS inline, load `login.js` riêng
- Maverik dark style (nhất quán checkout.html)

#### [NEW] `src/assets/js/login.js`
```javascript
// - POST /api/v1/auth/login
// - Lưu token + full user object (kể cả address, phone) vào localStorage
// - Gọi syncCartAfterLogin() từ auth-utils.js
// - Check role → redirect:
//   ADMIN/SUPER_ADMIN → admin/index.html
//   CUSTOMER          → index.html hoặc trang trước (history.back)
// - Toast notification, không dùng alert()
```

#### [MODIFY] `src/register.html` — Redesign + Address Optional
- Tiếng Việt hoàn toàn
- Fields: Họ tên, Email, SĐT, **Địa chỉ (tùy chọn)**, Mật khẩu, Xác nhận MK
- Ghi chú dưới field address: *"Có thể bổ sung sau trong trang Tài khoản"*
- Toast notification, không dùng alert()
- Xóa JS inline, load `register.js`

#### [NEW] `src/assets/js/register.js`
```javascript
// - Validate: name, email, phone VN, password strength
// - address: optional, nếu có thì min 10 chars
// - POST /api/v1/auth/register
// - Sau thành công: toast → redirect login.html
```

#### [MODIFY] `src/checkout.js` — Thêm Auto-fill
```javascript
async function prefillFromProfile(token) {
  const res = await fetch(`${API_BASE}/users/profile`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return; // Silently fail — user nhập tay

  const { data: user } = await res.json();
  if (user.username) document.getElementById('shipping-name').value = user.username;
  if (user.phone)    document.getElementById('shipping-phone').value = user.phone;
  if (user.address)  document.getElementById('shipping-address').value = user.address;

  // Hiện banner nếu có data được điền
  if (user.phone || user.address) {
    document.getElementById('prefill-banner').classList.remove('d-none');
  }
}
// Gọi hàm này trong DOMContentLoaded sau khi xác thực token
```

#### [MODIFY] `src/checkout.html`
Thêm prefill banner:
```html
<div id="prefill-banner" class="prefill-banner d-none">
  <i class="bi bi-person-check-fill"></i>
  Đã tải thông tin từ tài khoản của bạn
  <small class="text-muted ms-2">(có thể chỉnh sửa trực tiếp bên dưới)</small>
</div>
```

#### [NEW] `src/profile.html` — Trang Cài Đặt Tài Khoản
```
Tab 1: Thông tin cá nhân
  - Họ tên, Email, SĐT, Địa chỉ (textarea)
  - Nút Save → PUT /api/v1/users/profile

Tab 2: Đổi mật khẩu
  - Mật khẩu hiện tại, Mới, Xác nhận
  - Nút Đổi MK → PUT /api/v1/users/password

Tab 3: Lịch sử đơn hàng
  - List orders → GET /api/v1/orders
  - Badge status (màu theo trạng thái)
  - Expandable row xem chi tiết items
```

#### [NEW] `src/assets/js/profile.js`
```javascript
// Guard: nếu !token → redirect login.html
// - GET /api/v1/users/profile → hiển thị data
// - PUT /api/v1/users/profile → save
// - PUT /api/v1/users/password → đổi MK
// - GET /api/v1/orders → lịch sử đơn
```

---

## PHASE 4 — Admin Dashboard UI

**Mục tiêu:** Standalone admin panel tại `src/admin/` với dark sidebar layout.

### Cấu Trúc Files

```
src/admin/
├── index.html              ← Dashboard tổng quan
├── products.html           ← CRUD sản phẩm
├── categories.html         ← CRUD danh mục
├── orders.html             ← Quản lý đơn hàng + cập nhật trạng thái
├── revenue.html            ← Báo cáo + Export CSV/PDF
└── assets/
    ├── admin.css           ← CSS riêng (dark sidebar theme)
    └── js/
        ├── admin-guard.js      ← Auth + role guard
        ├── admin-nav.js        ← Sidebar active state
        ├── admin-dashboard.js  ← Stats + Chart.js
        ├── admin-products.js   ← CRUD operations
        ├── admin-categories.js
        ├── admin-orders.js     ← State machine UI
        └── admin-revenue.js    ← Charts + Export
```

### Design System Admin

```css
/* Sidebar */      background: #0f1117;  color: #fff;
/* Content bg */   background: #f5f6fa;
/* Card */         background: #fff; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.08);
/* Accent */       color: #6366f1;   (Indigo)
/* Success */      color: #22c55e;
/* Warning */      color: #f59e0b;
/* Danger */       color: #ef4444;
/* Font */         Inter (CDN, đã có)
```

### Layout Tổng Quát (tất cả trang)
```
┌──────────────────────────────────────────────────────────────────┐
│ [Sidebar 260px]          │  [Main Content]                        │
│                          │                                        │
│  🏷 MAVERIK ADMIN        │  ← Breadcrumb / Page Title             │
│  ─────────────────       │                                        │
│  📊 Dashboard            │  ← Page-specific content               │
│  📦 Sản phẩm             │                                        │
│  📁 Danh mục             │                                        │
│  📋 Đơn hàng             │                                        │
│  📈 Doanh thu            │                                        │
│  ─────────────────       │                                        │
│  👤 [Tên Admin]          │                                        │
│  🚪 Đăng xuất            │                                        │
└──────────────────────────────────────────────────────────────────┘
```

### [NEW] `src/admin/assets/js/admin-guard.js`
```javascript
export function requireAdminAccess() {
  const token = localStorage.getItem('authToken');
  const user  = JSON.parse(localStorage.getItem('user') || '{}');
  if (!token || !['ADMIN','SUPER_ADMIN'].includes(user.role)) {
    window.location.href = '/login.html';
    return null;
  }
  return { token, user };
}
```

### [NEW] `src/admin/index.html` — Dashboard

**Stats Cards (4):**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Doanh thu   │ │  Đơn hàng   │ │ Khách hàng   │ │  Hàng gần HX │
│  125,000,000 │ │     248      │ │     891      │ │      12      │
│  VND / tháng │ │  tổng đơn   │ │  đã đăng ký  │ │  stock < 10  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**Charts:**
- Bar Chart: Doanh thu 7 ngày gần nhất (Chart.js CDN)
- Pie Chart: Đơn theo trạng thái

**Tables:**
- 10 đơn hàng mới nhất (link sang orders.html)
- Top 5 sản phẩm bán chạy (link sang products.html)

**API calls:**
- `GET /api/v1/admin/stats`
- `GET /api/v1/admin/revenue?period=day`
- `GET /api/v1/admin/orders?limit=10`

### [NEW] `src/admin/products.html` — CRUD Sản Phẩm

**Features:**
- Search + filter theo Category dropdown
- Table: STT | Ảnh | Tên | Category | Giá | Tồn kho | Edit | Delete
- Stock badge đỏ nếu < 10
- **Modal Thêm/Sửa**: Name, Category (select), Price, Stock, Description, Image URL
- Confirm dialog trước Delete

**API (đã có):**
```
GET    /api/v1/products            ← danh sách
GET    /api/v1/categories          ← dropdown
POST   /api/v1/products            ← tạo mới
PUT    /api/v1/products/:id        ← cập nhật
DELETE /api/v1/products/:id        ← xóa
```

### [NEW] `src/admin/categories.html` — CRUD Danh Mục

- Table: ID | Tên | Slug | Số sản phẩm | Edit | Delete
- Inline form thêm mới (không cần modal)
- Warning khi xóa category có sản phẩm

### [NEW] `src/admin/orders.html` — Quản Lý Đơn Hàng

**Filter tabs:**
```
[ Tất cả ] [ Chờ xác nhận ] [ Đang xử lý ] [ Đang giao ] [ Đã giao ] [ Đã hủy ]
```

**Table columns:** #ID | Khách hàng | Sản phẩm | Tổng | PT Thanh toán | Trạng thái | Ngày | Actions

**Actions theo State Machine:**
| Status hiện tại | Nút hành động |
|---|---|
| PENDING | ✅ Xác nhận → CONFIRMED | ❌ Hủy → CANCELLED |
| CONFIRMED | 🔄 Xử lý → PROCESSING |
| PROCESSING | 🚚 Giao hàng → SHIPPING |
| SHIPPING | ✅ Đã giao → DELIVERED |
| DELIVERED | 🏁 Hoàn thành → COMPLETED | 🔁 Hoàn trả → RETURNED |

**Expand row:** Xem địa chỉ giao, SĐT, danh sách items, ghi chú

**API:**
```
GET   /api/v1/admin/orders             ← list + filter
GET   /api/v1/admin/orders/:id         ← chi tiết
PATCH /api/v1/admin/orders/:id/status  ← cập nhật trạng thái
```

### [NEW] `src/admin/revenue.html` — Báo Cáo + Export

**Section 1 — Bộ Lọc Thời Gian:**
```
[ Hôm nay ] [ 7 ngày ] [ 30 ngày ] [ Tháng này ] [ Năm này ] [ Tuỳ chọn... ]
Group by: [Ngày ▾] [Tuần ▾] [Tháng ▾] [Năm ▾]
```

**Section 2 — Stats Summary:**
```
┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Doanh thu gộp  │ │ Doanh thu thuần│ │  AOV TB đơn    │ │  Tỷ lệ hủy    │
│ (Gross Sales)  │ │ (Net Sales)    │ │                │ │                │
└────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘
```

**Section 3 — Charts (Chart.js):**
- **Bar Chart**: Doanh thu theo thời gian (theo period đã chọn)
- **Doughnut Chart**: Doanh thu theo PT thanh toán (COD / Bank / Momo)
- **Horizontal Bar**: Top 10 sản phẩm bán chạy
- **Bar Chart**: Doanh thu theo danh mục

**Section 4 — Bảng Chi Tiết:**
| #ID | Ngày | Khách hàng | SĐT | PT Thanh toán | Tổng tiền | Trạng thái |

**Section 5 — Export:**
```
[📄 Xuất CSV]   [📋 Xuất PDF]
```

**Export CSV (PapaParse):**
```javascript
// UTF-8 BOM để Excel đọc tiếng Việt đúng
const csv = Papa.unparse(data, { header: true });
const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
const url = URL.createObjectURL(blob);
// trigger download
```

**Export PDF (jsPDF + AutoTable):**
```javascript
const doc = new jsPDF();
// Header: "MAVERIK STORE — BÁO CÁO DOANH THU"
// Sub: "Kỳ: 01/04/2026 — 11/04/2026 | Xuất ngày: ..."
// Bảng tóm tắt: Tổng DT gộp, DT thuần, Số đơn, AOV, Tỷ lệ hủy
// Bảng chi tiết: danh sách đơn hàng
doc.save('maverik-revenue-2026-04.pdf');
```

**Nội dung báo cáo đầy đủ:**
| Nhóm | Chỉ số | API |
|---|---|---|
| **Doanh thu** | Gross/Net Sales, AOV, theo thời gian, theo PT thanh toán | `/admin/stats`, `/admin/revenue`, `/admin/revenue/payment` |
| **Đơn hàng** | Tổng theo status, tỷ lệ hủy/hoàn trả | `/admin/stats` (ordersByStatus) |
| **Sản phẩm** | Best sellers (qty + revenue), Low stock, Doanh thu theo Category | `/admin/products/stats` |
| **Khách hàng** | Tổng KH, KH mới trong kỳ, Top VIP spenders | `/admin/customers/stats` |

---

## Thứ Tự Thực Hiện

```
Step 1: Backend Phase 1  →  user.controller + user.routes + index.ts
Step 2: Backend Phase 2  →  admin.service + admin.controller + admin.routes + index.ts
Step 3: Frontend login.js + register.js (tách JS khỏi HTML)
Step 4: Frontend login.html + register.html (redesign)
Step 5: Frontend checkout.js (thêm prefill)
Step 6: Frontend profile.html + profile.js
Step 7: Admin CSS + admin-guard.js + admin-nav.js
Step 8: src/admin/index.html (Dashboard)
Step 9: src/admin/products.html
Step 10: src/admin/categories.html
Step 11: src/admin/orders.html
Step 12: src/admin/revenue.html (phức tạp nhất — export CSV/PDF)
```

---

## Verification Plan

### Backend API Tests
```bash
# Phase 1 — User Profile
GET  /api/v1/users/profile                   # Cần token
PUT  /api/v1/users/profile  body={address}   # Sửa địa chỉ
PUT  /api/v1/users/password body={old,new}   # Đổi MK

# Phase 2 — Admin Stats
GET  /api/v1/admin/stats                     # Cần ADMIN role
GET  /api/v1/admin/revenue?period=day&start=2026-04-01&end=2026-04-11
GET  /api/v1/admin/export/orders?start=2026-04-01&end=2026-04-11
```

### Critical Test Cases
| Test | Mong đợi |
|---|---|
| Register KHÔNG điền address → Checkout | Form trống, user nhập tay |
| Register CÓ địa chỉ → Checkout | Auto-fill phone + address |
| Login CUSTOMER | Redirect → `index.html` |
| Login ADMIN | Redirect → `admin/index.html` |
| Vào `admin/` khi chưa login | Redirect → `login.html` |
| Vào `admin/` khi là CUSTOMER | Redirect → `login.html` |
| Admin: SHIPPING → CONFIRMED | Backend 400 Invalid transition |
| Export CSV | File có BOM, Excel hiện tiếng Việt đúng |
| Export PDF | File có summary + detail table |

### Demo Flow
1. **Register** (không address) → **Login** → **Checkout** → Nhập tay → Đặt hàng ✓
2. **Profile** → Thêm address → **Checkout** → Auto-fill ✓
3. **Admin login** → **Dashboard** → **Products** CRUD → **Orders** xác nhận → **Revenue** Export PDF ✓
