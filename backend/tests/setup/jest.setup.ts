/**
 * Jest Global Setup — Maverik Store Backend
 *
 * File này chạy MỘT LẦN trước toàn bộ test suite (setupFilesAfterFramework).
 *
 * Mục đích:
 * 1. Đặt NODE_ENV=test để ngăn server.ts gọi initializeEnv() production
 * 2. Set các env vars tối thiểu cần thiết để import src/ không crash
 * 3. Cấu hình timeout mặc định
 *
 * ⚠️ Không kết nối database thật ở đây.
 *    Database chỉ được dùng trong integration tests với test DB riêng.
 */

// ── NODE_ENV ─────────────────────────────────────────────────────────
// Phải đặt trước bất kỳ import nào từ src/
process.env["NODE_ENV"] = "test";

// ── Env vars tối thiểu để env.config.ts không crash khi import ───────
// Dùng giá trị fake — không có giá trị nào được dùng để kết nối production
if (!process.env["DATABASE_URL"]) {
  process.env["DATABASE_URL"] = "mysql://test:test@localhost:3306/test_db";
}
if (!process.env["JWT_SECRET"]) {
  process.env["JWT_SECRET"] = "test-jwt-secret-at-least-32-characters-long";
}
if (!process.env["JWT_EXPIRE"]) {
  process.env["JWT_EXPIRE"] = "7d";
}
if (!process.env["BCRYPT_ROUNDS"]) {
  process.env["BCRYPT_ROUNDS"] = "6"; // Tối thiểu để test nhanh
}
if (!process.env["RESEND_API_KEY"]) {
  process.env["RESEND_API_KEY"] = "re_test_fake_key_do_not_use";
}
if (!process.env["EMAIL_FROM"]) {
  process.env["EMAIL_FROM"] = "test@example.com";
}
if (!process.env["OTP_SECRET"]) {
  process.env["OTP_SECRET"] = "test-otp-secret-at-least-32-characters-long!!";
}
if (!process.env["CORS_ORIGINS"]) {
  process.env["CORS_ORIGINS"] = "http://localhost:3000";
}
if (!process.env["GEMINI_API_KEY"]) {
  process.env["GEMINI_API_KEY"] = "test-gemini-key";
}
if (!process.env["VNPAY_TMN_CODE"]) {
  process.env["VNPAY_TMN_CODE"] = "TESTCODE";
}
if (!process.env["VNPAY_HASH_SECRET"]) {
  process.env["VNPAY_HASH_SECRET"] = "test-vnpay-hash-secret-16chars";
}
if (!process.env["VNPAY_RETURN_URL"]) {
  process.env["VNPAY_RETURN_URL"] = "http://localhost:5000/api/v1/payments/vnpay/return";
}
if (!process.env["VNPAY_FRONTEND_RETURN"]) {
  process.env["VNPAY_FRONTEND_RETURN"] = "http://localhost:3000/vnpay-return.html";
}

// ── Jest global timeout ───────────────────────────────────────────────
// Unit tests: 10s là đủ; integration tests có thể override per-file
jest.setTimeout(10_000);
