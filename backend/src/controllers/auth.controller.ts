import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { LoginSchema, RegisterSchema } from "../schemas/auth.schema";
import {
  ValidationError,
  sendSuccess,
  HTTP_STATUS,
} from "../utils/apiResponse";

/**
 * Auth Controller - HTTP Request Handlers
 * Handles user registration, login, and authentication
 */

export class AuthController {
  /**
   * POST /api/v1/auth/register
   * Register a new user
   */
  static async register(req: Request, res: Response) {
    // Validate request body
    const validation = RegisterSchema.safeParse(req.body);
    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(err.message);
      });

      throw new ValidationError("Validation failed", errors);
    }

    // Register user
    const result = await AuthService.register(validation.data);

    return sendSuccess(
      res,
      result,
      "Account created successfully. Please log in.",
      HTTP_STATUS.CREATED,
    );
  }

  /**
   * POST /api/v1/auth/login
   * Login user with email and password
   */
  static async login(req: Request, res: Response) {
    // Validate request body
    const validation = LoginSchema.safeParse(req.body);
    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(err.message);
      });

      throw new ValidationError("Validation failed", errors);
    }

    // Login user
    const result = await AuthService.login(validation.data);

    return sendSuccess(res, result, "Login successful", HTTP_STATUS.OK);
  }

  /**
   * GET /api/v1/auth/profile
   * Get current user profile (requires authentication)
   */
  static async getProfile(req: Request, res: Response) {
    // Get userId from request (set by auth middleware)
    const userId = (req as any).userId;

    if (!userId) {
      throw new Error("Unauthorized");
    }

    const user = await AuthService.getProfile(userId);

    return sendSuccess(
      res,
      user,
      "User profile retrieved successfully",
      HTTP_STATUS.OK,
    );
  }

  /**
   * POST /api/v1/auth/logout
   * Logout user (client-side token removal)
   */
  static async logout(_req: Request, res: Response) {
    return sendSuccess(
      res,
      null,
      "Logout successful. Please remove the token from localStorage.",
      HTTP_STATUS.OK,
    );
  }
}
