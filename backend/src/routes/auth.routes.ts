import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { catchAsync } from "../utils/catchAsync";

/**
 * Auth Routes
 * POST /api/v1/auth/register - Register new user
 * POST /api/v1/auth/login - Login user
 * GET /api/v1/auth/profile - Get user profile (protected)
 * POST /api/v1/auth/logout - Logout user
 */

export const authRoutes = Router();

// Public Routes
authRoutes.post("/register", catchAsync(AuthController.register));
authRoutes.post("/login", catchAsync(AuthController.login));
authRoutes.post("/logout", catchAsync(AuthController.logout));

// Protected Routes (TODO: Add authMiddleware)
authRoutes.get("/profile", catchAsync(AuthController.getProfile));
