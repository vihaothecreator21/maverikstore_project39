import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getEnv } from "../config/env.config";
import { UserRepository } from "../repositories/user.repository";
import { APIError } from "../utils/apiResponse";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema";

/**
 * Auth Service - Business Logic Layer
 * Handles user authentication, registration, and JWT operations
 */

export class AuthService {
  /**
   * Generate JWT Token
   */
  static generateToken(userId: number, email: string, role: string): string {
    const env = getEnv();

    const token = jwt.sign(
      {
        userId,
        email,
        role,
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRE,
      } as any,
    );

    return token;
  }

  /**
   * Verify JWT Token
   */
  static verifyToken(
    token: string,
  ): { userId: number; email: string; role: string } | null {
    try {
      const env = getEnv();
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch {
      return null;
    }
  }

  /**
   * Register new user
   */
  static async register(input: RegisterInput) {
    // Check if email already exists
    const emailExists = await UserRepository.emailExists(input.email);
    if (emailExists) {
      throw new APIError(
        409,
        "Email already registered",
        { email: "This email is already in use" },
        "EMAIL_ALREADY_EXISTS",
      );
    }

    // Hash password
    const env = getEnv();
    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

    // Create user
    const user = await UserRepository.create({
      username: input.fullName.toLowerCase().replace(/\s+/g, "_"),
      email: input.email,
      passwordHash,
      phone: input.phone,
    });

    // Generate token
    const token = this.generateToken(user.id, user.email, user.role);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  /**
   * Login user
   */
  static async login(input: LoginInput) {
    // Find user by email
    const user = await UserRepository.findByEmail(input.email);
    if (!user) {
      throw new APIError(
        401,
        "Invalid email or password",
        {},
        "INVALID_CREDENTIALS",
      );
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new APIError(
        401,
        "Invalid email or password",
        {},
        "INVALID_CREDENTIALS",
      );
    }

    // Generate token
    const token = this.generateToken(user.id, user.email, user.role);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  /**
   * Get user profile
   */
  static async getProfile(userId: number) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new APIError(404, "User not found", {}, "USER_NOT_FOUND");
    }
    return user;
  }
}
