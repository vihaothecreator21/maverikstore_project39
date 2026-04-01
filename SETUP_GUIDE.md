# Maverik Store - Project Setup Guide

## 📱 Frontend (Vite + Bootstrap 5)

Located in `src/` folder.

### Features:

- 🛍️ Product showcase with categories
- 🛒 Shopping cart functionality
- ⭐ User testimonials & reviews
- 📧 Contact & About pages
- 📱 Responsive design (Mobile-first)
- 🖼️ Product image gallery with Swiper

### Run Frontend:

```bash
npm run dev    # Development
npm run build  # Production build
npm run preview # Preview production build
```

## 🔙 Backend (Node.js + Express + TypeScript)

Located in `backend/` folder.

### 🏗️ Architecture: Layered Architecture

- `src/controllers/` - HTTP request handlers
- `src/services/` - Business logic
- `src/repositories/` - Database interactions
- `src/routes/` - API endpoints
- `src/middlewares/` - Authentication, validation, error handling
- `src/schemas/` - Zod validation schemas
- `src/config/` - Configuration management
- `src/utils/` - Utility functions

### Tech Stack:

- **Runtime**: Node.js v18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MySQL 8.0
- **ORM**: Prisma
- **Authentication**: JWT
- **Validation**: Zod
- **Hashing**: Bcryptjs

### Setup Backend:

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Setup database
npm run prisma:migrate

# 4. Start development server
npm run dev
```

### Backend API Endpoints:

```
GET  /api/health              # Health check
GET  /api                      # API information

# Future endpoints will be added:
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/products
POST   /api/v1/orders
GET    /api/v1/users/{id}
```

## 📊 Database Schema (11 Tables)

| Table         | Purpose                  |
| ------------- | ------------------------ |
| Users         | User accounts & profiles |
| Categories    | Product categories       |
| Products      | Product inventory        |
| ProductImages | Product photos           |
| Carts         | Shopping carts           |
| CartItems     | Items in cart            |
| Orders        | Customer orders          |
| OrderDetails  | Order line items         |
| Payments      | Payment records          |
| Reviews       | Product ratings          |
| Favorites     | Wishlist items           |

## 🔐 User Roles

- **CUSTOMER** - Regular customer
- **ADMIN** - Store administrator
- **SUPER_ADMIN** - System administrator

## 📋 Project Roadmap

### ✅ Phase 1 (Frontend - Current)

- [x] Project structure setup
- [x] Product showcase pages
- [x] Shopping cart UI
- [x] Mobile responsiveness

### ✅ Phase 2 (Backend - In Progress)

- [x] Express.js server setup
- [x] Database schema design (11 tables)
- [x] TypeScript configuration
- [x] Layered architecture structure
- [ ] Authentication API (JWT)
- [ ] Product API endpoints
- [ ] Order management API
- [ ] Payment integration API

### ⏳ Phase 3 (Integration)

- [ ] Connect frontend to backend
- [ ] Cart management API
- [ ] Order processing
- [ ] Payment gateway

### ⏳ Phase 4 (Enhancement)

- [ ] Admin dashboard
- [ ] Analytics & reporting
- [ ] Email notifications
- [ ] SEO optimization

## 🚀 Quick Start (Full Project)

```bash
# Start both frontend and backend in parallel

# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
cd backend
npm run dev
```

## 🔑 Environment Variables

### Frontend (.env)

```env
VITE_API_URL=http://localhost:5000
```

### Backend (.env)

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=mysql://root:password@localhost:3306/maverik_store
JWT_SECRET=your_secret_key
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## 💡 Development Tips

- Use `npm run dev` to start frontend dev server
- Use `npm run dev` in backend for hot-reload with nodemon
- Keep `.env` files in `.gitignore` - never commit sensitive data
- Use Prisma Studio to visualize database: `npm run prisma:studio`
- Follow TypeScript strict mode for type safety
- Use Zod schemas for validation

## 📚 Useful Commands

### Frontend

```bash
npm run dev         # Start dev server
npm run build       # Build for production
npm run preview     # Preview prod build
```

### Backend

```bash
cd backend

npm run dev                 # Start dev server with hot-reload
npm run build              # Build TypeScript
npm start                  # Run production build
npm run prisma:migrate     # Create database schema
npm run prisma:studio      # Open Prisma Studio
npm run prisma:generate    # Regenerate Prisma Client
```

## 🐛 Troubleshooting

### Port already in use

```bash
# Change PORT in .env or kill process using port 5000
lsof -i :5000
kill -9 <PID>
```

### Database connection failed

- Check DATABASE_URL in .env
- Ensure MySQL server is running
- Verify database credentials

### TypeScript errors

```bash
cd backend
npm run build  # Check for compilation errors
```

## 📞 Support

For issues or questions, please check:

- Backend README: [backend/README.md](backend/README.md)
- API Documentation: (Coming soon)

---

**Maverik Store** - Version 1.0.0 | Built with ❤️ for E-commerce Excellence
