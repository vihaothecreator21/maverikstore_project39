import { z } from "zod";

/**
 * Environment Variables Schema Validation
 * Uses Zod to validate and parse environment variables at application startup
 *
 * Ensures:
 * - All required variables are present
 * - Variables have correct types and formats
 * - Invalid configs fail fast at boot time (not during runtime)
 *
 * @throws {Error} If any environment variable is invalid
 */
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().min(1).max(65535).default(5000),
  API_VERSION: z.string().default("v1"),

  // Database Configuration
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid MySQL connection URL")
    .startsWith("mysql://", "DATABASE_URL must start with mysql://"),

  // JWT Configuration
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .describe("Secret key for JWT signing"),
  JWT_EXPIRE: z
    .string()
    .regex(/^\d+[dhms]$/, "JWT_EXPIRE must be in format like 7d, 24h, 3600s")
    .default("7d"),

  // Bcrypt Configuration
  BCRYPT_ROUNDS: z.coerce
    .number()
    .int()
    .min(6, "BCRYPT_ROUNDS must be at least 6")
    .max(12, "BCRYPT_ROUNDS should not exceed 12 (too slow)")
    .default(10),

  // Email OTP Registration
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  OTP_SECRET: z
    .string()
    .min(32, "OTP_SECRET must be at least 32 characters")
    .describe("Secret key for OTP HMAC hashing"),

  // CORS Configuration
  // Production: set CORS_ORIGINS=https://yourdomain.com (comma-separated, NO wildcard)
  // Development fallback only - will warn in production
  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(",").map((url) => url.trim()).filter(Boolean))
    .refine(
      (urls) => urls.length > 0,
      "CORS_ORIGINS must contain at least one origin",
    )
    .refine(
      (urls) => {
        // Block wildcard in production
        if (process.env.NODE_ENV === "production") {
          return !urls.includes("*");
        }
        return true;
      },
      "Wildcard '*' is NOT allowed in production CORS_ORIGINS",
    ),

  // Logging Configuration
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("debug"),

  // Gemini AI Chatbot
  // Optional so the server can start in dev when chatbot is not configured.
  // Missing key is handled by support chat service at request time.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),

  // VNPay Configuration
  // SECURITY: NEVER hardcode real secrets here. Always set via .env file.
  // These will throw at startup in production if missing.
  VNPAY_TMN_CODE: z.string().optional(),
  VNPAY_HASH_SECRET: z.string().optional(),
  VNPAY_RETURN_URL: z
    .string()
    .url()
    .default("http://localhost:5000/api/v1/payments/vnpay/return"),
  VNPAY_FRONTEND_RETURN: z
    .string()
    .url()
    .default("http://localhost:3000/vnpay-return.html"),
  VNPAY_IPN_URL: z
    .string()
    .default("http://localhost:5000/api/v1/payments/vnpay/ipn"),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== "production") return;

  const requiredInProduction: Array<keyof typeof env> = [
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "GEMINI_API_KEY",
    "VNPAY_TMN_CODE",
    "VNPAY_HASH_SECRET",
  ];

  requiredInProduction.forEach((key) => {
    if (!env[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required in production`,
      });
    }
  });

  if (env.VNPAY_HASH_SECRET && env.VNPAY_HASH_SECRET.length < 16) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["VNPAY_HASH_SECRET"],
      message: "VNPAY_HASH_SECRET must be at least 16 chars in production",
    });
  }
});

/**
 * Parsed and validated environment variables
 * Safe to use throughout the application
 */
export type Environment = z.infer<typeof envSchema>;

let env: Environment;

/**
 * Initialize and validate environment variables
 * Call this function at application startup (in server.ts)
 *
 * @throws {ZodError} If validation fails
 * @returns {Environment} Validated environment variables
 *
 * @example
 * // In server.ts
 * const env = initializeEnv();
 * console.log(env.DATABASE_URL); // Safe to use
 */
export const initializeEnv = (): Environment => {
  try {
    env = envSchema.parse(process.env);

    console.log("Environment variables validated successfully");

    // Log non-sensitive config in development
    if (env.NODE_ENV === "development") {
      console.log("Environment Config:", {
        NODE_ENV: env.NODE_ENV,
        PORT: env.PORT,
        API_VERSION: env.API_VERSION,
        DATABASE: env.DATABASE_URL.split("@")[1] || "configured", // Hide credentials
        JWT_EXPIRE: env.JWT_EXPIRE,
        BCRYPT_ROUNDS: env.BCRYPT_ROUNDS,
        CORS_ORIGINS: env.CORS_ORIGINS.join(", "),
        LOG_LEVEL: env.LOG_LEVEL,
        EMAIL_FROM: env.EMAIL_FROM,
      });
    }

    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Environment variable validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${String(err.path)}: ${err.message}`);
      });

      // List all missing/invalid variables
      const missingVars = error.errors
        .map((e) => e.path.join("."))
        .join(", ");
      console.error(`\nMissing or invalid: ${missingVars}`);
      console.error("\nServer cannot start with invalid configuration");
    }

    process.exit(1);
  }
};

/**
 * Get validated environment variables
 * Safe to use after initializeEnv() has been called
 *
 * @throws {Error} If called before initializeEnv()
 * @returns {Environment} Validated environment variables
 *
 * @example
 * const env = getEnv();
 * const dbUrl = env.DATABASE_URL;
 */
export const getEnv = (): Environment => {
  if (!env) {
    throw new Error(
      "Environment not initialized. Call initializeEnv() first in server startup."
    );
  }
  return env;
};

/**
 * Set environment for testing purposes
 * Use only in test files
 *
 * @internal
 */
export const __setEnvForTesting = (testEnv: Partial<Environment>): void => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("__setEnvForTesting can only be used in test mode");
  }
  env = { ...envSchema.parse(process.env), ...testEnv };
};

export default {
  initializeEnv,
  getEnv,
  envSchema,
};
