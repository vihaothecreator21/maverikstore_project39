import { Request, Response } from "express";
import { paymentService } from "../container";
import { CreateVNPayUrlSchema } from "../schemas/payment.schema.js";
import { sendSuccess, HTTP_STATUS } from "../utils/apiResponse.js";
import { getEnv } from "../config/env.config.js";

export class PaymentController {
  /**
   * GET /api/v1/payments/vnpay/create?orderId=123
   * Tạo URL thanh toán VNPay — trả về { paymentUrl }
   * Yêu cầu: authMiddleware (user phải đăng nhập)
   */
  static async createVNPayUrl(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;

    // Lấy IP thực của client (hỗ trợ proxy/nginx)
    const ipAddr =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    const { orderId } = CreateVNPayUrlSchema.parse(req.query);
    const paymentUrl  = await paymentService.createVNPayUrl(orderId, userId, ipAddr);

    sendSuccess(res, { paymentUrl }, "Tạo URL thanh toán thành công", HTTP_STATUS.OK);
  }

  /**
   * GET /api/v1/payments/vnpay/return
   * VNPay redirect user về đây sau khi thanh toán.
   *
   * 3 cases:
   *   "00" → thành công  → redirect /payment-success
   *   "24" → user huỷ   → redirect /payment-cancel  (NOT a server error)
   *   else → thất bại   → redirect /payment-failed
   *
   * ⚠️ KHÔNG update DB ở đây — DB chỉ được update qua IPN (server-to-server).
   *    Return URL chỉ dùng để hiển thị kết quả cho user.
   */
  static async vnpayReturn(req: Request, res: Response): Promise<void> {
    const params = req.query as Record<string, string>;
    const result = paymentService.verifyReturn(params);

    const env = getEnv();

    // Base URLs của từng trang kết quả trên frontend
    const baseUrl  = env.VNPAY_FRONTEND_RETURN.replace(/\/[^/]*$/, ""); // strip last segment

    const commonParams = new URLSearchParams({
      orderId:      String(result.orderId),
      amount:       String(result.amount),
      responseCode: result.responseCode,
      message:      result.message,
    });

    // ── Route theo responseCode ───────────────────────────────────────
    if (result.isSuccess) {
      // "00" → thanh toán thành công
      res.redirect(`${baseUrl}/payment-success.html?${commonParams}`);
      return;
    }

    if (result.isCancelled) {
      // "24" → user tự huỷ — KHÔNG phải lỗi
      res.redirect(`${baseUrl}/payment-cancel.html?${commonParams}`);
      return;
    }

    // else → thanh toán thất bại (bank decline, timeout, etc.)
    res.redirect(`${baseUrl}/payment-failed.html?${commonParams}`);
  }

  /**
   * GET /api/v1/payments/vnpay/ipn
   * VNPay gọi IPN (server-to-server) sau khi giao dịch hoàn tất.
   * Luôn trả JSON { RspCode, Message } — KHÔNG redirect.
   *
   * VNPay sẽ RETRY nếu không nhận được { RspCode: "00" } trong ~15 phút.
   */
  static async vnpayIPN(req: Request, res: Response): Promise<void> {
    const params = req.query as Record<string, string>;
    const result = await paymentService.handleIPN(params);

    // VNPay yêu cầu response JSON chính xác format này
    res.status(200).json(result);
  }
}
