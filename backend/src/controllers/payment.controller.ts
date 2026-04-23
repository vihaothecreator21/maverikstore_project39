import { Request, Response } from "express";
import { PaymentService } from "../services/payment.service.js";
import { CreateVNPayUrlSchema } from "../schemas/payment.schema.js";
import { sendSuccess, sendError, HTTP_STATUS } from "../utils/apiResponse.js";

export class PaymentController {
  /**
   * GET /api/v1/payments/vnpay/create?orderId=123
   * Tạo URL thanh toán VNPay — trả về { paymentUrl }
   * Yêu cầu: authMiddleware (user phải đăng nhập)
   */
  static async createVNPayUrl(req: Request, res: Response): Promise<void> {
    const userId = (req as any).userId as number;

    // Lấy IP thực của client (hỗ trợ proxy/nginx)
    const ipAddr =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    const { orderId } = CreateVNPayUrlSchema.parse(req.query);
    const paymentUrl  = await PaymentService.createVNPayUrl(orderId, userId, ipAddr);

    sendSuccess(res, { paymentUrl }, "Tạo URL thanh toán thành công", HTTP_STATUS.OK);
  }

  /**
   * GET /api/v1/payments/vnpay/return
   * VNPay redirect user về đây sau khi thanh toán (return URL)
   * Verify hash, rồi redirect sang trang frontend vnpay-return.html
   *
   * KHÔNG update DB ở đây — DB được update qua IPN (server-to-server)
   */
  static async vnpayReturn(req: Request, res: Response): Promise<void> {
    const params = req.query as Record<string, string>;

    const result = PaymentService.verifyReturn(params);

    // Redirect về frontend với thông tin kết quả dưới dạng query string
    const frontendReturnUrl = process.env.VNPAY_FRONTEND_RETURN ?? "http://localhost:5173/vnpay-return.html";

    const redirectParams = new URLSearchParams({
      isSuccess:    String(result.isSuccess),
      orderId:      String(result.orderId),
      amount:       String(result.amount),
      responseCode: result.responseCode,
      message:      result.message,
    });

    res.redirect(`${frontendReturnUrl}?${redirectParams.toString()}`);
  }

  /**
   * GET /api/v1/payments/vnpay/ipn
   * VNPay gọi IPN (server-to-server) sau khi giao dịch hoàn tất
   * KHÔNG redirect, KHÔNG return HTML — phải trả JSON { RspCode, Message }
   *
   * VNPay sẽ RETRY nếu không nhận được { RspCode: "00" } trong ~15 phút
   */
  static async vnpayIPN(req: Request, res: Response): Promise<void> {
    const params = req.query as Record<string, string>;

    const result = await PaymentService.handleIPN(params);

    // VNPay yêu cầu response JSON chính xác format này
    res.status(200).json(result);
  }
}
