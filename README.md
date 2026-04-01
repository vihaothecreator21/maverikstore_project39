# 🛒 Maverik Store - Fullstack E-Commerce

Chào mừng đến với Repo của dự án **Maverik Store** (Nhóm 39). Đây là nền tảng thương mại điện tử chuyên cung cấp các sản phẩm thời trang (Streetwear), mang phong cách UI/UX mô phỏng chuẩn xác từ website nguyên bản (maverikstudio.vn).

## 🚀 Tech Stack (Công nghệ sử dụng)
* **Frontend:** Vanilla JS, Bootstrap 5, Vite, SCSS (Linh hoạt, siêu tốc độ).
* **Backend:** Node.js, Express.js, TypeScript.
* **Database:** MySQL, Prisma ORM.

## 📂 Kiến trúc dự án (Project Structure)
Dự án được triển khai theo mô hình Full-stack tiêu chuẩn, phân tách rõ ràng 2 tầng:
```
maverikstore/
├── backend/               # Chứa toàn bộ logic Server, DB và API.
│   ├── prisma/            # Schema CSDL (11 Tables).
│   └── src/               # Code Backend (Kiến trúc 8 Layer Controller-Service-Repository).
├── src/                   # Chứa giao diện Frontend (Hệ thống các view HTML, JS, CSS).
├── docs/                  # Tài liệu tiến độ dự án (PROGRESS.md, task.md).
└── package.json           # Cấu hình Vite & scripts build Frontend.
```

## 🛠 Hướng dẫn Khởi chạy (Getting Started)

### 1. Khởi chạy Backend
```bash
cd backend
npm install
# Cấu hình file .env phù hợp với Database của bạn
npx prisma generate
npm run dev
# Server API sẽ chạy tại http://localhost:5000
```
*(Bạn có thể quản trị Database bằng UI của Prisma qua lệnh `npx prisma studio` ở cổng `5555`)*

### 2. Khởi chạy Frontend
(Từ thư mục gốc dự án)
```bash
npm install
npm run dev
# Vite sẽ chạy giao diện tại http://localhost:5173 (hoặc port khác)
```

## 📈 Tiến độ dự án (Roadmap)
Để theo dõi các tính năng đã hoàn thành và sắp tới, vui lòng kiểm tra tại [docs/PROGRESS.md](./docs/PROGRESS.md).
Trong Markdown này, các task lớn như **Product CRUD**, **Bản vẽ Database**, **Giỏ hàng (Local Storage)** đã hoàn thành. Mục tiêu tiếp theo là **Thanh toán (Checkout)**.

---
© 2026 Maverik Store - All Rights Reserved.
