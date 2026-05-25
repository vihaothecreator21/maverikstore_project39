# Plan: Email OTP Verification For Registration

## Goal
Add email OTP verification before a customer account becomes usable.

Current idea:

```txt
Register form -> request OTP -> send email -> user enters OTP -> backend verifies -> create account
```

This keeps the current login/auth flow mostly unchanged and only adds a verification step before account creation.

## Recommended Email Provider
Use Resend for product-style implementation.

Why Resend:
- Simple Node.js API.
- Easier than raw SMTP for production.
- Works well for transactional email such as OTP.
- Can later use a verified domain like `noreply@maverikstore.com`.

Development fallback:
- Gmail SMTP with Nodemailer can be used for local/demo only.
- Do not use Gmail SMTP as the long-term production provider.

## High-Level Flow
1. Customer opens register form.
2. Customer submits name, email, password.
3. Frontend calls `POST /api/v1/auth/register/request-otp`.
4. Backend validates input.
5. Backend checks if email already exists.
6. Backend generates a 6-digit OTP.
7. Backend hashes OTP before storing it with HMAC or bcrypt.
8. Backend stores a pending registration record with expiry time.
9. Backend sends OTP email through Resend.
   - If sending fails, delete the pending registration and return a clear error.
10. Frontend shows OTP input screen.
11. Customer enters OTP.
12. Frontend calls `POST /api/v1/auth/register/verify-otp`.
13. Backend verifies OTP inside a Prisma transaction.
14. Inside the same transaction, backend creates user account.
15. Inside the same transaction, backend marks pending registration as used or deletes it.
16. Frontend shows success and redirects customer to login.

## Critical Consistency Rule
Verify OTP must be atomic.

Do not run this as separate independent operations:

```txt
verify OTP -> create user -> mark OTP used
```

Use a database transaction instead:

```ts
await prisma.$transaction(async (tx) => {
  // 1. find pending registration
  // 2. check OTP, expiry, usedAt, attempts
  // 3. create user
  // 4. mark pending registration used or delete it
});
```

Why:
- Avoid creating a user while OTP remains reusable.
- Avoid double account creation if user clicks verify multiple times.
- Keep account creation and OTP consumption consistent.

## Backend API Design

### Request OTP
```http
POST /api/v1/auth/register/request-otp
Content-Type: application/json
```

Body:

```json
{
  "name": "Customer Name",
  "email": "customer@example.com",
  "password": "StrongPassword123!"
}
```

Response:

```json
{
  "status": "success",
  "message": "Verification code sent to your email.",
  "data": {
    "email": "customer@example.com",
    "expiresInSeconds": 300,
    "resendAfterSeconds": 60
  }
}
```

### Verify OTP
```http
POST /api/v1/auth/register/verify-otp
Content-Type: application/json
```

Body:

```json
{
  "email": "customer@example.com",
  "otp": "493821"
}
```

Response:

```json
{
  "status": "success",
  "message": "Account created successfully."
}
```

### Resend OTP
```http
POST /api/v1/auth/register/resend-otp
Content-Type: application/json
```

Body:

```json
{
  "email": "customer@example.com"
}
```

Response:

```json
{
  "status": "success",
  "message": "A new verification code has been sent.",
  "data": {
    "expiresInSeconds": 300,
    "resendAfterSeconds": 60
  }
}
```

## Data Model Proposal
Database schema change requires confirmation before implementation.

Recommended new model:

