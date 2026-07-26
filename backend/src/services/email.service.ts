import { getEnv } from "../config/env.config.js";
import { APIError } from "../utils/apiResponse.js";

export class EmailService {
  async sendRegistrationOtp(email: string, otp: string, expiresInMinutes: number) {
    const env = getEnv();
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      throw new APIError(
        503,
        "Email OTP is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
        {},
        "EMAIL_NOT_CONFIGURED",
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: email,
        subject: "Mã xác thực tài khoản Maverik Store của bạn",
        html: this.buildRegistrationOtpHtml(otp, expiresInMinutes),
      }),
    });

    if (!response.ok) {
      throw new APIError(
        503,
        "Unable to send verification email. Please try again.",
        {},
        "EMAIL_SEND_FAILED",
      );
    }
  }

  private buildRegistrationOtpHtml(otp: string, expiresInMinutes: number) {
    return `
      <p>Xin chào,</p>
      <p>Mã xác thực tài khoản Maverik Store của bạn là:</p>
      <h2 style="letter-spacing: 0.18em;">${otp}</h2>
      <p>Mã này sẽ hết hạn sau ${expiresInMinutes} phút.</p>
      <p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
    `;
  }
}
