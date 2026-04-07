# 🛒 Maverik Store - E-Commerce Platform

Fullstack e-commerce platform for Streetwear fashion with modern architecture (Vite + Express + Prisma + MySQL).

**Repo:** Group 39 | **Updated:** April 2026

---

## 📖 Quick Navigation

Start here based on your needs:

| Need                       | Document                                                     |
| -------------------------- | ------------------------------------------------------------ |
| **5-min overview**         | [QUICK_START.md](./QUICK_START.md)                           |
| **System architecture**    | [ARCHITECTURE_GRAPH.md](./ARCHITECTURE_GRAPH.md)             |
| **Codebase health**        | [CODEBASE_ANALYSIS_REPORT.md](./CODEBASE_ANALYSIS_REPORT.md) |
| **Recent changes**         | [CLEANUP_SUMMARY.md](./CLEANUP_SUMMARY.md)                   |
| **Implementation details** | [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)     |

---

## ⚡ Quick Start

### Setup Backend

```bash
cd backend
npm install
npm run prisma:migrate
npm run dev  # Port 5000
```

### Setup Frontend

```bash
npm install
npm run dev  # Port 5173
```

---

## 🎯 Project Status

✅ **Core Features Complete:**

- Product catalog with filtering & pagination
- User authentication (JWT)
- Shopping cart (client-side)
- Admin management

⚠️ **TODO Features:**

- Order processing
- Payment integration
- User/admin dashboard
- Product reviews

---

## 📊 Tech Stack

- **Frontend:** Vite, Vanilla JS, Bootstrap 5, SCSS
- **Backend:** Express.js, TypeScript, Prisma ORM
- **Database:** MySQL
- **Auth:** JWT + bcryptjs

---

## 🔒 Security Status

✅ Protected routes with JWT  
✅ Input validation (Zod schemas)  
✅ XSS protection  
⚠️ Rate limiting (in-memory, needs Redis for production)

---

## 📝 Notes

- All 41 source files organized & clean
- Zero unused dependencies
- Production-ready with noted exceptions
- See [CODEBASE_ANALYSIS_REPORT.md](./CODEBASE_ANALYSIS_REPORT.md) for full audit

**Last Updated:** April 4, 2026
