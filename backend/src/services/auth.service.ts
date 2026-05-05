import jwt, { type SignOptions, type JwtPayload } from "jsonwebtoken";
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
  private userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Generate JWT Token
   */
  generateToken(userId: number, email: string, role: string): string {
    const env = getEnv();
    return jwt.sign(
      { userId, email, role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRE } as SignOptions,
    );
  }

  /**
   * Verify JWT Token
   */
  verifyToken(token: string): { userId: number; email: string; role: string } | null {
    try {
      const env = getEnv();
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & {
        userId: number;
        email: string;
        role: string;
      };
      return {
        userId: decoded.userId,
        email:  decoded.email,
        role:   decoded.role,
      };
    } catch {
      return null;
    }
  }

  /**
   * Register new user
   */
  async register(input: RegisterInput) {
    const emailExists = await this.userRepository.emailExists(input.email);
    if (emailExists) {
      throw new APIError(
        409,
        "Email already registered",
        { email: "This email is already in use" },
        "EMAIL_ALREADY_EXISTS",
      );
    }

    const env = getEnv();
    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

    const user = await this.userRepository.create({
      username:     input.fullName.toLowerCase().replace(/\s+/g, "_"),
      email:        input.email,
      passwordHash,
      phone:        input.phone,
    });

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      token,
      user: {
        id:       user.id,
        username: user.username,
        email:    user.email,
        phone:    user.phone,
        role:     user.role,
      },
    };
  }

  /**
   * Login user
   */
  async login(input: LoginInput) {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      throw new APIError(401, "Invalid email or password", {}, "INVALID_CREDENTIALS");
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new APIError(401, "Invalid email or password", {}, "INVALID_CREDENTIALS");
    }

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      token,
      user: {
        id:       user.id,
        username: user.username,
        email:    user.email,
        phone:    user.phone,
        role:     user.role,
      },
    };
  }

  /**
   * Get user profile
   */
  async getProfile(userId: number) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new APIError(404, "User not found", {}, "USER_NOT_FOUND");
    }
    return user;
  }
}
