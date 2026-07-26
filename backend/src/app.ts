import express, { Express, NextFunction, Request, Response } from "express";
import cors from "cors";
import { initializeEnv } from "./config/env.config.js";
import errorHandler from "./middlewares/errorHandler.middleware.js";
import notFoundHandler from "./middlewares/notFound.middleware.js";
import requestIdMiddleware from "./middlewares/requestId.middleware.js";
import { sanitizeInput } from "./middlewares/sanitize.middleware.js";
import apiRoutes from "./routes/index.js";

export const createApp = (): Express => {
  const env = initializeEnv();
  const app: Express = express();
  const allowedOrigins = env.CORS_ORIGINS;

  if (
    env.NODE_ENV === "production" &&
    allowedOrigins.some((origin) => origin.includes("localhost"))
  ) {
    console.warn("[CORS] localhost is configured in production CORS_ORIGINS");
  }

  app.use(
    cors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`CORS: origin '${origin}' not allowed`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use(requestIdMiddleware);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.use(sanitizeInput);

  if (env.NODE_ENV === "development") {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  app.use("/api", apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();

export default app;
