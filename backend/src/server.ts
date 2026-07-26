import { Server } from "node:http";
import "dotenv/config";
import { app } from "./app.js";
import { getEnv } from "./config/env.config.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { cleanupRateLimitStore } from "./middlewares/rateLimit.middleware.js";
import { startOrderTimeoutJob } from "./jobs/orderTimeout.job.js";

let server: Server | undefined;
let rateLimitCleanupTimer: NodeJS.Timeout | undefined;
let orderTimeoutTimer: NodeJS.Timeout | undefined;
let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`Received ${signal}. Shutting down server gracefully...`);

  if (rateLimitCleanupTimer) clearInterval(rateLimitCleanupTimer);
  if (orderTimeoutTimer) clearInterval(orderTimeoutTimer);

  await new Promise<void>((resolve) => {
    if (!server) {
      resolve();
      return;
    }

    server.close(() => resolve());
  });

  await disconnectDatabase();
  process.exit(0);
};

const startServer = async (): Promise<void> => {
  try {
    const env = getEnv();

    await connectDatabase();

    server = app.listen(env.PORT, "0.0.0.0", () => {
      console.log(`Maverik Store API running on port ${env.PORT}`);
    });

    rateLimitCleanupTimer = setInterval(cleanupRateLimitStore, 60 * 60 * 1000);
    orderTimeoutTimer = startOrderTimeoutJob();
  } catch (error) {
    console.error("Failed to start server:", error);
    await disconnectDatabase();
    process.exit(1);
  }
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  void shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  void shutdown("unhandledRejection");
});

void startServer();
