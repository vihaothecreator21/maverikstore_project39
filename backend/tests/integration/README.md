# Integration Tests

Thư mục này chứa Supertest integration tests chạy trên cùng Express app với production (`backend/src/app.ts`), nhưng mock repository/service bên ngoài khi phù hợp để không gọi database production hoặc API thật.

## Test hiện có

- `auth-product.api.test.ts`: đăng ký, đăng nhập, profile JWT, phân quyền customer/admin cho product API, product list/detail.
- `cart-order.api.test.ts`: cart authenticated API, add cart item, lỗi thiếu stock, tạo order, chặn customer xem order không thuộc mình.

## Cách chạy

Từ `backend/`:

```bash
npm run test:unit
npm run test:integration
npm test
```

`npm test` chạy cả unit và integration test.

## Database test

Các integration test hiện tại mock data-access/service nên không cần kết nối MySQL thật. CI vẫn cấu hình MySQL test riêng và chạy `npx prisma migrate deploy` để xác minh migration có thể deploy trước khi test/build/smoke.

Không dùng production database cho test. Khi thêm integration test cần DB thật, cấu hình `DATABASE_URL` trỏ tới database test riêng, ví dụ:

```env
DATABASE_URL=mysql://root:test_password@127.0.0.1:3306/maverikstore_test
NODE_ENV=test
JWT_SECRET=test-jwt-secret-with-sufficient-length
```

## CI

GitHub Actions chạy:

```bash
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run lint
npm run test:unit
npm run test:integration
npm run build
```

Sau build, CI start backend từ `dist/src/server.js` bằng `npm start` và gọi `GET /api/health`.
