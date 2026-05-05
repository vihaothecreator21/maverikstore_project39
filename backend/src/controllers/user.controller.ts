import { Request, Response } from "express";
import { userService } from "../container";
import { sendSuccess, ValidationError, HTTP_STATUS } from "../utils/apiResponse";
import { UpdateProfileSchema } from "../schemas/auth.schema";

/**
 * User Controller - Handles customer profile management
 * GET  /api/v1/users/profile  → getProfile
 * PUT  /api/v1/users/profile  → updateProfile
 * PUT  /api/v1/users/password → changePassword
 *
 * ⚠️ All business logic đã chuyển vào UserService
 */
export class UserController {
  /**
   * GET /api/v1/users/profile
   */
  static async getProfile(req: Request, res: Response) {
    const userId = req.userId!;
    const user = await userService.getProfile(userId);
    return sendSuccess(res, user, "Lấy thông tin tài khoản thành công", HTTP_STATUS.OK);
  }

  /**
   * PUT /api/v1/users/profile
   */
  static async updateProfile(req: Request, res: Response) {
    const userId = req.userId!;

    const validation = UpdateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      throw new ValidationError("Dữ liệu không hợp lệ", errors);
    }

    const freshUser = await userService.updateProfile(userId, validation.data);
    return sendSuccess(res, freshUser, "Cập nhật thông tin thành công", HTTP_STATUS.OK);
  }

  /**
   * PUT /api/v1/users/password
   */
  static async changePassword(req: Request, res: Response) {
    const userId = req.userId!;
    const { currentPassword, newPassword } = req.body;

    await userService.changePassword(userId, currentPassword, newPassword);

    return sendSuccess(res, null, "Đổi mật khẩu thành công", HTTP_STATUS.OK);
  }
}
