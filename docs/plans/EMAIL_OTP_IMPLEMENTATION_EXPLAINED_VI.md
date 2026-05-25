# Giải thích triển khai Email OTP khi đăng ký tài khoản

Tài liệu này giải thích lại những gì đã được làm khi thêm chức năng gửi OTP qua email cho flow đăng ký tài khoản.

Mục tiêu là giúp bạn hiểu theo góc nhìn backend engineer: code theo thứ tự nào, mỗi file làm gì, luồng chạy ra sao, công nghệ nào được dùng, và cần cấu hình gì để chạy được.

## 1. Mục tiêu thay đổi

Trước đây flow đăng ký là:

```txt
User nhập form đăng ký
-> Frontend gọi /auth/register
-> Backend tạo user ngay
-> User đăng nhập
```

Sau khi thêm OTP, flow mới là:

```txt
User nhập form đăng ký
-> Backend gửi OTP qua email
-> User nhập OTP
-> Backend verify OTP
-> Backend mới tạo user thật
-> User đăng nhập
```

Lý do làm vậy:

- Chắc chắn email user nhập là email thật và user có quyền truy cập.
- Tránh người khác lấy email bất kỳ để tạo tài khoản.
- Chuẩn hơn cho ecommerce vì email còn dùng cho đơn hàng, thông báo, khôi phục tài khoản sau này.

## 2. Tech stack được dùng

Phần frontend:

- Vite.
- Vanilla JavaScript ES modules.
- Bootstrap modal hiện có.
- File chính xử lý register modal: `src/assets/js/navbar.js`.

Phần backend:

- Express + TypeScript.
- Zod để validate request body.
- Prisma ORM.
- MySQL.
- bcryptjs để hash password.
- Node `crypto` để tạo OTP và hash OTP bằng HMAC SHA256.
- Resend API để gửi email OTP.

Không thêm package mới cho Resend. Backend gọi Resend bằng `fetch`.

## 3. Thứ tự tôi code

Tôi làm theo đúng hướng `backend trước, frontend sau, verify cuối`.

### Bước 1: Đọc rules và plan

Đọc các file:

- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `docs/plans/EMAIL_OTP_REGISTRATION_PLAN.md`
- skill `karpathy-guidelines`

Mục đích:

- Giữ thay đổi đúng phạm vi OTP.
- Không đụng payment/order/auth ngoài phần đăng ký.
- Không refactor lan rộng.
- Follow flow backend hiện có: `routes -> controllers -> services -> repositories -> Prisma`.

### Bước 2: Inspect auth flow hiện tại

Các file backend đã inspect:

- `backend/src/routes/auth.routes.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/repositories/user.repository.ts`
- `backend/src/schemas/auth.schema.ts`
- `backend/src/config/env.config.ts`
- `backend/src/config/database.ts`
- `backend/src/container.ts`
- `backend/prisma/schema.prisma`

Kết luận sau khi đọc:

- Register cũ tạo user ngay trong `AuthService.register()`.
- Controller validate bằng Zod rồi gọi service.
- Route đang có `/register`, `/login`, `/logout`, `/profile`.
- Repository `UserRepository` có sẵn `emailExists()` và `create()`.
- Project dùng manual DI trong `container.ts`.

### Bước 3: Thêm bảng lưu đăng ký tạm

Đã thêm model `PendingRegistration` vào:

```txt
backend/prisma/schema.prisma
```

Model này lưu đăng ký tạm trước khi tạo user thật.

Nó lưu:

- `name`: tên user.
- `email`: email đang đăng ký.
- `phone`: số điện thoại.
- `passwordHash`: password đã hash, không lưu raw password.
- `otpHash`: OTP đã hash, không lưu OTP thật.
- `attempts`: số lần nhập OTP sai.
- `resendCount`: số lần gửi lại OTP.
- `lastSentAt`: lần gần nhất gửi OTP, dùng cho cooldown.
- `expiresAt`: thời điểm OTP hết hạn.
- `usedAt`: đã dùng OTP hay chưa.

Có migration mới:

```txt
backend/prisma/migrations/20260526002000_add_pending_registration/migration.sql
```

Migration này tạo bảng `PendingRegistration` trong MySQL.

### Bước 4: Thêm schema validate request OTP

Đã sửa:

```txt
backend/src/schemas/auth.schema.ts
```

Thêm 3 schema:

- `RegisterOtpRequestSchema`: dùng chung shape với register cũ.
- `RegisterOtpVerifySchema`: validate `email` và `otp` 6 số.
- `RegisterOtpResendSchema`: validate `email`.

Mục đích:

