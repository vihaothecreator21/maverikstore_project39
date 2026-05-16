# AGENTS.md

## Project summary
Maverik Store là project ecommerce fullstack cho thời trang/quần áo.

- Frontend: Vite, Bootstrap, Sass, static HTML trong `src`.
- Backend: Express + TypeScript trong `backend/src`.
- Database: Prisma schema tại `backend/prisma/schema.prisma`.
- Integrations quan trọng: Supabase, VNPAY, JWT/auth, Google Generative AI.

## Important folders
- `src`: frontend pages/assets/styles.
- `src/admin`: admin dashboard pages.
- `src/assets`: frontend assets.
- `backend/src`: backend API source code.
- `backend/src/controllers`: HTTP controllers.
- `backend/src/routes`: API routes.
- `backend/src/services`: business logic.
- `backend/src/repositories`: data access layer.
- `backend/src/middlewares`: Express middlewares.
- `backend/src/schemas`: validation schemas.
- `backend/src/config`: backend configuration.
- `backend/src/gateways`: external/payment gateway integrations.
- `backend/src/jobs`: background jobs.
- `backend/prisma/schema.prisma`: database schema.
- `backend/prisma/migrations`: Prisma migrations.
- `backend/prisma/seed.ts`: seed data.
- `backend/tests`: backend tests.
- `backend/scripts`: backend utility/migration scripts.

## Do not read unless needed
- `node_modules`
- `backend/node_modules`
- `.next`
- `dist`
- `backend/dist`
- `build`
- `coverage`
- `logs`
- `public/uploads`
- `backend/prisma/migrations`

## Rules for Codex
- Không scan toàn bộ repo nếu task chỉ liên quan 1 module.
- Trước khi sửa code, hãy xác định file liên quan.
- Chỉ mở file cần thiết.
- Sau khi sửa, tóm tắt file đã sửa và lý do.
- Không refactor lan rộng nếu user không yêu cầu.
- Không đổi database schema nếu chưa hỏi.
- Không chạm payment/auth nếu task không liên quan.
- Với frontend, ưu tiên kiểm tra file HTML/SCSS/assets trong `src`.
- Với backend, ưu tiên luồng `routes -> controllers -> services -> repositories`.
- Với Prisma, schema nằm ở `backend/prisma/schema.prisma`, không phải root `prisma/schema.prisma`.
