import { prisma } from "../config/database";

/**
 * User Repository - Database Access Layer
 * Handles all user-related database operations
 */
export class UserRepository {
  /**
   * Find user by email
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
   * Find user by ID
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
   * Create new user
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
        role:         "CUSTOMER", // Default role for new users
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
   * Check if email exists
   */
  async emailExists(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return !!user;
  }

  /**
   * Check if email is taken by ANOTHER user (excluding self)
   * Used when updating profile email
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
   * Update email separately (requires uniqueness check first)
   */
  async updateEmail(id: number, email: string) {
    return prisma.user.update({
      where: { id },
      data:  { email: email.toLowerCase() },
      select: { id: true, email: true },
    });
  }

  /**
   * Find user by ID with passwordHash (for password verification)
   * ⚠️ Only use for password change — never expose passwordHash in API responses
   */
  async findByIdWithHash(id: number) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, passwordHash: true },
    });
  }

  /**
   * Update user profile
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
   * Change password
   */
  async changePassword(id: number, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data:  { passwordHash },
      select: { id: true, email: true },
    });
  }
}
