/**
 * Jest Configuration — Maverik Store Backend
 *
 * Sử dụng ts-jest để chạy test TypeScript trực tiếp.
 * KHÔNG cần build trước — ts-jest tự compile.
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // ts-jest preset
  preset: "ts-jest",

  testEnvironment: "node",

  // Tìm test files ở thư mục tests/
  roots: ["<rootDir>/tests"],

  // Pattern: *.test.ts hoặc *.spec.ts
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],

  // ts-jest transform
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        // Disable ESM in test environment — simpler for Jest
        useESM: false,
      },
    ],
  },

  // Handle .js extension imports in TS source
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  // Timeout per test (ms)
  testTimeout: 10000,

  verbose: true,
};
