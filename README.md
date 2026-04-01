# 🛒 Maverik Store - Fullstack E-Commerce

Chào mừng đến với Repo của dự án **Maverik Store** (Nhóm 39). Đây là nền tảng thương mại điện tử chuyên cung cấp các sản phẩm thời trang (Streetwear), mang phong cách UI/UX mô phỏng chuẩn xác từ website nguyên bản (maverikstudio.vn).

## 🚀 Tech Stack (Công nghệ sử dụng)
* **Frontend:** Vanilla JS, Bootstrap 5, Vite, SCSS.
* **Backend:** Node.js, Express.js, TypeScript.
* **Database:** MySQL, Prisma ORM.

## 📂 Kiến trúc dự án (Project Structure)
Dự án được phân tách rõ ràng 2 tầng Frontend và Backend:
```
maverikstore/
├── backend/               # Chứa toàn bộ logic Server, DB và API.
│   ├── prisma/            # Schema CSDL (11 Tables).
│   └── src/               # Code Backend (Kiến trúc 8 Layer Controller-Service-Repository).
├── src/                   # Chứa giao diện Frontend (Hệ thống các view HTML, JS, CSS).
├── docs/                  # Tài liệu thiết kế dự án (API, Architecture, Progress).
└── package.json           # Cấu hình Vite & scripts build Frontend.
```

## 📚 Tài liệu chi tiết (Documentation)
Thay vì đọc mọi thứ ở đây, các tài liệu kỹ thuật chuyên sâu được tách ra thư mục `docs/`:
- 📍 **[Tiến độ dự án (Roadmap)](../docs/PROGRESS.md)**: Các tính năng đã xong và sắp làm (VD: Giỏ hàng, Thanh toán, UI/UX...).
- 🏗️ **[Kiến trúc hệ thống](../docs/ARCHITECTURE.md)**: Giải thích mô hình 8-Layer Backend và sơ đồ 11 Bảng Database.
- 🔌 **[Tài liệu API](../docs/API.md)**: Danh sách toàn bộ các Endpoint (`/api/v1/...`) dành cho Frontend gọi.

---

## 🛠 Hướng dẫn Khởi chạy cho Thành viên Nhóm (Team local setup)

Để một thành viên mới clone project về và chạy thử, hãy làm theo các bước chuẩn sau:

### Bước 1: Chuẩn bị Database (MySQL)
1. Cài đặt **MySQL** (có thể sử dụng XAMPP, WAMP, hoặc MySQL Workbench).
2. Chạy dịch vụ MySQL (thường ở Port `3306`).
3. Tạo 1 database trống tên là `maverik_store`.

### Bước 2: Cấu hình Backend (Node.js & Prisma)
1. Mở Terminal, trỏ vào thư mục `backend`:
   ```bash
   cd backend
   npm install
   ```
2. Có một file tên là `.env.example` ngang hàng với `package.json`. Hãy copy nó, đổi tên thành `.env` và đưa nội dung này vào (nhớ sửa mật khẩu `1234567890` thành pass MySQL máy bạn):
   ```env
   DATABASE_URL=mysql://root:1234567890@localhost:3306/maverik_store
   PORT=5000
   API_VERSION=v1
   JWT_SECRET=maverik_studio_secret_key_123
   JWT_EXPIRE=7d
   ```
3. Push cấu trúc Prisma xuống Database và Seed dữ liệu mẫu:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```
   *(Lệnh `seed` sẽ tự động tạo sẵn Database với Danh mục, Sản phẩm và User test!)*
   
4. Bật server API:
   ```bash
   npm run dev
   # API sẽ chạy tại http://localhost:5000
   ```
   *(Tùy chọn: Gõ `npx prisma studio` để mở UI quản lý Database giống PHPMyAdmin tại cổng `5555`).*

### Bước 3: Khởi chạy Frontend (Giao diện)
1. Mở 1 terminal mới, trỏ vào thư mục gốc dự án (chứa Vite):
   ```bash
   npm install
   ```
2. Khởi chạy Giao diện:
   ```bash
   npm run dev
   # Trình duyệt sẽ mở web tại http://localhost:5173
   ```

## 🔑 Tài khoản Test mặc định (Sau khi Seed)
- **Admin**: `admin@maverik.com` | Pass: `Admin@1234`
- **Khách**: `customer@gmail.com` | Pass: `Customer@1234`

---
*© 2026 Maverik Store - Nhóm 39 - All Rights Reserved.*
