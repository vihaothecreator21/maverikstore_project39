import { PaymentStatus } from "@prisma/client";
import { buildVNPayPaymentUrl, verifyVNPayReturn, type VNPayBankCode, type VNPayVerificationResult } from "../gateways/vnpay.gateway";
import { PaymentRepository } from "../repositories/payment.repository";
import { APIError } from "../utils/apiResponse";

/**
 * Payment Service — Xử lý thanh toán VNPAY
 *
 * Luồng thanh toán VNPAY:
 * 1. User bấm "Thanh toán" → createVNPayUrl() → redirect đến VNPAY
 * 2. Sau khi thanh toán → VNPAY redirect về VNPAY_RETURN_URL → vnpayReturn()
 *    (chỉ hiển thị kết quả cho user, KHÔNG update DB ở đây)
 * 3. VNPAY gọi IPN (server-to-server) → handleIPN() → update DB
 *
 * Tại sao KHÔNG update DB ở Return URL?
 * → Return URL do user browser gọi, có thể bị giả mạo hoặc không được gọi
 * → IPN (Instant Payment Notification) do server VNPAY gọi → đáng tin hơn
 */
export class PaymentService {
  private paymentRepository: PaymentRepository;

  constructor(paymentRepository: PaymentRepository) {
    this.paymentRepository = paymentRepository;
  }

  /**
   * Tạo URL thanh toán VNPAY cho đơn hàng
   *
   * @param orderId - ID đơn hàng cần thanh toán
   * @param userId  - ID user (xác minh chủ đơn)
   * @param clientIp - IP client (VNPAY yêu cầu, dùng cho bảo mật)
   * @param bankCode - Mã ngân hàng (vd: INTCARD = thẻ quốc tế), optional
   */
  async createVNPayUrl(
    orderId: number,
    userId: number,
    clientIp: string,
    bankCode?: VNPayBankCode,
  ): Promise<string> {
    // Lấy thông tin đơn hàng để biết số tiền cần thanh toán
    const order = await this.paymentRepository.findOrderAmount(orderId, userId);

    if (!order) {
      throw new APIError(404, `Đơn hàng #${orderId} không tồn tại`, {}, "ORDER_NOT_FOUND");
    }
    // Chỉ chủ đơn mới được tạo URL thanh toán (tránh IDOR)
    if (order.userId !== userId) {
      throw new APIError(403, "Bạn không có quyền thanh toán đơn hàng này", {}, "FORBIDDEN");
    }

    // Chuẩn hóa IP: "::1" (IPv6 localhost) → "127.0.0.1", loại bỏ prefix "::ffff:"
    const ip =
      clientIp === "::1"
        ? "127.0.0.1"
        : clientIp.replace(/^::ffff:/, "") || "127.0.0.1";

    const paymentInput: {
      orderId: number;
      amount: number;
      clientIp: string;
      bankCode?: VNPayBankCode;
    } = {
      orderId,
      amount: Number(order.totalAmount), // Chuyển Decimal → number
      clientIp: ip,
    };

    if (bankCode) paymentInput.bankCode = bankCode;

    // Gọi gateway để build URL ký HMAC-SHA512 theo chuẩn VNPAY
    return buildVNPayPaymentUrl(paymentInput);
  }

  /**
   * Xác minh chữ ký từ VNPAY Return URL hoặc IPN
   * Dùng chung cho cả 2 endpoint (Return + IPN)
   */
  verifyReturn(query: Record<string, string>): VNPayVerificationResult {
    return verifyVNPayReturn(query);
  }

  /**
   * Xử lý IPN (Instant Payment Notification) từ VNPAY
   *
   * ĐÂY LÀ NƠI DUY NHẤT update DB sau thanh toán.
   * VNPAY gọi endpoint này từ server của họ → đáng tin hơn Return URL.
   *
   * VNPAY retry IPN nếu không nhận được { RspCode: "00" } trong ~15 phút.
   * → Phải luôn trả về RspCode đúng format để VNPAY biết đã nhận được.
   */
  async handleIPN(
    params: Record<string, string>,
  ): Promise<{ RspCode: string; Message: string }> {
    try {
      // Bước 1: Xác minh chữ ký HMAC-SHA512 để đảm bảo request đến từ VNPAY thật
      const verified = this.verifyReturn(params);
      if (!verified.isValid) {
        return { RspCode: "97", Message: "Invalid Signature" };
      }

      const orderId = verified.orderId;
      if (!orderId) {
        return { RspCode: "01", Message: "Order not found" };
      }

      // Bước 2: Lấy đơn hàng và payment record từ DB
      const order = await this.paymentRepository.findOrderWithPayment(orderId);

      if (!order || !order.payment) {
        return { RspCode: "01", Message: "Order not found" };
      }

      // Bước 3: Kiểm tra idempotency — tránh xử lý IPN 2 lần (VNPAY có thể retry)
      if (order.payment.paymentStatus === PaymentStatus.SUCCESS) {
        return { RspCode: "02", Message: "Order already confirmed" };
      }

      // Bước 4: Kiểm tra số tiền có khớp không (tránh gian lận số tiền)
      // VNPAY gửi amount đơn vị xu (×100), phải chia 100 để ra VNĐ
      const vnpAmount = Number(params.vnp_Amount ?? 0) / 100;
      const orderAmount = Number(order.payment.amount);

      // Chấp nhận sai lệch tối đa 1 VNĐ (lỗi làm tròn số thực)
      if (Math.abs(vnpAmount - orderAmount) > 1) {
        return { RspCode: "04", Message: "Invalid Amount" };
      }

      const transactionId = params.vnp_TransactionNo ?? null;

      // Bước 5: Xử lý theo kết quả giao dịch
      if (verified.isCancelled) {
        // responseCode "24" = user tự hủy → không update payment, báo VNPAY đã nhận
        return { RspCode: "00", Message: "Confirm Success" };
      }

      if (!verified.isSuccess) {
        // Thanh toán thất bại (bank decline, timeout...) → đánh dấu FAILED
        await this.paymentRepository.markPaymentFailed(order.payment.id, transactionId);
        return { RspCode: "00", Message: "Confirm Success" };
      }

      // Thanh toán thành công → cập nhật payment SUCCESS + order PENDING
      await this.paymentRepository.confirmPaymentAndOrder(
        order.payment.id,
        orderId,
        transactionId,
        order.status,
      );

      return { RspCode: "00", Message: "Confirm Success" };
    } catch (err) {
      // Bắt lỗi bất ngờ — KHÔNG để lộ chi tiết lỗi ra ngoài
      // Trả "99" để VNPAY biết có lỗi và sẽ retry
      console.error("[PaymentService.handleIPN] Unexpected error:", err);
      return { RspCode: "99", Message: "Unknown error" };
    }
  }

  /** Placeholder — chức năng tra cứu giao dịch (chưa triển khai) */
  async queryTransaction(): Promise<Record<string, never>> {
    return {};
  }

  /** Placeholder — chức năng hoàn tiền (chưa triển khai) */
  async refundTransaction(): Promise<Record<string, never>> {
    return {};
  }
}