```prisma
model PendingRegistration {
  id           Int       @id @default(autoincrement())
  name         String
  email        String    @unique
  passwordHash String
  otpHash      String
  attempts     Int       @default(0)
  resendCount  Int       @default(0)
  lastSentAt   DateTime?
  expiresAt    DateTime
  usedAt       DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

Notes:
- Store hashed password, not raw password.
- Store hashed OTP, not raw OTP.
- Do not use `updatedAt` for resend cooldown because it can change for reasons unrelated to email sending.
- Use `lastSentAt` for resend cooldown.
- Use `resendCount` for abuse control and debugging.
- Use `email @unique` so one email has one active pending registration.
- On resend, replace old OTP hash and extend expiry.

## OTP Hashing
Do not use plain SHA256 like this:

```txt
sha256(otp)
```

OTP is only 6 digits, so plain hashes are easy to brute force if the database leaks.

Preferred options:
- `HMAC_SHA256(otp, OTP_SECRET)`: good for OTP because it is deterministic and fast to verify.
- `bcrypt.hash(otp)`: also acceptable, slower, already common in auth systems.

Recommended for this project:

```txt
otpHash = HMAC_SHA256(otp, OTP_SECRET)
```

Add env:

```env
OTP_SECRET=
```

The secret must be long, random, and different from `JWT_SECRET`.

## Resend OTP Rules
When user requests another OTP:

```txt
resend OTP -> generate new OTP -> replace old otpHash -> reset attempts -> extend expiry
```

Required resend update:

```txt
otpHash = hash(newOtp)
attempts = 0
expiresAt = now + 5 minutes
lastSentAt = now
resendCount += 1
usedAt = null
```

Why reset `attempts`:
- If user mistypes several times, then requests a new OTP, the new OTP should start with a clean attempt counter.

The old OTP must become invalid immediately after resend.

## Email Send Failure Handling
Email provider can fail.

Simple first-version rule:

```txt
create/upsert pending registration -> send email -> if send fails, delete pending registration and return error
```

Why:
- Prevent user from getting stuck with a pending registration but no OTP email.
- Easier for student/demo project than retry queues.

Later production improvement:
- Keep pending record.
- Add retry metadata.
- Let user request OTP again after cooldown.

## Expired Pending Cleanup
Pending registrations can accumulate when users request OTP and never verify.

Minimum cleanup:
- Before creating a new pending registration, delete expired pending registrations.
- When requesting OTP for the same email, replace the old pending registration if it is expired.

Future cleanup:
- Add cron/job to delete expired pending registrations periodically.

## Backend Files Likely Needed
Inspect these before implementation:

- `backend/src/routes/auth.routes.ts`: find current auth route style and add OTP endpoints.
- `backend/src/controllers/auth.controller.ts`: add request/verify/resend handlers.
- `backend/src/services/auth.service.ts`: connect OTP flow with existing registration logic.
- `backend/src/repositories/user.repository.ts`: reuse existing user creation/email lookup logic.
- `backend/src/schemas/auth.schema.ts`: add Zod schemas for OTP request/verify.
- `backend/src/config/env.config.ts`: add email provider env validation.
- `backend/prisma/schema.prisma`: add pending registration model only after confirmation.

Possible new files:

- `backend/src/services/email.service.ts`: send transactional email through Resend.
- `backend/src/services/otp.service.ts`: generate, hash, verify, and expire OTP.
- `backend/src/repositories/pending-registration.repository.ts`: data access for pending registrations.

## Frontend Files Likely Needed
Inspect these before implementation:

- `src/register.html`: if standalone register page is active.
- `src/products.html`: contains register modal in current storefront pages.
- `src/assets/js/auth-utils.js`: check existing auth helper behavior.
- Any page-specific JS handling register form submission.

Frontend behavior:
- Submit register form -> call request OTP endpoint.
- Hide/register form section -> show OTP input.
- Add resend button with 60-second cooldown.
- Show clear error messages for invalid or expired OTP.
- On success, redirect to login or open login modal.

## Security Rules
- OTP length: 6 digits.
- OTP expiry: 5 minutes.
- Resend cooldown: 60 seconds.
- Max verify attempts: 5.
- OTP can be used only once.
- OTP hash must use HMAC with `OTP_SECRET` or bcrypt.
- Never log OTP in production.
- Never store raw OTP.
- Resend must invalidate the old OTP.
- Verify must create user and consume pending registration in one transaction.
- Request OTP should clean up expired pending registrations.
- If sending email fails, delete pending registration or otherwise let user retry safely.
- Do not expose whether an email exists in overly detailed public errors if avoiding email enumeration is required.
- Add rate limiting to request/resend endpoints.

## Environment Variables
For Resend:

```env
RESEND_API_KEY=
EMAIL_FROM="Maverik Store <noreply@yourdomain.com>"
OTP_SECRET=
```

Optional app URL:

```env
APP_URL=http://localhost:5173
```

## Email Template
Subject:

```txt
Your Maverik Store verification code
```

Body:

```html
<p>Hello,</p>
<p>Your Maverik Store verification code is:</p>
<h2>493821</h2>
<p>This code will expire in 5 minutes.</p>
<p>If you did not request this code, you can ignore this email.</p>
```

## Implementation Steps
1. Confirm provider: Resend or Gmail SMTP.
2. Confirm DB schema change for `PendingRegistration`.
3. Add env config for email provider.
4. Add email sending service.
5. Add OTP utility/service with HMAC or bcrypt hashing.
6. Add pending registration repository.
7. Add expired pending cleanup on request OTP.
8. Add request OTP endpoint with email send failure handling.
9. Add verify OTP endpoint using Prisma transaction.
10. Add resend OTP endpoint that invalidates old OTP and resets attempts.
11. Update frontend register flow.
12. Add focused backend tests if auth tests already exist.
13. Run backend build.
14. Run frontend build.
15. Manually test full flow with a real email inbox.

## Verification Checklist
- New email can request OTP.
- OTP email arrives.
- Correct OTP creates account.
- Wrong OTP fails.
- Expired OTP fails.
- Used OTP cannot be reused.
- Too many wrong attempts blocks verification.
- Resend creates a new valid OTP.
- Old OTP fails after resend.
- Resend resets attempts.
- Verify called twice does not create duplicate users.
- Email send failure does not leave user stuck.
- Expired pending registrations can be cleaned up.
- Existing email cannot register again.
- Backend build passes.
- Frontend build passes.

## Out Of Scope For First Version
- Password reset OTP.
- Login OTP / passwordless login.
- SMS OTP.
- Multi-factor authentication for existing users.
- Admin email template builder.
- Queue/background email worker.