- Request OTP phải có đủ thông tin đăng ký.
- Verify OTP chỉ cần email + OTP.
- Resend OTP chỉ cần email.

Frontend không giữ password sau bước request OTP.

### Bước 5: Thêm env cho email và OTP

Đã sửa:

```txt
backend/src/config/env.config.ts
backend/.env.example
```

Thêm biến môi trường:

```env
RESEND_API_KEY=
EMAIL_FROM="Maverik Store <noreply@yourdomain.com>"
OTP_SECRET=
```

Ý nghĩa:

- `RESEND_API_KEY`: key để backend gọi Resend gửi email.
- `EMAIL_FROM`: địa chỉ gửi email.
- `OTP_SECRET`: secret dùng để hash OTP bằng HMAC.

`OTP_SECRET` phải khác `JWT_SECRET`, đủ dài, random.

### Bước 6: Thêm service tạo và kiểm tra OTP

File mới:

```txt
backend/src/services/otp.service.ts
```

Service này làm 3 việc:

1. Tạo OTP 6 số.
2. Hash OTP bằng HMAC SHA256.
3. Verify OTP user nhập với OTP hash đang lưu.

Vì sao không lưu OTP thật?

Nếu database bị lộ, attacker không nên thấy mã OTP thật. OTP chỉ có 6 số nên nếu hash kiểu thường như SHA256 thì vẫn dễ brute force. Vì vậy dùng HMAC với `OTP_SECRET`.

### Bước 7: Thêm service gửi email

File mới:

```txt
backend/src/services/email.service.ts
```

Service này gọi Resend API:

```txt
POST https://api.resend.com/emails
```

Nó gửi email có nội dung:

```txt
Your Maverik Store verification code is: 123456
This code will expire in 5 minutes.
```

Nếu gửi email fail, service throw lỗi `EMAIL_SEND_FAILED`.

### Bước 8: Thêm repository cho pending registration

File mới:

```txt
backend/src/repositories/pending-registration.repository.ts
```

Repository này làm data access cho bảng `PendingRegistration`.

Các hành động chính:

- Tìm pending registration theo email.
- Tạo hoặc update pending registration khi request OTP.
- Update OTP mới khi resend.
- Tăng `attempts` khi user nhập sai OTP.
- Mark `usedAt` khi OTP đã dùng.
- Xóa pending hết hạn.
- Xóa pending nếu gửi email fail.

Repository giúp `AuthService` không phải viết trực tiếp quá nhiều Prisma query.

### Bước 9: Nối dependencies trong container

Đã sửa:

```txt
backend/src/container.ts
```

Thêm instance:

- `pendingRegistrationRepository`
- `emailService`
- `otpService`

Sau đó inject vào:

```txt
AuthService
```

Project này dùng manual DI, nên mọi service/repository cần được khai báo trong `container.ts`.

### Bước 10: Sửa AuthService thành flow OTP

Đã sửa nhiều nhất ở:

```txt
backend/src/services/auth.service.ts
```

Thêm các method chính:

```txt
requestRegistrationOtp()
verifyRegistrationOtp()
resendRegistrationOtp()
```

Method cũ:

```txt
register()
```

được đổi để gọi `requestRegistrationOtp()`, nghĩa là endpoint cũ `/auth/register` không còn tạo user ngay nữa. Việc này giúp không có đường bypass OTP.

## 4. Flow backend chi tiết

### Flow 1: Request OTP

Endpoint:

```txt
POST /api/v1/auth/register/request-otp
```

Hoặc endpoint cũ:

```txt
POST /api/v1/auth/register
```

Luồng chạy:

```txt
route
-> AuthController.requestRegisterOtp/register
-> validate bằng Zod
-> AuthService.requestRegistrationOtp
-> check email đã tồn tại trong User chưa
-> xóa pending registration hết hạn
-> check cooldown 60 giây nếu email này vừa gửi OTP
-> hash password bằng bcrypt
-> generate OTP 6 số
-> hash OTP bằng HMAC SHA256
-> upsert PendingRegistration
-> gửi email qua Resend
-> nếu gửi fail: xóa pending registration
-> trả response success
```

Response thành công trả về:

```json
{
  "email": "customer@example.com",
  "expiresInSeconds": 300,
  "resendAfterSeconds": 60
}
```

### Flow 2: Verify OTP

Endpoint:

```txt
POST /api/v1/auth/register/verify-otp
```

Body:

```json
{
  "email": "customer@example.com",
  "otp": "493821"
}
```

Luồng chạy:

