import jwt, { type SignOptions, type JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getEnv } from "../config/env.config";
import { prisma } from "../config/database";
import { UserRepository } from "../repositories/user.repository";
import { PendingRegistrationRepository } from "../repositories/pending-registration.repository";
import { EmailService } from "./email.service";
import { OtpService } from "./otp.service";
import { APIError } from "../utils/apiResponse";
import type {
  RegisterInput,
  LoginInput,
  RegisterOtpRequestInput,
  RegisterOtpVerifyInput,
  RegisterOtpResendInput,
} from "../schemas/auth.schema";

const OTP_EXPIRES_IN_MS = 5 * 60 * 1000;
const OTP_EXPIRES_IN_SECONDS = 300;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

/**
 * Auth Service - Business Logic Layer
 * Handles user authentication, registration, and JWT operations
 */
export class AuthService {
  private userRepository: UserRepository;
  private pendingRegistrationRepository: PendingRegistrationRepository;
  private emailService: EmailService;
  private otpService: OtpService;

  constructor(
    userRepository: UserRepository,
    pendingRegistrationRepository: PendingRegistrationRepository,
    emailService: EmailService,
    otpService: OtpService,
  ) {
    this.userRepository = userRepository;
    this.pendingRegistrationRepository = pendingRegistrationRepository;
    this.emailService = emailService;
    this.otpService = otpService;
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
    return this.requestRegistrationOtp(input);
  }

  async requestRegistrationOtp(input: RegisterOtpRequestInput) {
    const emailExists = await this.userRepository.emailExists(input.email);
    if (emailExists) {
      throw new APIError(
        409,
        "Email already registered",
        { email: "This email is already in use" },
        "EMAIL_ALREADY_EXISTS",
      );
    }

    const now = new Date();
    await this.pendingRegistrationRepository.deleteExpired(now);

    const existing = await this.pendingRegistrationRepository.findByEmail(input.email);
    this.assertResendCooldown(existing?.lastSentAt ?? null, now);

    const env = getEnv();
    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
    const otp = this.otpService.generateOtp();
    const otpHash = this.otpService.hashOtp(otp);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRES_IN_MS);

    await this.pendingRegistrationRepository.upsertForRequest({
      name: input.fullName,
      email: input.email,
      passwordHash,
      phone: input.phone,
      otpHash,
      expiresAt,
      lastSentAt: now,
    });

    try {
      await this.emailService.sendRegistrationOtp(input.email, otp, 5);
    } catch (error) {
      await this.pendingRegistrationRepository.deleteByEmail(input.email);
      throw error;
    }

    return {
      email: input.email,
      expiresInSeconds: OTP_EXPIRES_IN_SECONDS,
      resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  async verifyRegistrationOtp(input: RegisterOtpVerifyInput) {
    const email = input.email.toLowerCase();
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const pending = await tx.pendingRegistration.findUnique({
        where: { email },
      });

      if (!pending || pending.usedAt) {
        throw new APIError(400, "Invalid or expired verification code", {}, "OTP_INVALID");
      }

      if (pending.expiresAt < now) {
        await tx.pendingRegistration.delete({ where: { id: pending.id } });
        throw new APIError(400, "Verification code has expired", {}, "OTP_EXPIRED");
      }

      if (pending.attempts >= OTP_MAX_ATTEMPTS) {
        throw new APIError(429, "Too many invalid OTP attempts", {}, "OTP_ATTEMPTS_EXCEEDED");
      }

      const isValidOtp = this.otpService.verifyOtp(input.otp, pending.otpHash);
      if (!isValidOtp) {
        await this.pendingRegistrationRepository.incrementAttempts(pending.id, tx);
        throw new APIError(400, "Invalid verification code", {}, "OTP_INVALID");
      }

      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existingUser) {
        await this.pendingRegistrationRepository.markUsed(pending.id, tx);
        throw new APIError(
          409,
          "Email already registered",
          { email: "This email is already in use" },
          "EMAIL_ALREADY_EXISTS",
        );
      }

      const user = await tx.user.create({
        data: {
          username: pending.name.toLowerCase().replace(/\s+/g, "_"),
          email,
          passwordHash: pending.passwordHash,
          phone: pending.phone,
          role: "CUSTOMER",
        },
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      await this.pendingRegistrationRepository.markUsed(pending.id, tx);

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      };
    });
  }

  async resendRegistrationOtp(input: RegisterOtpResendInput) {
    const email = input.email.toLowerCase();
    const now = new Date();
    await this.pendingRegistrationRepository.deleteExpired(now);

    const pending = await this.pendingRegistrationRepository.findByEmail(email);
    if (!pending || pending.usedAt) {
      throw new APIError(404, "Pending registration not found", {}, "PENDING_REGISTRATION_NOT_FOUND");
    }

    this.assertResendCooldown(pending.lastSentAt, now);

    const otp = this.otpService.generateOtp();
    const otpHash = this.otpService.hashOtp(otp);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRES_IN_MS);

    await this.pendingRegistrationRepository.updateForResend(email, {
      otpHash,
      expiresAt,
      lastSentAt: now,
    });

    try {
      await this.emailService.sendRegistrationOtp(email, otp, 5);
    } catch (error) {
      await this.pendingRegistrationRepository.deleteByEmail(email);
      throw error;
    }

    return {
      email,
      expiresInSeconds: OTP_EXPIRES_IN_SECONDS,
      resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
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

  private assertResendCooldown(lastSentAt: Date | null, now: Date) {
    if (!lastSentAt) return;

    const elapsedMs = now.getTime() - lastSentAt.getTime();
    if (elapsedMs >= OTP_RESEND_COOLDOWN_MS) return;

    const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
    throw new APIError(
      429,
      `Please wait ${retryAfterSeconds} seconds before requesting another code`,
      { retryAfterSeconds },
      "OTP_RESEND_COOLDOWN",
    );
  }
}
