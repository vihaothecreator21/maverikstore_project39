import { getEnv } from "../config/env.config";
import { APIError } from "../utils/apiResponse";

export class EmailService {
  async sendRegistrationOtp(email: string, otp: string, expiresInMinutes: number) {
    const env = getEnv();

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: email,
        subject: "Your Maverik Store verification code",
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
      <p>Hello,</p>
      <p>Your Maverik Store verification code is:</p>
      <h2 style="letter-spacing: 0.18em;">${otp}</h2>
      <p>This code will expire in ${expiresInMinutes} minutes.</p>
      <p>If you did not request this code, you can ignore this email.</p>
    `;
  }
}

