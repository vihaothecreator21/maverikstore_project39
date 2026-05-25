import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { catchAsync } from "../utils/catchAsync.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import rateLimit from "../middlewares/rateLimit.middleware.js";

/**
 * Auth Routes
 * POST /api/v1/auth/register - Request register OTP (rate limited)
 * POST /api/v1/auth/register/request-otp - Request register OTP (rate limited)
 * POST /api/v1/auth/register/verify-otp - Verify OTP and create user
 * POST /api/v1/auth/register/resend-otp - Resend register OTP (rate limited)
 * POST /api/v1/auth/login - Login user (rate limited)
 * GET /api/v1/auth/profile - Get user profile (protected)
 * POST /api/v1/auth/logout - Logout user
 */

export const authRoutes = Router();

// Rate limiting: 5 attempts per 15 minutes for login
const loginRateLimit = rateLimit(5, 15 * 60 * 1000);

// Rate limiting: 3 attempts per hour for registration
const registerRateLimit = rateLimit(3, 60 * 60 * 1000);

// Public Routes
authRoutes.post(
  "/register",
  registerRateLimit,
  catchAsync(AuthController.register),
);
authRoutes.post(
  "/register/request-otp",
  registerRateLimit,
  catchAsync(AuthController.requestRegisterOtp),
);
authRoutes.post(
  "/register/verify-otp",
  registerRateLimit,
  catchAsync(AuthController.verifyRegisterOtp),
);
authRoutes.post(
  "/register/resend-otp",
  registerRateLimit,
  catchAsync(AuthController.resendRegisterOtp),
);
authRoutes.post("/login", loginRateLimit, catchAsync(AuthController.login));
authRoutes.post("/logout", catchAsync(AuthController.logout));

// Protected Routes (requires valid JWT token)
authRoutes.get(
  "/profile",
  authMiddleware,
  catchAsync(AuthController.getProfile),
);
