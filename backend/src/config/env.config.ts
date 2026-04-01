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

  // CORS Configuration
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:5173")
    .transform((val) => val.split(",").map((url) => url.trim()))
    .refine((urls) => urls.length > 0, "At least one CORS origin must be defined"),

  // Logging Configuration
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("debug"),
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

    console.log("✓ Environment variables validated successfully");

    // Log non-sensitive config in development
    if (env.NODE_ENV === "development") {
      console.log("📋 Environment Config:", {
        NODE_ENV: env.NODE_ENV,
        PORT: env.PORT,
        API_VERSION: env.API_VERSION,
        DATABASE: env.DATABASE_URL.split("@")[1] || "configured", // Hide credentials
        JWT_EXPIRE: env.JWT_EXPIRE,
        BCRYPT_ROUNDS: env.BCRYPT_ROUNDS,
        CORS_ORIGINS: env.CORS_ORIGINS.join(", "),
        LOG_LEVEL: env.LOG_LEVEL,
      });
    }

    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${String(err.path)}: ${err.message}`);
      });

      // List all missing/invalid variables
      const missingVars = error.errors
        .map((e) => e.path.join("."))
        .join(", ");
      console.error(`\nMissing or invalid: ${missingVars}`);
      console.error("\n⚠️ Server cannot start with invalid configuration");
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
