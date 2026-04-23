import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

// Import Config & Validation
import { initializeEnv } from "./config/env.config";
import { connectDatabase, disconnectDatabase } from "./config/database";

// Import Middlewares
import errorHandler from "./middlewares/errorHandler.middleware";
import notFoundHandler from "./middlewares/notFound.middleware";
import { cleanupRateLimitStore } from "./middlewares/rateLimit.middleware.js";
// Import Routes
import apiRoutes from "./routes";
// Import Jobs
import { startOrderTimeoutJob } from "./jobs/orderTimeout.job";

// ==================== Configuration ====================

// Load environment variables from .env file
dotenv.config();

// Validate all environment variables at startup (FAIL FAST)
const env = initializeEnv();

// ==================== Initialize Express App ====================

const app: Express = express();

// ==================== Global Middleware ====================

// CORS Configuration - Using validated origins from environment
const corsOptions = {
  origin: env.CORS_ORIGINS,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Body Parser Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Request Logging Middleware (Development only)
if (env.NODE_ENV === "development") {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ==================== Route Mounting ====================

// Mount API routes
app.use("/api", apiRoutes);

// ==================== Error Handling ====================

// 404 Not Found Handler (must be before error handler)
app.use(notFoundHandler);

// Global Error Handler (must be last)
app.use(errorHandler);

// ==================== Server Startup ====================

/**
 * Start the Express server
 * Initializes database connection and listens on configured port
 */
const startServer = async (): Promise<void> => {
  try {
    // Connect to database (with validated DATABASE_URL)
    await connectDatabase();

    // Start Express server (with validated PORT)
    app.listen(env.PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║    MAVERIK STORE API - ${env.NODE_ENV.toUpperCase().padEnd(23)} ║
╠════════════════════════════════════════╣
║ Server running on port: ${String(env.PORT).padEnd(19)} ║
║ Environment: ${env.NODE_ENV.toUpperCase().padEnd(25)} ║
║ API Version: ${env.API_VERSION}                        ║
║ CORS Origins: ${env.CORS_ORIGINS.length} allowed         ║
╚════════════════════════════════════════╝
      `);

      // Setup rate limit cleanup scheduler (runs every 1 hour)
      setInterval(() => {
        cleanupRateLimitStore();
        console.log("🧹 [Rate Limit] Cleaned up expired entries");
      }, 60 * 60 * 1000);

      // ✅ Start Order Timeout Job (UC-05: hủy đơn PENDING > 15 phút)
      startOrderTimeoutJob();
    });
  } catch (error) {
    console.error("✗ Failed to start server:", error);
    await disconnectDatabase();
    process.exit(1);
  }
};

// ==================== Graceful Shutdown ====================

/**
 * Handle graceful shutdown
 * Disconnects database and closes server properly
 */
process.on("SIGINT", async () => {
  console.log("\n\nShutting down server gracefully...");
  await disconnectDatabase();
  process.exit(0);
});

/**
 * Handle uncaught exceptions
 * These should never happen but we catch them for safety
 */
process.on("uncaughtException", (error) => {
  console.error("🔥 Uncaught Exception:", error);
  console.error("Server shutting down due to uncaught exception");
  process.exit(1);
});

/**
 * Handle unhandled promise rejections
 * Catches promises that reject without a catch handler
 */
process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 Unhandled Rejection at:", promise);
  console.error("Reason:", reason);
  console.error("Server shutting down due to unhandled rejection");
  process.exit(1);
});

// Start the server
startServer();

export default app;
