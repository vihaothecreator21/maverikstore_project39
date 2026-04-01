import { prisma } from "../config/database";

/**
 * User Repository - Database Access Layer
 * Handles all user-related database operations
 */

export class UserRepository {
  /**
   * Find user by email
   */
  static async findByEmail(email: string) {
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
  static async findById(id: number) {
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
  static async create(data: {
    username: string;
    email: string;
    passwordHash: string;
    phone: string;
    address?: string;
  }) {
    return prisma.user.create({
      data: {
        username: data.username,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        phone: data.phone,
        address: data.address || null,
        role: "CUSTOMER", // Default role for new users
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
  static async emailExists(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return !!user;
  }

  /**
   * Update user profile
   */
  static async updateProfile(
    id: number,
    data: {
      username?: string;
      phone?: string;
      address?: string;
    },
  ) {
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
  static async changePassword(id: number, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: {
        id: true,
        email: true,
      },
    });
  }
}
