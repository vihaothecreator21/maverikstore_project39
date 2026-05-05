import bcrypt from "bcryptjs";
import { UserRepository } from "../repositories/user.repository";
import { APIError, ValidationError } from "../utils/apiResponse";
import { getEnv } from "../config/env.config";

/**
 * User Service — Business Logic for user profile management
 * Controller calls this, this calls UserRepository.
 */
export class UserService {
  private userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  async getProfile(userId: number) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new APIError(404, "Người dùng không tồn tại", {}, "USER_NOT_FOUND");
    }
    return user;
  }

  async updateProfile(
    userId: number,
    data: {
      fullName?: string;
      email?: string;
      phone?: string;
      address?: string | null | undefined;
    },
  ) {
    if (data.email) {
      const taken = await this.userRepository.isEmailTaken(data.email, userId);
      if (taken) {
        throw new APIError(
          409,
          "Email này đã được sử dụng bởi tài khoản khác",
          { email: "Email đã tồn tại" },
          "EMAIL_ALREADY_EXISTS",
        );
      }
    }

    const updateData: Record<string, string | null | undefined> = {};
    if (data.fullName !== undefined)
      updateData.username = data.fullName.toLowerCase().replace(/\s+/g, "_");
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;

    await this.userRepository.updateProfile(userId, updateData);

    if (data.email !== undefined) {
      await this.userRepository.updateEmail(userId, data.email);
    }

    return this.userRepository.findById(userId);
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    if (!currentPassword || !newPassword) {
      throw new ValidationError("Vui lòng nhập đầy đủ thông tin", {
        currentPassword: !currentPassword ? ["Mật khẩu hiện tại là bắt buộc"] : [],
        newPassword: !newPassword ? ["Mật khẩu mới là bắt buộc"] : [],
      });
    }

    if (newPassword.length < 8) {
      throw new ValidationError("Mật khẩu không đủ mạnh", {
        newPassword: ["Mật khẩu phải có ít nhất 8 ký tự"],
      });
    }

    if (
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      throw new ValidationError("Mật khẩu không đủ mạnh", {
        newPassword: ["Mật khẩu phải có chữ hoa, chữ thường và số"],
      });
    }

    const userWithHash = await this.userRepository.findByIdWithHash(userId);
    if (!userWithHash) {
      throw new APIError(404, "Người dùng không tồn tại", {}, "USER_NOT_FOUND");
    }

    const isValid = await bcrypt.compare(currentPassword, userWithHash.passwordHash);
    if (!isValid) {
      throw new APIError(
        401,
        "Mật khẩu hiện tại không chính xác",
        { currentPassword: "Mật khẩu không đúng" },
        "INVALID_PASSWORD",
      );
    }

    const env = getEnv();
    const newHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    await this.userRepository.changePassword(userId, newHash);
  }
}
