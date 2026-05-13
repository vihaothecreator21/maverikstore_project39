# Maverik Store Module Docs

Thư mục này lưu tài liệu kỹ thuật theo module. Bản mới được sắp xếp để dễ đọc, dễ tra cứu trước khi sửa code. Tài liệu cũ đã được đưa vào `99-archive/` để giữ lịch sử nhưng không làm nhiễu luồng làm việc hiện tại.

## Cấu Trúc

| Thư mục | Mục đích |
| --- | --- |
| `00-overview/` | Bản đồ dự án, phạm vi module, quy ước đọc tài liệu |
| `01-architecture/` | Kiến trúc hệ thống, data flow, security flow |
| `02-features/auth-admin/` | Auth, RBAC, profile, admin dashboard |
| `02-features/orders/` | Cart, checkout, order lifecycle, payment status |
| `03-reviews/` | Tổng hợp review/audit và trạng thái xử lý |
| `99-archive/` | Tài liệu cũ, báo cáo đã resolved, bản nháp lịch sử |

## Tài Liệu Nên Đọc Trước

| Khi làm việc với | Đọc trước |
| --- | --- |
| Tổng quan project | `00-overview/project-map.md` |
| Backend architecture | `01-architecture/system-architecture.md` |
| Login, role, admin UI | `02-features/auth-admin/auth-admin-module.md` |
| Checkout, đơn hàng, thanh toán | `02-features/orders/order-module.md` |
| Review/audit cũ | `03-reviews/review-index.md`, sau đó xem `99-archive/` nếu cần chi tiết |

## Quy Ước Tài Liệu

- Tài liệu hiện hành nằm ngoài `99-archive/`.
- Không dùng `.resolved` cho tài liệu mới; nếu đã xử lý xong, ghi trạng thái trong nội dung.
- Mỗi module nên có một file tổng hợp ngắn, tránh nhiều file rời rạc lặp ý.
- Khi code thay đổi lớn, cập nhật file module liên quan và `AI_CONTEXT.md` ở project root nếu thay đổi ảnh hưởng toàn hệ thống.
