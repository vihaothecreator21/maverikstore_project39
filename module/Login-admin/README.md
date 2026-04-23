# 📁 Module Log — Maverik Store
> Lưu trữ tài liệu kỹ thuật, kế hoạch triển khai và phân tích hệ thống.

---

## Cấu trúc thư mục

```
Log/
├── README.md                    ← File này (mục lục)
│
├── 01_Plans/                    ← Kế hoạch & lộ trình phát triển
│   └── implementation_plan_auth_admin_dashboard.md
│
├── 02_Architecture/             ← Tài liệu kiến trúc hệ thống
│   └── admin_dashboard_architecture.md
│
└── 03_Analysis/                 ← Phân tích chi tiết từng module
    └── auth_flow_analysis.md
```

---

## 📋 Danh sách tài liệu

### 01_Plans — Kế hoạch triển khai
| File | Nội dung | Trạng thái |
|------|----------|------------|
| [implementation_plan_auth_admin_dashboard.md](./01_Plans/implementation_plan_auth_admin_dashboard.md) | Lộ trình 4 Phase: User Profile API → Admin Stats API → Frontend Auth → Admin Dashboard UI | ✅ Hoàn thành |

### 02_Architecture — Kiến trúc hệ thống
| File | Nội dung | Trạng thái |
|------|----------|------------|
| [admin_dashboard_architecture.md](./02_Architecture/admin_dashboard_architecture.md) | Cấu trúc folder, cơ chế phân quyền 2 lớp, Data Flow từ DB lên màn hình, sơ đồ Mermaid | ✅ Hoàn thành |

### 03_Analysis — Phân tích module
| File | Nội dung | Trạng thái |
|------|----------|------------|
| [auth_flow_analysis.md](./03_Analysis/auth_flow_analysis.md) | Phân tích luồng Authentication: register, login, JWT, session | ✅ Hoàn thành |

---

## Quy ước đặt tên file

```
[module]_[chủ_đề].md

Ví dụ:
- admin_dashboard_architecture.md
- order_state_machine_analysis.md
- payment_integration_plan.md
```

## Cách thêm tài liệu mới

1. Chọn đúng thư mục theo loại tài liệu:
   - `01_Plans/` → kế hoạch, roadmap, checklist triển khai
   - `02_Architecture/` → thiết kế hệ thống, data model, flow diagram
   - `03_Analysis/` → phân tích sâu module cụ thể, bug report analysis
2. Đặt tên file theo quy ước trên
3. Cập nhật bảng danh sách trong file `README.md` này
