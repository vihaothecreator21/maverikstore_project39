import { prisma } from "../config/database.js";

/**
 * User Repository - Tầng truy cập cơ sở dữ liệu
 * Xử lý toàn bộ thao tác DB liên quan đến người dùng
 */
export class UserRepository {
  /**
   * Tìm user theo email
   */
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        phone: true,
        role: true,
        address: true,
        createdAt: true,
      },
    });
  }

  /**
   * Tìm user theo ID
   */
  async findById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        address: true,
        createdAt: true,
      },
    });
  }

  /**
   * Tạo user mới
   */
  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
    phone: string;
    address?: string;
  }) {
    return prisma.user.create({
      data: {
        username:     data.username,
        email:        data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        phone:        data.phone,
        address:      data.address || null,
        role:         "CUSTOMER", // Role mặc định cho user mới
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        address: true,
        createdAt: true,
      },
    });
  }

  /**
   * Kiểm tra email đã tồn tại chưa
   */
  async emailExists(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return !!user;
  }

  /**
   * Kiểm tra email đã được dùng bởi user KHÁC (trừ chính mình)
   * Dùng khi cập nhật email trong profile
   */
  async isEmailTaken(email: string, excludeId: number): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    if (!user) return false;
    return user.id !== excludeId;
  }

  /**
   * Cập nhật email riêng (yêu cầu kiểm tra tính duy nhất trước)
   */
  async updateEmail(id: number, email: string) {
    return prisma.user.update({
      where: { id },
      data:  { email: email.toLowerCase() },
      select: { id: true, email: true },
    });
  }

  /**
   * Tìm user theo ID kèm passwordHash (dùng để xác minh mật khẩu)
   * ⚠️ Chỉ dùng khi đổi mật khẩu — không bao giờ lộ passwordHash trong API response
   */
  async findByIdWithHash(id: number) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, passwordHash: true },
    });
  }

  /**
   * Cập nhật hồ sơ người dùng
   */
  async updateProfile(id: number, data: Record<string, string | null | undefined>) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        address: true,
        createdAt: true,
      },
    });
  }

  /**
   * Đổi mật khẩu
   */
  async changePassword(id: number, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data:  { passwordHash },
      select: { id: true, email: true },
    });
  }
}
