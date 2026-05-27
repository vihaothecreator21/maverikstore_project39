import { Request, Response, NextFunction } from "express";
import { APIError } from "../utils/apiResponse.js";

/**
 * In-memory store for rate limiting
 * Key: IP address
 * Value: { count, resetTime }
 */
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

/**
 * Rate Limiting Middleware
 * Prevents brute force attacks on sensitive endpoints
 *
 * @param maxRequests - Maximum requests allowed per time window
 * @param windowMs - Time window in milliseconds (default: 15 minutes)
 * @returns Express middleware function
 *
 * @example
 * router.post("/login", rateLimit(5, 15 * 60 * 1000), loginController);
 */
export const rateLimit = (
  maxRequests: number = 5,
  windowMs: number = 15 * 60 * 1000,
  keyPrefix: string = "global",
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    // Initialize or get existing rate limit record
    if (!store[key]) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    // Check if time window has expired
    if (now > store[key].resetTime) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    // Increment request count
    store[key].count++;

    // Check if limit exceeded
    if (store[key].count > maxRequests) {
      const resetDate = new Date(store[key].resetTime);
      throw new APIError(
        429,
        `Too many requests from this IP. Try again after ${resetDate.toLocaleTimeString()}`,
        {
          retryAfter: resetDate.toISOString(),
          limit: maxRequests,
          window: Math.round(windowMs / 1000),
        },
        "RATE_LIMIT_EXCEEDED",
      );
    }

    // Add rate limit info to response headers
    res.set("X-RateLimit-Limit", maxRequests.toString());
    res.set(
      "X-RateLimit-Remaining",
      (maxRequests - store[key].count).toString(),
    );
    res.set("X-RateLimit-Reset", new Date(store[key].resetTime).toISOString());

    return next();
  };
};

/**
 * Cleanup old entries from store (run periodically)
 * Prevents memory leak from accumulating IP entries
 *
 * @example
 * setInterval(cleanupRateLimitStore, 60 * 60 * 1000); // Cleanup every hour
 */
export const cleanupRateLimitStore = () => {
  const now = Date.now();
  for (const key in store) {
    if (now > store[key].resetTime) {
      delete store[key];
    }
  }
};

/**
 * For production, consider using Redis for distributed rate limiting
 * This in-memory solution works for single-server deployments
 */
export default rateLimit;
