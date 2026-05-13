# 🏗️ Maverik Store - Project Architecture

## Tech Stack Overview

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| **Frontend**   | Vite, Vanilla JS, Bootstrap 5, SCSS |
| **Backend**    | Express.js, TypeScript, Prisma ORM  |
| **Database**   | MySQL                               |
| **Auth**       | JWT + bcryptjs                      |
| **Validation** | Zod schemas                         |

---

## System Architecture

```
🖥️ FRONTEND (Vite)
├── 8 HTML Pages
├── 7 JavaScript Modules
└── SCSS Styling
   ↓ (fetch /api/v1/*)
🚀 EXPRESS SERVER (Port 5000)
├── Routes → Controllers → Services → Repositories
├── Auth Middleware (JWT verification)
├── Error Handling & Rate Limiting
└── CORS & Body Parser
   ↓
🗄️ PRISMA ORM + MySQL Database
├── 9 Models (User, Product, Category, Cart, CartItem, Order, Review, Favorite, ProductImage)
└── Automated Migrations
```

---

## Request Flow Architecture

### 1️⃣ Authentication Flow

```
Frontend (login → form submit)
  ↓ POST /auth/login
Controller (validate with LoginSchema)
  ↓ calls
Service (findByEmail → bcrypt.compare → generateToken)
  ↓ queries
Repository + Prisma
  ↓
MySQL DB → returns JWT
  ↓
Frontend stores token in localStorage
```

### 2️⃣ Product Discovery Flow

```
Frontend (GET /products.html)
  ↓ fetch /products?page=1&limit=10
Controller (validate query params)
  ↓ calls
Service (business logic)
  ↓ queries
Repository → Prisma → MySQL
  ↓ renders products list
Frontend
```

### 3️⃣ Shopping Cart Flow

```
User clicks "Add to Cart (product ID + qty)
  ↓ POST /cart/add (with JWT)
CartController (validate with CartSchema + auth check)
  ↓ calls
CartService (verify product stock → update/create CartItem)
  ↓ queries
Repository → Prisma → MySQL (INSERT/UPDATE)
  ↓ returns updated cart
Frontend (update cart UI)
```

---

## Core Modules & Responsibilities

### Backend Structure (27 files)

**Controllers (4 files)**

- AuthController: Register, Login, GetProfile, Logout
- ProductController: CRUD operations for products
- CategoryController: List categories
- CartController: Cart management

**Services (4 files)**

- AuthService: JWT generation, password hashing, validation
- ProductService: Product business logic (slug generation)
- CategoryService: Category retrieval
- CartService: Cart operations with stock checks

**Repositories (4 files)**

- UserRepository: User queries
- ProductRepository: Product queries + pagination
- CategoryRepository: Category queries
- CartRepository: Cart & CartItem queries

**Schemas (3 files)** - Zod validation for:

- Auth: Registration, Login, Profile
- Product: Name, Price, Stock, Images
- Cart: Product selection, quantity

**Middleware (4 files)**

- Auth Middleware: JWT verification
- Error Handler: Global exception handling
- Rate Limiter: Brute-force protection
- NotFound: 404 responses

**Utils (3 files)**

- apiResponse: Response formatting
- catchAsync: Async error wrapper
- slug.helper: URL slug generation

### Frontend Structure (14 files)

**HTML Pages (8)**

- index.html, products.html, product-detail.html
- login.html, register.html, cart.html
- about.html, contact.html, testimonials.html

**JavaScript Modules (7)**

- main.js: Global bootstrap & imports
- products.js: Product listing & filtering
- product-detail.js: Single product view
- cart.js: Cart UI component
- cart-page.js: Cart page logic
- custom.js: Global utilities
- swiper.js: Image carousel

---

## Layered Architecture Pattern

```
REQUEST LAYER
Input from Frontend (HTTP GET/POST/PUT/DELETE)
     ↓
ROUTES LAYER
URL Pattern Matching → Route Definitions
     ↓
CONTROLLER LAYER
Validation (Zod Schemas) → Request Parsing
     ↓
SERVICE LAYER
Business Logic → Data Transformation → Authorization
     ↓
REPOSITORY LAYER
Database Query Layer → Abstraction from ORM
     ↓
PRISMA ORM LAYER
Query Generation → Connection Management
     ↓
DATA PERSISTENCE LAYER
MySQL Database → Actual Data Storage
```

**Benefits:**
✅ Separation of concerns  
✅ Each layer has single responsibility  
✅ Easy to test and maintain  
✅ Code reusability

