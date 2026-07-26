/**
 * Jest Configuration — Maverik Store Backend
 *
 * Sử dụng ts-jest để chạy test TypeScript trực tiếp.
 * KHÔNG cần build trước — ts-jest tự compile.
 *
 * Cấu trúc tests/:
 *   tests/unit/           → Unit tests (không cần DB, không cần mạng)
 *   tests/integration/    → Integration tests (Supertest, chưa triển khai)
 *   tests/helpers/        → Test utilities dùng chung
 *   tests/fixtures/       → Dữ liệu mẫu dùng chung
 *   tests/setup/          → Global setup files
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // ts-jest preset — compile TypeScript trực tiếp không cần build trước
  preset: "ts-jest",

  testEnvironment: "node",

  // ── Test discovery ────────────────────────────────────────────────
  // Tìm test files trong toàn bộ tests/ (bao gồm cả subdirectory mới)
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  // Không chạy file trong integration/ trừ khi gọi test:integration
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
  ],

  // ── TypeScript transform ──────────────────────────────────────────
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
        // Dùng CJS để tương thích Jest (không dùng ESM trong test)
        useESM: false,
        // Tắt type-checking khi chạy test để nhanh hơn
        // Type-check riêng bởi tsc --noEmit
        diagnostics: false,
      },
    ],
  },

  // ── Module resolution ─────────────────────────────────────────────
  // Handle .js extension trong TS source (ESM import → CJS test)
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  // ── Setup ─────────────────────────────────────────────────────────
  // Chạy sau khi Jest + framework khởi tạo — set env vars, timeout mặc định
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.ts"],

  // ── Mock lifecycle ────────────────────────────────────────────────
  // clearMocks: xóa mock.calls, mock.instances trước mỗi test
  clearMocks: true,
  // restoreMocks: restore jest.spyOn() về implementation gốc sau mỗi test
  restoreMocks: true,

  // ── Coverage ──────────────────────────────────────────────────────
  collectCoverageFrom: [
    "src/**/*.ts",
    // Bỏ qua các file không cần test
    "!src/server.ts",                          // Entry point, không logic
    "!src/config/database.ts",                 // Prisma client setup
    "!src/**/*.d.ts",                          // Type declarations
    "!src/prisma/**/*",                        // Generated Prisma types
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "prisma/",
    "\\.d\\.ts$",
  ],
  coverageReporters: ["text", "lcov", "html"],
  coverageDirectory: "coverage",

  // ── Timeout ───────────────────────────────────────────────────────
  testTimeout: 10000,

  // ── Output ────────────────────────────────────────────────────────
  verbose: true,
};
