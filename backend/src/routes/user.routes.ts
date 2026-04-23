import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { catchAsync } from "../utils/catchAsync";
import { authMiddleware } from "../middlewares/auth.middleware";

/**
 * User Routes — /api/v1/users
 *
 * All routes require authentication (authMiddleware)
 *
 * GET  /api/v1/users/profile  → Get current user profile
 * PUT  /api/v1/users/profile  → Update profile (name, email, phone, address)
 * PUT  /api/v1/users/password → Change password
 */
export const userRoutes = Router();

// All user routes require login
userRoutes.use(authMiddleware);

userRoutes.get("/profile",  catchAsync(UserController.getProfile));
userRoutes.put("/profile",  catchAsync(UserController.updateProfile));
userRoutes.put("/password", catchAsync(UserController.changePassword));
