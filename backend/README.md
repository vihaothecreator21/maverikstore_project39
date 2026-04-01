# Maverik Store API - Backend

Đây là Backend API của Maverik Store - một nền tảng E-commerce hiện đại xây dựng bằng **Node.js**, **Express**, **TypeScript**, và **Prisma ORM**.

## 🚀 Công nghệ sử dụng

- **Runtime**: Node.js v18+
- **Ngôn ngữ**: TypeScript
- **Framework**: Express.js
- **Database**: MySQL 8.0
- **ORM**: Prisma
- **Authentication**: JWT (JSON Web Token)
- **Validation**: Zod
- **Hashing**: Bcryptjs

## 📋 Kiến trúc

Dự án được xây dựng theo mô hình **Layered Architecture**:

```
src/
├── controllers/    # Xử lý HTTP requests
├── services/       # Business logic
├── repositories/   # Database interactions
├── routes/         # API routes
├── middlewares/    # Custom middleware
├── schemas/        # Zod validation schemas
├── config/         # Configuration files
├── utils/          # Utility functions
└── server.ts       # Application entry point
```

## 📦 Database Schema

Cơ sở dữ liệu gồm 11 bảng:

| Bảng              | Mô tả                                    |
| ----------------- | ---------------------------------------- |
| **Users**         | Thông tin người dùng (Khách hàng, Admin) |
| **Categories**    | Danh mục sản phẩm                        |
| **Products**      | Sản phẩm                                 |
| **ProductImages** | Hình ảnh sản phẩm                        |
| **Carts**         | Giỏ hàng                                 |
| **CartItems**     | Mục trong giỏ hàng                       |
| **Orders**        | Đơn hàng                                 |
| **OrderDetails**  | Chi tiết đơn hàng                        |
| **Payments**      | Thông tin thanh toán                     |
| **Reviews**       | Đánh giá sản phẩm                        |
| **Favorites**     | Sản phẩm yêu thích                       |

## 🔐 Enum Roles

- `CUSTOMER` - Khách hàng
- `ADMIN` - Quản trị viên
- `SUPER_ADMIN` - Siêu quản trị viên

## ⚙️ Installation

### 1. Clone project và cài đặt dependencies

```bash
cd backend
npm install
```

### 2. Tạo file `.env`

Sao chép từ `.env.example` và cập nhật các giá trị:

```bash
cp .env.example .env
```

Cập nhật file `.env`:

```env
DATABASE_URL=mysql://root:password@localhost:3306/maverik_store
JWT_SECRET=your_secret_key_here
PORT=5000
NODE_ENV=development
```

### 3. Thiết lập Database

Chạy Prisma migrations:

```bash
npm run prisma:migrate
```

### 4. Khởi động server

**Development mode:**

```bash
npm run dev
```

**Production mode:**

```bash
npm run build
npm start
```

## 📡 API Endpoints

### Health Check

```
GET /api/health
```

Response:

```json
{
  "status": "success",
  "message": "Maverik Store API is running",
  "environment": "development",
  "apiVersion": "v1",
  "timestamp": "2024-12-20T10:30:00.000Z"
}
```

## 📝 Scripts

```bash
npm run dev              # Start development server with nodemon
npm run build            # Build TypeScript to JavaScript
npm start                # Start production server
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Create and apply database migrations
npm run prisma:studio    # Open Prisma Studio GUI
npm run prisma:seed      # Seed database with initial data
```

## 🛠️ Development

### Cấu trúc thư mục mở rộng

```
backend/
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── product.controller.ts
│   │   └── order.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── product.service.ts
│   │   └── order.service.ts
│   ├── repositories/
│   │   ├── user.repository.ts
│   │   ├── product.repository.ts
│   │   └── order.repository.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── product.routes.ts
│   │   ├── order.routes.ts
│   │   └── index.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── errorHandler.middleware.ts
│   │   └── validation.middleware.ts
│   ├── schemas/
│   │   ├── user.schema.ts
│   │   ├── product.schema.ts
│   │   └── order.schema.ts
│   ├── config/
│   │   └── constants.ts
│   ├── utils/
│   │   ├── jwt.ts
│   │   ├── errors.ts
│   │   └── helpers.ts
│   └── server.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── dist/                    # Compiled JavaScript (after build)
├── .env
├── .env.example
├── .gitignore
├── nodemon.json
├── package.json
├── tsconfig.json
└── README.md
```

## 🔐 Security Best Practices

- ✅ JWT-based authentication
- ✅ Password hashing with bcryptjs
- ✅ Input validation with Zod
- ✅ CORS configuration
- ✅ Environment variables for sensitive data
- ✅ Prepared statements via Prisma ORM

## 📚 API Response Format

Tất cả responses tuân theo format tiêu chuẩn:

**Success:**

```json
{
  "status": "success",
  "code": 200,
  "data": {},
  "message": "Operation successful"
}
```

**Error:**

```json
{
  "status": "error",
  "code": 400,
  "message": "Error message",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## 🤝 Contributing

- Follow TypeScript strict mode
- Use camelCase for variables and functions
- Use PascalCase for classes and types
- Add proper error handling
- Write clean, readable code

## 📄 License

ISC

## 👥 Author

Maverik Store Dev Team

---

**Version**: 1.0.0 | **Last Updated**: December 2024