---

## API Endpoints (Protected Routes Marked with 🔒)

**Auth**

- POST /api/v1/auth/register (rate limited)
- POST /api/v1/auth/login (rate limited)
- GET /api/v1/auth/profile 🔒 (protected)
- POST /api/v1/auth/logout

**Products**

- GET /api/v1/products (pagination, filter)
- GET /api/v1/products/:id
- GET /api/v1/products/slug/:slug
- POST /api/v1/products 🔒 (protected)
- PUT /api/v1/products/:id 🔒 (protected)
- DELETE /api/v1/products/:id 🔒 (protected)

**Categories & Cart**

- GET /api/v1/categories
- GET /api/v1/cart 🔒 (protected)
- POST /api/v1/cart/items 🔒 (protected)
- PATCH /api/v1/cart/items/:id 🔒 (protected)
- DELETE /api/v1/cart/items/:id 🔒 (protected)

---

## Database Schema (9 Models)

```
User
├── id (PK)
├── email (unique)
├── password (hashed)
├── role (user | admin)
└── timestamps

Product ← Category
├── id (PK)
├── name, slug
├── price, stockQuantity
├── categoryId (FK)
├── description, imageUrl
└── timestamps

Category
├── id (PK)
├── name
└── timestamps

Cart
├── id (PK)
├── userId (FK)
└── CartItems[]

CartItem
├── id (PK)
├── cartId (FK)
├── productId (FK)
├── quantity
└── timestamps

Order, Review, Favorite, ProductImage
(future tables)
```

---

## Key Design Decisions

| Decision                | Rationale                                     |
| ----------------------- | --------------------------------------------- |
| **JWT Authentication**  | Stateless, scalable, mobile-friendly          |
| **Prisma ORM**          | Type-safe, migrations, no-SQL injection       |
| **Zod Validation**      | Runtime validation, clear error messages      |
| **Middleware Pattern**  | Clean request processing, reusable            |
| **Repository Pattern**  | Abstraction, testable, swappable DB           |
| **Vanilla JS Frontend** | No heavy framework, Vite bundling             |
| **Multi-page HTML**     | SEO-friendly, lightweight, familiar structure |

---

## Module Dependencies

```json
{
  "express": "Web framework",
  "@prisma/client": "ORM client",
  "zod": "Schema validation",
  "jsonwebtoken": "JWT tokens",
  "bcryptjs": "Password hashing",
  "cors": "Cross-origin",
  "dotenv": "Environment vars"
}
```

---

## Deployment Considerations

- **Frontend:** Generated by Vite as static files → CDN or static server
- **Backend:** Node.js process → PM2 or Docker container
- **Database:** MySQL instance (separate server for production)
- **Rate Limiting:** TODO - Migrate from in-memory to Redis
- **Environment:** Use `.env` files for secrets (JWT_SECRET, DB_URL)

---

## Recent Fixes & Optimizations

✅ NULL slug generation fix  
✅ N+1 query optimization  
✅ XSS protection on URLs  
✅ Auth middleware on protected routes  
✅ Dynamic API URL configuration

See [CLEANUP_SUMMARY.md](./CLEANUP_SUMMARY.md) for details.

## Authentication Flow Details

1. **Registration**: `POST /api/v1/auth/register`
   - Validates email uniqueness
   - Hashes password with bcrypt (10 rounds)
   - Creates User record in MySQL
   - Returns success message

2. **Login**: `POST /api/v1/auth/login`
   - Finds user by email
   - Validates password with bcrypt
   - Generates JWT token (expires in 7 days)
   - Returns token to client

3. **Token Verification**: On protected routes
   - Middleware extracts token from `Authorization` header
   - `AuthService.verifyToken()` validates JWT signature
   - Attaches `userId`, `email`, `role` to request object
   - Proceeds to controller or rejects with 401

---

## Next Development Tasks

- [ ] Implement Order & OrderDetail endpoints
- [ ] Add Review system with rating aggregation
- [ ] Implement Favorites/Wishlist endpoints
- [ ] Add Admin dashboard routes & controllers
- [ ] Implement Payment gateway integration
- [ ] Add Email notifications service
- [ ] Setup CI/CD pipeline
- [ ] Add comprehensive API documentation (Swagger/OpenAPI)
- [ ] Performance optimization (caching, indexing)
- [ ] Implement real-time inventory updates (WebSockets)

---

**Last Updated**: April 4, 2026
**Architecture Version**: 1.0
**Status**: ✅ Development Environment Running
