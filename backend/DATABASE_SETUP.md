# 🔧 HƯỚNG DẪN CẤU HÀI DATABASE & KHỞI ĐỘNG BACKEND - MAVERIK STORE

## 📋 Bước 1: Cài đặt MySQL Server

### Windows:

1. Download MySQL Server từ: https://dev.mysql.com/downloads/mysql/
2. Chọn phiên bản **MySQL 8.0** trở lên
3. Chạy installer và làm theo hướng dẫn:
   - Chọn "Standalone MySQL Server"
   - Config Port: **3306** (mặc định)
   - Config MySQL as Windows Service
   - Username: **root**
   - Password: **Đặt mật khẩu riêng** (hoặc để trống nếu chỉ develop locally)

### Verify MySQL đã cài đặt:

```bash
mysql --version
```

---

## 🗄️ Bước 2: Tạo Database & User

Mở **MySQL Command Line Client** hoặc dùng **MySQL Workbench** và chạy:

```sql
-- Tạo database
CREATE DATABASE maverik_store DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Kiểm tra
SHOW DATABASES;
```

---

## 🔑 Bước 3: Cài đặt Environment Variables

Chỉnh sửa file `backend/.env` theo thông tin MySQL của bạn:

```env
NODE_ENV=development
PORT=5000
API_VERSION=v1

# Nếu MySQL password trống (development)
DATABASE_URL=mysql://root@localhost:3306/maverik_store

# Nếu MySQL có password
DATABASE_URL=mysql://root:YourPassword@localhost:3306/maverik_store
```

**⚠️ Quan trọng:**

- Thay `YourPassword` bằng mật khẩu thực tế của bạn
- Không commit file `.env` lên Git

---

## 🚀 Bước 4: Chạy Prisma Migrations

Khi đã cấu hình MySQL:

```bash
cd backend

# Test kết nối database
npm run prisma:generate

# Chạy migrations
npm run prisma:migrate

# (Hoặc nếu chạy lần đầu)
npm run prisma:migrate -- --name initial
```

Output mong muốn:

```
✔ Your database has been created at localhost:3306

✔ Prisma schema loaded from prisma\schema.prisma
✔ Database synchronized, migrations: 0 migrations
✔ Generated Prisma Client
```

---

## ▶️ Bước 5: Khởi động Backend Server

```bash
cd backend

# Development mode (hot-reload)
npm run dev

# Hoặc production
npm run build
npm start
```

Output mong muốn:

```
✓ Database connected successfully

╔════════════════════════════════════════╗
║    MAVERIK STORE API - DEVELOPMENT    ║
╠════════════════════════════════════════╣
║ Server running on port: 5000           ║
║ Environment: DEVELOPMENT              ║
║ API Version: v1                        ║
╚════════════════════════════════════════╝
```

---

## ✅ Bước 6: Test API Endpoints

```bash
# Health Check - sẽ return 200
curl http://localhost:5000/api/health

# Response:
{
  "status": "success",
  "message": "Maverik Store API is running",
  "environment": "development",
  "apiVersion": "v1",
  "timestamp": "2026-03-27T..."
}
```

---

## 🐛 Xử lý sự cố

### ❌ "Authentication failed against database"

- Kiểm tra DATABASE_URL trong `.env`
- Đảm bảo MySQL server đang chạy
- Verify username & password

### ❌ "Can't connect to server"

- Kiểm tra MySQL service:
  ```bash
  # Windows
  net start MySQL80
  ```
- Hoặc mở MySQL Workbench để xác nhận

### ❌ "Database does not exist"

- Chạy SQL CREATE DATABASE command ở trên

---

## 📊 Xem Database Structure

Mở **Prisma Studio** GUI:

```bash
cd backend
npm run prisma:studio
```

Sẽ mở browser tại http://localhost:5555 để xem/sửa data

---

## 📝 Ghi chú

- Prisma schema: `backend/prisma/schema.prisma`
- Database models: 11 tables (Users, Products, Orders, v.v.)
- Migrations folder: `backend/prisma/migrations/` (auto-generated)

**Khi hoàn thành tất cả, Backend Maverik Store sẽ sẵn sàng! 🚀**
