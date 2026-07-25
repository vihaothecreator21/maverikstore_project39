import jwt, { type SignOptions, type JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
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

// Hằng số thời gian OTP — tập trung để dễ thay đổi
const OTP_EXPIRES_IN_MS = 5 * 60 * 1000;       // OTP hết hạn sau 5 phút
const OTP_EXPIRES_IN_SECONDS = 300;             // Gửi về client (unit: seconds)
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;       // Phải đợi 60 giây mới gửi lại
const OTP_RESEND_COOLDOWN_SECONDS = 60;         // Gửi về client
const OTP_MAX_ATTEMPTS = 5;                     // Tối đa 5 lần nhập sai OTP

/**
 * Auth Service — Xử lý đăng ký, đăng nhập, OTP xác thực
 *
 * Luồng đăng ký 2 bước (Email OTP):
 * 1. requestRegistrationOtp() → tạo PendingRegistration + gửi OTP qua email
 * 2. verifyRegistrationOtp()  → xác minh OTP → tạo User thật trong transaction
 *
 * Tại sao dùng PendingRegistration thay vì tạo User thẳng?
 * → Tránh tạo tài khoản với email chưa được xác minh
 * → Nếu người dùng bỏ giữa chừng, entry sẽ tự hết hạn sau 5 phút
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
   * Tạo JWT token cho user sau khi đăng nhập thành công
   * Payload chứa userId, email, role — dùng để xác thực các request sau
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
   * Giải mã và xác minh JWT token
   * Trả về null nếu token không hợp lệ hoặc đã hết hạn
   */
  verifyToken(token: string): { userId: number; email: string; role: string } | null {
    try {
      const env = getEnv();
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & {
        userId: number;
        email: string;
        role: string;
      };
      return { userId: decoded.userId, email: decoded.email, role: decoded.role };
    } catch {
      return null; // Token hết hạn hoặc sai chữ ký
    }
  }

  /** Alias của requestRegistrationOtp — dùng bởi route POST /auth/register */
  async register(input: RegisterInput) {
    return this.requestRegistrationOtp(input);
  }

  /**
   * Bước 1 đăng ký: Gửi OTP xác thực email
   *
   * Quy trình:
   * 1. Kiểm tra email chưa được đăng ký
   * 2. Xóa các PendingRegistration đã hết hạn
   * 3. Kiểm tra cooldown (phải đợi 60s mới gửi lại)
   * 4. Hash mật khẩu + tạo OTP → lưu vào bảng PendingRegistration
   * 5. Gửi email OTP → nếu thất bại thì xóa PendingRegistration vừa tạo
   */
  async requestRegistrationOtp(input: RegisterOtpRequestInput) {
    // Kiểm tra email chưa được đăng ký trong bảng User
    const emailExists = await this.userRepository.emailExists(input.email);
    if (emailExists) {
      throw new APIError(409, "Email already registered", { email: "This email is already in use" }, "EMAIL_ALREADY_EXISTS");
    }

    const now = new Date();
    // Dọn dẹp các pending registration hết hạn để tránh tích tụ dữ liệu rác
    await this.pendingRegistrationRepository.deleteExpired(now);

    const existing = await this.pendingRegistrationRepository.findByEmail(input.email);
    // Kiểm tra cooldown: người dùng phải đợi 60s trước khi gửi OTP mới
    this.assertResendCooldown(existing?.lastSentAt ?? null, now);

    const env = getEnv();
    // Hash mật khẩu trước — lưu hash vào PendingRegistration
    // Khi xác thực OTP xong, hash này sẽ được copy sang bảng User
    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
    const otp = this.otpService.generateOtp();           // Sinh mã OTP 6 số
    const otpHash = this.otpService.hashOtp(otp);        // Hash OTP trước khi lưu DB
    const expiresAt = new Date(now.getTime() + OTP_EXPIRES_IN_MS);

    // Upsert: nếu email đã có PendingRegistration cũ → cập nhật; nếu chưa → tạo mới
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
      // Gửi OTP qua email (dịch vụ Resend)
      await this.emailService.sendRegistrationOtp(input.email, otp, 5);
    } catch (error) {
      // Nếu gửi email thất bại → xóa PendingRegistration để user có thể thử lại
      await this.pendingRegistrationRepository.deleteByEmail(input.email);
      throw error;
    }

    return {
      email: input.email,
      expiresInSeconds: OTP_EXPIRES_IN_SECONDS,
      resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  /**
   * Bước 2 đăng ký: Xác minh OTP và tạo tài khoản
   *
   * Chạy trong Prisma Transaction để đảm bảo atomic:
   * - Nếu bước nào thất bại → toàn bộ rollback, không tạo User lửng
   */
  async verifyRegistrationOtp(input: RegisterOtpVerifyInput) {
    const email = input.email.toLowerCase();
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      // Lấy PendingRegistration theo email
      const pending = await tx.pendingRegistration.findUnique({ where: { email } });

      // Kiểm tra tồn tại và chưa được sử dụng (usedAt = null)
      if (!pending || pending.usedAt) {
        throw new APIError(400, "Invalid or expired verification code", {}, "OTP_INVALID");
      }

      // Kiểm tra OTP còn trong hạn không
      if (pending.expiresAt < now) {
        await tx.pendingRegistration.delete({ where: { id: pending.id } });
        throw new APIError(400, "Verification code has expired", {}, "OTP_EXPIRED");
      }

      // Giới hạn số lần nhập sai OTP → chống brute-force OTP
      if (pending.attempts >= OTP_MAX_ATTEMPTS) {
        throw new APIError(429, "Too many invalid OTP attempts", {}, "OTP_ATTEMPTS_EXCEEDED");
      }

      // Xác minh OTP (so sánh hash)
      const isValidOtp = this.otpService.verifyOtp(input.otp, pending.otpHash);
      if (!isValidOtp) {
        // Tăng số lần nhập sai
        await this.pendingRegistrationRepository.incrementAttempts(pending.id, tx);
        throw new APIError(400, "Invalid verification code", {}, "OTP_INVALID");
      }

      // Double-check: email chưa có User thật (tránh race condition)
      const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (existingUser) {
        await this.pendingRegistrationRepository.markUsed(pending.id, tx);
        throw new APIError(409, "Email already registered", { email: "This email is already in use" }, "EMAIL_ALREADY_EXISTS");
      }

      // Tạo User thật từ dữ liệu PendingRegistration
      // Username = tên đầy đủ lowercase, khoảng trắng → dấu gạch dưới
      const user = await tx.user.create({
        data: {
          username: await this.generateUniqueUsername(tx, pending.name),
          email,
          passwordHash: pending.passwordHash,
          phone: pending.phone,
          role: "CUSTOMER",
        },
        select: { id: true, username: true, email: true, phone: true, role: true },
      });

      // Đánh dấu PendingRegistration đã sử dụng (không xóa để lưu audit trail)
      await this.pendingRegistrationRepository.markUsed(pending.id, tx);

      return { user: { id: user.id, username: user.username, email: user.email, phone: user.phone, role: user.role } };
    });
  }

  /**
   * Gửi lại OTP mới (khi OTP cũ hết hạn hoặc không nhận được email)
   * Áp dụng cooldown 60s để tránh spam email
   */
  async resendRegistrationOtp(input: RegisterOtpResendInput) {
    const email = input.email.toLowerCase();
    const now = new Date();
    await this.pendingRegistrationRepository.deleteExpired(now);

    const pending = await this.pendingRegistrationRepository.findByEmail(email);
    if (!pending || pending.usedAt) {
      throw new APIError(404, "Pending registration not found", {}, "PENDING_REGISTRATION_NOT_FOUND");
    }

    this.assertResendCooldown(pending.lastSentAt, now);

    // Sinh OTP mới và cập nhật trong DB
    const otp = this.otpService.generateOtp();
    const otpHash = this.otpService.hashOtp(otp);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRES_IN_MS);

    await this.pendingRegistrationRepository.updateForResend(email, { otpHash, expiresAt, lastSentAt: now });

    try {
      await this.emailService.sendRegistrationOtp(email, otp, 5);
    } catch (error) {
      await this.pendingRegistrationRepository.deleteByEmail(email);
      throw error;
    }

    return { email, expiresInSeconds: OTP_EXPIRES_IN_SECONDS, resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS };
  }

  /**
   * Đăng nhập bằng email + password
   * Trả về JWT token + thông tin user cơ bản
   * Thông báo lỗi chung ("Invalid email or password") để không lộ email nào đã đăng ký
   */
  async login(input: LoginInput) {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      throw new APIError(401, "Invalid email or password", {}, "INVALID_CREDENTIALS");
    }

    // So sánh mật khẩu với bcrypt hash trong DB
    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new APIError(401, "Invalid email or password", {}, "INVALID_CREDENTIALS");
    }

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, phone: user.phone, role: user.role },
    };
  }

  /** Lấy thông tin profile của user đang đăng nhập */
  async getProfile(userId: number) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new APIError(404, "User not found", {}, "USER_NOT_FOUND");
    return user;
  }

  /**
   * Kiểm tra cooldown gửi OTP
   * Ném lỗi 429 nếu chưa đủ thời gian đợi, kèm số giây còn lại
   */
  private assertResendCooldown(lastSentAt: Date | null, now: Date) {
    if (!lastSentAt) return; // Chưa gửi lần nào → được phép gửi

    const elapsedMs = now.getTime() - lastSentAt.getTime();
    if (elapsedMs >= OTP_RESEND_COOLDOWN_MS) return; // Đã qua cooldown

    const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
    throw new APIError(
      429,
      `Please wait ${retryAfterSeconds} seconds before requesting another code`,
      { retryAfterSeconds },
      "OTP_RESEND_COOLDOWN",
    );
  }

  private async generateUniqueUsername(
    tx: Prisma.TransactionClient,
    fullName: string,
  ): Promise<string> {
    const baseUsername =
      fullName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 45) || "user";

    let username = baseUsername;
    let suffix = 2;

    while (await tx.user.findUnique({ where: { username }, select: { id: true } })) {
      username = `${baseUsername.slice(0, 45 - String(suffix).length)}${suffix}`;
      suffix++;
    }

    return username;
  }
}
