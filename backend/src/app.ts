import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";

// Import Config & Validation
import { initializeEnv } from "./config/env.config";
import { connectDatabase, disconnectDatabase } from "./config/database";

// Import Middlewares
import errorHandler from "./middlewares/errorHandler.middleware";
import notFoundHandler from "./middlewares/notFound.middleware";
import requestIdMiddleware from "./middlewares/requestId.middleware";
import { sanitizeInput } from "./middlewares/sanitize.middleware";

// Import Routes
import apiRoutes from "./routes";

// ==================== Configuration ====================

// Validate all environment variables at startup (FAIL FAST)
const env = initializeEnv();

// ==================== Initialize Express App ====================

const app: Express = express();

// ==================== Global Middleware ====================

// CORS — Production-safe: origins loaded from env, no wildcard allowed in prod
const allowedOrigins = env.CORS_ORIGINS;

if (env.NODE_ENV === "production" && allowedOrigins.some((o) => o.includes("localhost"))) {
  console.warn("⚠️  [CORS] localhost is in allowed origins — is this intentional in production?");
}

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow non-browser requests (curl, Postman, server-to-server like VNPay IPN)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(requestIdMiddleware);

// Body Parser Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Input Sanitization — strip XSS vectors from all request inputs
// Must be AFTER body parsers, BEFORE route handlers
app.use(sanitizeInput);

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

export default app;