```txt
route
-> AuthController.verifyRegisterOtp
-> validate email + OTP
-> AuthService.verifyRegistrationOtp
-> prisma.$transaction
   -> tìm PendingRegistration theo email
   -> kiểm tra pending có tồn tại không
   -> kiểm tra OTP đã dùng chưa
   -> kiểm tra hết hạn chưa
   -> kiểm tra attempts có vượt quá 5 chưa
   -> verify OTP bằng HMAC
   -> nếu sai: tăng attempts
   -> nếu đúng: kiểm tra User có email này chưa
   -> tạo User thật
   -> mark PendingRegistration.usedAt
-> trả success
```

Điểm quan trọng: verify dùng transaction.

Lý do:

- Tránh tình huống user được tạo nhưng OTP chưa bị mark used.
- Tránh user bấm verify nhiều lần tạo trùng account.
- Giữ trạng thái nhất quán.

### Flow 3: Resend OTP

Endpoint:

```txt
POST /api/v1/auth/register/resend-otp
```

Body:

```json
{
  "email": "customer@example.com"
}
```

Luồng chạy:

```txt
route
-> AuthController.resendRegisterOtp
-> validate email
-> AuthService.resendRegistrationOtp
-> xóa pending hết hạn
-> tìm pending theo email
-> check cooldown 60 giây
-> generate OTP mới
-> hash OTP mới
-> update PendingRegistration:
   -> otpHash mới
   -> attempts = 0
   -> expiresAt = now + 5 phút
   -> lastSentAt = now
   -> resendCount += 1
   -> usedAt = null
-> gửi email mới
-> nếu gửi fail: xóa pending registration
-> trả success
```

Điểm quan trọng:

- OTP cũ mất hiệu lực ngay khi resend.
- Attempts được reset để user có cơ hội nhập OTP mới.

## 5. Flow frontend

Đã sửa:

```txt
src/assets/js/navbar.js
```

Trước đây:

```txt
submit register form
-> POST /auth/register
-> tạo account
-> mở login modal
```

Bây giờ:

```txt
submit register form
-> POST /auth/register/request-otp
-> xóa password khỏi input
-> ẩn form đăng ký
-> hiện form nhập OTP
-> user nhập OTP
-> POST /auth/register/verify-otp
-> tạo account thành công
-> mở login modal
```

Frontend cũng có nút:

```txt
Resend code
```

Nút này:

- Gọi `/auth/register/resend-otp`.
- Có cooldown 60 giây.
- Không gửi lại password.

## 6. Vì sao không lưu password ở frontend?

Plan yêu cầu không giữ password ở client sau bước request OTP.

Flow hiện tại làm đúng:

```txt
Form submit lần 1 gửi fullName/email/phone/password lên backend
Backend hash password và lưu passwordHash trong PendingRegistration
Frontend xóa password input
Lần verify chỉ gửi email + OTP
```

Như vậy password không cần nằm trên browser trong lúc user nhập OTP.

## 7. Files đã thêm mới

Backend:

- `backend/src/services/otp.service.ts`
  - Tạo OTP.
  - Hash OTP bằng HMAC.
  - Verify OTP an toàn.

- `backend/src/services/email.service.ts`
  - Gửi email OTP qua Resend API.

- `backend/src/repositories/pending-registration.repository.ts`
  - Data access cho bảng `PendingRegistration`.

- `backend/prisma/migrations/20260526002000_add_pending_registration/migration.sql`
  - Migration tạo bảng `PendingRegistration`.

Docs:

- `docs/plans/EMAIL_OTP_IMPLEMENTATION_EXPLAINED_VI.md`
  - Chính là file giải thích này.

## 8. Files đã sửa

Backend:

- `backend/prisma/schema.prisma`
  - Thêm model `PendingRegistration`.

- `backend/src/schemas/auth.schema.ts`
  - Thêm schema validate request OTP, verify OTP, resend OTP.

- `backend/src/config/env.config.ts`
  - Thêm validate env `RESEND_API_KEY`, `EMAIL_FROM`, `OTP_SECRET`.

- `backend/.env.example`
  - Thêm ví dụ env cho Resend và OTP.

- `backend/src/container.ts`
  - Inject repository/service mới vào `AuthService`.

- `backend/src/controllers/auth.controller.ts`
  - Thêm controller methods cho request OTP, verify OTP, resend OTP.
  - Tách helper validate body để tránh lặp logic Zod.

- `backend/src/routes/auth.routes.ts`
  - Thêm 3 route OTP.

- `backend/src/services/auth.service.ts`
  - Chuyển register sang OTP flow.
  - Thêm request/verify/resend OTP logic.
  - Verify OTP trong transaction.

- `backend/tsconfig.json`
  - Sửa nhỏ để backend build production không bị vướng reference test config khi thêm file mới.

