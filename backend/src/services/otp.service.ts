import crypto from "crypto";
import { getEnv } from "../config/env.config.js";

const OTP_LENGTH = 6;

export class OtpService {
  generateOtp(): string {
    return crypto.randomInt(100000, 1000000).toString().padStart(OTP_LENGTH, "0");
  }

  hashOtp(otp: string): string {
    const env = getEnv();
    return crypto
      .createHmac("sha256", env.OTP_SECRET)
      .update(otp)
      .digest("hex");
  }

  verifyOtp(otp: string, otpHash: string): boolean {
    const candidate = this.hashOtp(otp);
    const candidateBuffer = Buffer.from(candidate, "hex");
    const storedBuffer = Buffer.from(otpHash, "hex");
    if (candidateBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
  }
}

