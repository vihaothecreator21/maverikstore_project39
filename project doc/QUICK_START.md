# 📚 Maverik Store - Quick Reference

**Maverik Store** is a fullstack e-commerce platform (Streetwear focused) with **Frontend** (Vite + Vanilla JS + Bootstrap 5) and **Backend** (Node.js + Express + Prisma + MySQL).

---

## 🚀 Tech Stack

| Layer          | Technology                                  |
| -------------- | ------------------------------------------- |
| **Frontend**   | Vite, Vanilla JS, Bootstrap 5, SCSS, Swiper |
| **Backend**    | Express.js, TypeScript, Prisma ORM, MySQL   |
| **Auth**       | JWT + bcryptjs                              |
| **Validation** | Zod schemas                                 |

---

## 📁 Project Structure

```
maverikstore_project39/
├── src/                    # Frontend
│   ├── *.html             # 8 HTML pages
│   ├── assets/
│   │   ├── js/           # Page-specific logic
│   │   └── scss/         # Styles
│   └── style.scss
├── backend/               # Backend API
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── controllers/  # Request handlers
│   │   ├── services/     # Business logic
│   │   ├── repositories/ # Database layer
│   │   ├── schemas/      # Zod validation
│   │   ├── middlewares/  # Auth, error handling
│   │   └── config/       # DB & env setup
│   └── prisma/           # Database schema & migrations
└── package.json, vite.config.js
```

---

## 🔐 Security Status

✅ **Protected Routes:**

- `GET /auth/profile` - Requires JWT token
- `POST /products` - Requires JWT token
- `PUT /products/:id` - Requires JWT token
- `DELETE /products/:id` - Requires JWT token

✅ **Input Validation:**

- All inputs validated with Zod schemas
- XSS protection on image URLs
- Search parameter sanitization

---

## 🔌 Core API Endpoints

### Authentication

```
POST   /api/v1/auth/register   - Create account (rate limited)
POST   /api/v1/auth/login      - Login (rate limited)
GET    /api/v1/auth/profile    - Get profile (protected)
POST   /api/v1/auth/logout     - Logout
```

### Products

```
GET    /api/v1/products                - List with pagination/filter
GET    /api/v1/products/:id            - Get by ID
GET    /api/v1/products/slug/:slug     - Get by slug
POST   /api/v1/products                - Create (protected)
PUT    /api/v1/products/:id            - Update (protected)
DELETE /api/v1/products/:id            - Delete (protected)
```

### Categories & Cart

```
GET    /api/v1/categories              - List categories
GET    /api/v1/cart                    - Get cart (protected)
POST   /api/v1/cart/items              - Add to cart (protected)
PATCH  /api/v1/cart/items/:id          - Update qty (protected)
DELETE /api/v1/cart/items/:id          - Remove from cart (protected)
```

---

## 🏗️ Architecture Pattern

```
Request
  ↓ [Routes] - URL routing
  ↓ [Controllers] - Validate input
  ↓ [Services] - Business logic
  ↓ [Repositories] - Database queries (Prisma)
  ↓ [MySQL] - Store/retrieve data
```

**Benefits:** Separation of concerns, easy testing, maintainable code

---

## ⚙️ Setup & Running

### Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev  # Runs on port 5000
```

### Frontend

```bash
npm install
npm run dev  # Runs on port 5173
```

---

## 📊 Database Schema

**11 Tables:** Users, Products, Categories, Cart, Orders, Reviews, Favorites, AdminLogs, Cart Items, Product Images, Category Images

**Key:** Products linked to Categories via categoryId, Cart items via userId

---

## 🐛 Known Issues & Improvements

| Issue                                    | Status | Priority |
| ---------------------------------------- | ------ | -------- |
| Rate limiting (in-memory only)           | TODO   | Medium   |
| TODO routes (orders, reviews, favorites) | TODO   | Medium   |
| Frontend error boundaries                | TODO   | Low      |
| Admin role verification                  | TODO   | High     |

---

## 💡 Key Features

✅ Product listing with filtering & pagination  
✅ Shopping cart (localStorage-based)  
✅ User authentication with JWT  
✅ Admin product management  
✅ Rate limiting on auth endpoints  
✅ Input validation & sanitization

---

## 📝 Recent Optimizations (April 2026)

✅ Removed 11 console logs  
✅ Made API URLs environment-aware  
✅ Protected 5 critical routes with auth middleware  
✅ Consolidated redundant imports  
✅ All dependencies verified as in-use

See [CLEANUP_SUMMARY.md](./CLEANUP_SUMMARY.md) for details.

---

## 🔗 Related Docs

- [ARCHITECTURE_GRAPH.md](./ARCHITECTURE_GRAPH.md) - Detailed system architecture
- [CLEANUP_SUMMARY.md](./CLEANUP_SUMMARY.md) - Recent cleanup & optimizations
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Security fixes implemented