Frontend:

- `src/assets/js/navbar.js`
  - Register modal gọi request OTP.
  - Hiện form nhập OTP.
  - Verify OTP.
  - Resend OTP.
  - Xóa password khỏi input sau request OTP.

## 9. API mới

### Request OTP

```txt
POST /api/v1/auth/register/request-otp
```

Tạo pending registration và gửi email OTP.

### Verify OTP

```txt
POST /api/v1/auth/register/verify-otp
```

Verify OTP và tạo user thật.

### Resend OTP

```txt
POST /api/v1/auth/register/resend-otp
```

Gửi OTP mới, làm OTP cũ mất hiệu lực.

### Endpoint cũ vẫn còn

```txt
POST /api/v1/auth/register
```

Nhưng behavior đã đổi: endpoint này cũng chỉ request OTP, không tạo user trực tiếp nữa.

## 10. Database mới hoạt động thế nào?

Khi user request OTP:

```txt
PendingRegistration có 1 record mới
```

Ví dụ:

```txt
email = customer@example.com
passwordHash = bcrypt(...)
otpHash = hmac_sha256(...)
attempts = 0
resendCount = 0
lastSentAt = hiện tại
expiresAt = hiện tại + 5 phút
usedAt = null
```

Khi user verify đúng:

```txt
User được tạo trong bảng User
PendingRegistration.usedAt được set
```

Khi user nhập sai:

```txt
attempts tăng lên 1
```

Khi user resend:

```txt
otpHash đổi sang OTP mới
attempts reset về 0
expiresAt được kéo dài thêm 5 phút
lastSentAt đổi sang hiện tại
resendCount tăng thêm 1
```

## 11. Bảo mật đã thêm

- Không lưu OTP thật trong DB.
- Không log OTP ra console.
- OTP hết hạn sau 5 phút.
- Resend có cooldown 60 giây.
- Sai OTP quá 5 lần thì bị chặn.
- Verify OTP dùng transaction.
- Resend làm OTP cũ mất hiệu lực.
- Nếu gửi email fail thì xóa pending registration để user không bị kẹt.
- Password được hash trước khi lưu vào pending registration.

## 12. Cần cấu hình gì để chạy?

Trong `backend/.env`, cần có:

```env
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM="Maverik Store <noreply@yourdomain.com>"
OTP_SECRET=change-this-to-a-random-secret-at-least-32-characters
```

Nếu thiếu các biến này, backend sẽ fail-fast khi startup vì `env.config.ts` validate env.

## 13. Các lệnh đã chạy để verify

Generate Prisma Client:

```bash
npm run prisma:generate
```

Apply migration:

```bash
npx prisma migrate deploy
```

Build backend:

```bash
npm run build
```

Build frontend:

```bash
npm run build
```

Kết quả:

- Prisma generate: pass.
- Migration apply: pass.
- Backend build: pass.
- Frontend build: pass.

Frontend build vẫn có warning cũ về admin vendor scripts như `chart.umd.min.js`, `papaparse.min.js`, `xlsx.full.min.js`. Warning này có từ trước và không liên quan OTP.

## 14. Cách tự test thủ công

1. Set env Resend + OTP trong `backend/.env`.
2. Chạy backend.
3. Chạy frontend.
4. Mở website.
5. Click `Sign in`.
6. Chọn `Create one`.
7. Nhập thông tin đăng ký bằng email thật.
8. Submit.
9. Kiểm tra inbox email.
10. Nhập OTP.
11. Nếu đúng, account được tạo và modal login mở ra.
12. Login bằng email/password vừa đăng ký.

Các case nên test:

- OTP đúng.
- OTP sai.
- OTP hết hạn sau 5 phút.
- Resend OTP.
- Dùng OTP cũ sau khi resend.
- Bấm verify nhiều lần.
- Email đã tồn tại.
- Tắt Resend API key để xem email fail handling.

## 15. Tổng kết ngắn

Chức năng OTP mới biến đăng ký thành 2 bước:

```txt
Bước 1: Xin mã OTP qua email
Bước 2: Nhập OTP để tạo account thật
```

Backend là nơi quan trọng nhất:

- Tạo OTP.
- Hash OTP.
- Lưu pending registration.
- Gửi email.
- Verify OTP bằng transaction.
- Tạo user thật.

Frontend chỉ điều khiển UI:

- Gửi request OTP.
- Hiện form nhập OTP.
- Gửi OTP để verify.
- Cho resend OTP.

Thiết kế này giữ đúng kiến trúc project hiện tại và không biến hệ thống thành microservice hay framework mới.

