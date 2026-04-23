import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { UserRepository } from "../repositories/user.repository";
import { AuthService } from "../services/auth.service";
import { APIError, ValidationError, sendSuccess, HTTP_STATUS } from "../utils/apiResponse";
import { UpdateProfileSchema } from "../schemas/auth.schema";
import { getEnv } from "../config/env.config";

/**
 * User Controller - Handles customer profile management
 * GET  /api/v1/users/profile  → getProfile
 * PUT  /api/v1/users/profile  → updateProfile
 * PUT  /api/v1/users/password → changePassword
 */
export class UserController {
  /**
   * GET /api/v1/users/profile
   * Get current authenticated user's full profile
   */
  static async getProfile(req: Request, res: Response) {
    const userId = (req as any).userId;
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new APIError(404, "Người dùng không tồn tại", {}, "USER_NOT_FOUND");
    }
    return sendSuccess(res, user, "Lấy thông tin tài khoản thành công", HTTP_STATUS.OK);
  }

  /**
   * PUT /api/v1/users/profile
   * Update current user's profile info (name, email, phone, address)
   */
  static async updateProfile(req: Request, res: Response) {
    const userId = (req as any).userId;

    // Validate request body
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

    const { fullName, email, phone, address } = validation.data;

    // If email is changing, check uniqueness
    if (email) {
      const taken = await UserRepository.isEmailTaken(email, userId);
      if (taken) {
        throw new APIError(
          409,
          "Email này đã được sử dụng bởi tài khoản khác",
          { email: "Email đã tồn tại" },
          "EMAIL_ALREADY_EXISTS",
        );
      }
    }

    // Build update data — only include defined fields
    const updateData: Record<string, string | null | undefined> = {};
    if (fullName !== undefined) updateData.username = fullName.toLowerCase().replace(/\s+/g, "_");
    if (phone   !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;

    // Update profile fields
    const updated = await UserRepository.updateProfile(userId, updateData);

    // If email is changing, update separately (needs uniqueness guard)
    if (email !== undefined) {
      await UserRepository.updateEmail(userId, email);
    }

    // Fetch fresh data to return complete profile
    const freshUser = await UserRepository.findById(userId);
    return sendSuccess(res, freshUser, "Cập nhật thông tin thành công", HTTP_STATUS.OK);
  }

  /**
   * PUT /api/v1/users/password
   * Change password — requires current password verification
   */
  static async changePassword(req: Request, res: Response) {
    const userId = (req as any).userId;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      throw new ValidationError("Vui lòng nhập đầy đủ thông tin", {
        currentPassword: !currentPassword ? ["Mật khẩu hiện tại là bắt buộc"] : [],
        newPassword:     !newPassword     ? ["Mật khẩu mới là bắt buộc"] : [],
      });
    }

    if (newPassword.length < 8) {
      throw new ValidationError("Mật khẩu không đủ mạnh", {
        newPassword: ["Mật khẩu phải có ít nhất 8 ký tự"],
      });
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      throw new ValidationError("Mật khẩu không đủ mạnh", {
        newPassword: ["Mật khẩu phải có chữ hoa, chữ thường và số"],
      });
    }

    // Fetch user with passwordHash for verification
    const userWithEmail = await UserRepository.findByIdWithHash(userId);
    if (!userWithEmail) {
      throw new APIError(404, "Người dùng không tồn tại", {}, "USER_NOT_FOUND");
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, userWithEmail.passwordHash);
    if (!isValid) {
      throw new APIError(
        401,
        "Mật khẩu hiện tại không chính xác",
        { currentPassword: "Mật khẩu không đúng" },
        "INVALID_PASSWORD",
      );
    }

    // Hash + save new password
    const env = getEnv();
    const newHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    await UserRepository.changePassword(userId, newHash);

    return sendSuccess(res, null, "Đổi mật khẩu thành công", HTTP_STATUS.OK);
  }
}
