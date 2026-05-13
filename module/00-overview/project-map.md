# Project Map

## Mục Đích

Maverik Store là hệ thống e-commerce fullstack cho nội thất/home products. Project gồm storefront cho khách hàng, giỏ hàng, checkout, VNPay, profile/order history và admin dashboard cho sản phẩm, danh mục, đơn hàng, doanh thu, export.

## Stack Chính

| Layer | Công nghệ |
| --- | --- |
| Frontend | Vite, Vanilla JS modules, Bootstrap 5, SCSS, Swiper |
| Backend | Express, TypeScript, Prisma |
| Database | MySQL |
| Auth | JWT, bcryptjs, RBAC |
| Validation | Zod |
| Reporting | Chart.js, SheetJS, PapaParse, jsPDF assets |

## Folder Quan Trọng

| Path | Vai trò |
| --- | --- |
| `src/` | Frontend multi-page app |
| `src/assets/js/` | Storefront logic: products, cart, checkout, profile, homepage |
| `src/admin/` | Admin pages |
| `src/admin/assets/js/` | Admin guard, dashboard, products, categories, orders, revenue |
| `backend/src/routes/` | API route declarations |
| `backend/src/controllers/` | HTTP handlers |
| `backend/src/services/` | Business logic |
| `backend/src/repositories/` | Prisma access layer |
| `backend/src/schemas/` | Zod schemas |
| `backend/prisma/` | Database schema and seed |
| `module/` | Technical module documentation |

## Module Ownership

| Module | Main files |
| --- | --- |
| Auth/Profile | `auth.*`, `user.*`, `auth.middleware.ts`, `login.js`, `register.js`, `profile.js` |
| Products/Categories | `product.*`, `category.*`, `products.js`, `product-detail.js`, admin product/category JS |
| Cart/Checkout | `cart.*`, `order.*`, `cart.js`, `cart-page.js`, `checkout.js` |
| Payment | `payment.*`, `vnpay.*`, `vnpay-return.html`, payment result pages |
| Admin Reporting | `admin.*`, `dashboard.service.ts`, `adminReport.service.ts`, admin dashboard/revenue JS |

## Current Source Of Truth

- Code is more current than old documents under `99-archive/`.
- `AI_CONTEXT.md` at project root is the high-level AI context.
- For implementation details, read the relevant module doc in `02-features/` and then inspect the code files listed there.
