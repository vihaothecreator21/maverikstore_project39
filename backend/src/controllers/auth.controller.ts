import { Request, Response } from "express";
import { authService } from "../container";
import {
  LoginSchema,
  RegisterSchema,
  RegisterOtpRequestSchema,
  RegisterOtpVerifySchema,
  RegisterOtpResendSchema,
} from "../schemas/auth.schema";
import {
  ValidationError,
  sendSuccess,
  HTTP_STATUS,
} from "../utils/apiResponse";
import { z } from "zod";

/**
 * Auth Controller - Tầng xử lý HTTP Request
 * Xử lý đăng ký, đăng nhập và xác thực người dùng
 */

export class AuthController {
  private static validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
    const validation = schema.safeParse(body);
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

    return validation.data;
  }

  /**
   * POST /api/v1/auth/register
   * Yêu cầu gửi OTP xác thực để đăng ký tài khoản mới
   */
  static async register(req: Request, res: Response) {
    const input = AuthController.validateBody(RegisterSchema, req.body);
    const result = await authService.register(input);

    return sendSuccess(
      res,
      result,
      "Verification code sent to your email.",
      HTTP_STATUS.ACCEPTED,
    );
  }

  static async requestRegisterOtp(req: Request, res: Response) {
    const input = AuthController.validateBody(RegisterOtpRequestSchema, req.body);
    const result = await authService.requestRegistrationOtp(input);

    return sendSuccess(
      res,
      result,
      "Verification code sent to your email.",
      HTTP_STATUS.ACCEPTED,
    );
  }

  static async verifyRegisterOtp(req: Request, res: Response) {
    const input = AuthController.validateBody(RegisterOtpVerifySchema, req.body);
    const result = await authService.verifyRegistrationOtp(input);

    return sendSuccess(
      res,
      result,
      "Account created successfully.",
      HTTP_STATUS.CREATED,
    );
  }

  static async resendRegisterOtp(req: Request, res: Response) {
    const input = AuthController.validateBody(RegisterOtpResendSchema, req.body);
    const result = await authService.resendRegistrationOtp(input);

    return sendSuccess(
      res,
      result,
      "A new verification code has been sent.",
      HTTP_STATUS.OK,
    );
  }

  /**
   * POST /api/v1/auth/login
   * Đăng nhập bằng email và mật khẩu
   */
  static async login(req: Request, res: Response) {
    const input = AuthController.validateBody(LoginSchema, req.body);
    const result = await authService.login(input);

    return sendSuccess(res, result, "Login successful", HTTP_STATUS.OK);
  }

  /**
   * GET /api/v1/auth/profile
   * Lấy thông tin profile người dùng hiện tại (cần xác thực)
   */
  static async getProfile(req: Request, res: Response) {
    // Lấy userId từ request (được gán bởi auth middleware)
    const userId = req.userId;

    if (!userId) {
      throw new Error("Unauthorized");
    }

    const user = await authService.getProfile(userId);

    return sendSuccess(
      res,
      user,
      "User profile retrieved successfully",
      HTTP_STATUS.OK,
    );
  }

  /**
   * POST /api/v1/auth/logout
   * Đăng xuất người dùng (xóa token phía client)
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
