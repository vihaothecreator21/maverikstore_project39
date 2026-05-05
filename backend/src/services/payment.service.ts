import * as crypto from "crypto";
import * as qs from "qs";
import { PaymentRepository } from "../repositories/payment.repository";
import { PaymentStatus } from "@prisma/client";
import { APIError } from "../utils/apiResponse";
import { getEnv } from "../config/env.config";

// ── VNPay response codes ────────────────────────────────────────────
// "00" → success
// "24" → user cancelled (NOT an error — treat gracefully)
// others → payment failed

// ── Helpers ────────────────────────────────────────────────────────

function sortObject(obj: Record<string, any>): Record<string, string> {
  const sorted: Record<string, string> = {};
  const keys = Object.keys(obj)
    .map((k) => encodeURIComponent(k))
    .sort();

  for (const encodedKey of keys) {
    const originalKey = decodeURIComponent(encodedKey);
    const val = obj[originalKey];
    if (val !== undefined && val !== null && val !== "") {
      sorted[encodedKey] = encodeURIComponent(String(val)).replace(/%20/g, "+");
    }
  }
  return sorted;
}

function getVNPayCreateDate(date?: Date): string {
  const now = date ?? new Date();
  const gmt7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    String(gmt7.getUTCFullYear()) +
    pad(gmt7.getUTCMonth() + 1) +
    pad(gmt7.getUTCDate()) +
    pad(gmt7.getUTCHours()) +
    pad(gmt7.getUTCMinutes()) +
    pad(gmt7.getUTCSeconds())
  );
}

/**
 * HMAC-SHA512 signing — reads secret from validated env (NOT raw process.env)
 */
function hmacSha512(data: string): string {
  const secret = getEnv().VNPAY_HASH_SECRET.trim();
  return crypto.createHmac("sha512", secret).update(data, "utf-8").digest("hex");
}

function buildSignedUrl(
  sorted: Record<string, string>,
  secureHash: string,
): string {
  return (
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?" +
    qs.stringify({ ...sorted, vnp_SecureHash: secureHash }, { encode: false })
  );
}

/**
 * Map VNPay responseCode to a user-friendly message.
 * "24" = user cancelled (NOT an error).
 */
function vnpayMessage(code: string): string {
  const map: Record<string, string> = {
    "00": "Thanh toán thành công",
    "24": "Bạn đã hủy giao dịch",
    "07": "Giao dịch bị nghi ngờ gian lận",
    "09": "Thẻ/tài khoản chưa đăng ký dịch vụ",
    "10": "Xác thực thẻ thất bại quá 3 lần",
    "11": "Hết hạn chờ thanh toán",
    "12": "Thẻ/tài khoản bị khóa",
    "51": "Tài khoản không đủ số dư",
    "65": "Vượt hạn mức giao dịch trong ngày",
    "75": "Ngân hàng thanh toán đang bảo trì",
    "79": "Nhập sai mật khẩu quá số lần quy định",
  };
  return map[code] ?? `Giao dịch thất bại (mã: ${code})`;
}

// ── Service ────────────────────────────────────────────────────────

export class PaymentService {
  private paymentRepository: PaymentRepository;

  constructor(paymentRepository: PaymentRepository) {
    this.paymentRepository = paymentRepository;
  }

  /**
   * Tạo URL thanh toán VNPay — lấy totalAmount từ DB qua Repository.
   */
  async createVNPayUrl(
    orderId: number,
    userId: number,
    clientIp: string,
  ): Promise<string> {
    const order = await this.paymentRepository.findOrderAmount(orderId, userId);

    if (!order) {
      throw new APIError(404, `Đơn hàng #${orderId} không tồn tại`, {}, "ORDER_NOT_FOUND");
    }
    if (order.userId !== userId) {
      throw new APIError(403, "Bạn không có quyền thanh toán đơn hàng này", {}, "FORBIDDEN");
    }

    // VNPay yêu cầu amount = VND * 100 (integer, không có phần thập phân)
    const amountVND = Math.round(Number(order.totalAmount) * 100);

    const ip =
      clientIp === "::1"
        ? "127.0.0.1"
        : clientIp.replace(/^::ffff:/, "") || "127.0.0.1";

    const env = getEnv();
    const params: Record<string, string | number> = {
      vnp_Version:    "2.1.0",
      vnp_Command:    "pay",
      vnp_TmnCode:    env.VNPAY_TMN_CODE,          // from validated env — no fallback
      vnp_Amount:     amountVND,
      vnp_CurrCode:   "VND",
      vnp_TxnRef:     String(orderId),
      vnp_OrderInfo:  `Thanh toan don hang ${orderId}`,
      vnp_OrderType:  "other",
      vnp_Locale:     "vn",
      vnp_ReturnUrl:  env.VNPAY_RETURN_URL,
      vnp_IpAddr:     ip,
      vnp_CreateDate: getVNPayCreateDate(),
    };

    const sorted = sortObject(params);
    const signData = qs.stringify(sorted, { encode: false });
    const secureHash = hmacSha512(signData);

    return buildSignedUrl(sorted, secureHash);
  }

  // ── Return URL verify ──────────────────────────────────────────

  /**
   * Xác thực chữ ký và parse kết quả từ VNPay return URL.
   *
   * responseCode meanings:
   *  "00" → success
   *  "24" → user cancelled (NOT a server error)
   *  else → payment failed (bank decline, etc.)
   */
  verifyReturn(query: Record<string, string>): {
    isValid: boolean;
    isSuccess: boolean;
    isCancelled: boolean;
    orderId: number;
    amount: number;
    responseCode: string;
    message: string;
  } {
    const secureHash = query.vnp_SecureHash;

    if (!secureHash) {
      return {
        isValid:     false,
        isSuccess:   false,
        isCancelled: false,
        orderId:     0,
        amount:      0,
        responseCode: "97",
        message:     "Chữ ký không hợp lệ",
      };
    }

    const cloned = { ...query };
    delete cloned.vnp_SecureHash;
    delete cloned.vnp_SecureHashType;

    const sorted    = sortObject(cloned);
    const signData  = qs.stringify(sorted, { encode: false });
    const localHash = hmacSha512(signData);

    const isValid      = localHash.toLowerCase() === secureHash.toLowerCase();
    const responseCode = query.vnp_ResponseCode ?? "99";
    const isCancelled  = isValid && responseCode === "24";
    const isSuccess    = isValid && responseCode === "00";

    return {
      isValid,
      isSuccess,
      isCancelled,
      orderId:  Number(query.vnp_TxnRef ?? 0),
      amount:   Number(query.vnp_Amount ?? 0) / 100,
      responseCode,
      message:  vnpayMessage(responseCode),
    };
  }

  // ── IPN Handler ────────────────────────────────────────────────

  /**
   * VNPay gọi server-to-server (IPN) sau khi giao dịch hoàn tất.
   * Luôn trả { RspCode, Message } — KHÔNG redirect, KHÔNG throw.
   *
   * Idempotent: nếu Payment đã SUCCESS thì trả "02" (không update lại).
   * "24" (user cancelled): IPN có thể không gửi, nhưng nếu gửi thì handle gracefully.
   */
  async handleIPN(
    params: Record<string, string>,
  ): Promise<{ RspCode: string; Message: string }> {
    try {
      // 1. Verify chữ ký
      const verified = this.verifyReturn(params);
      if (!verified.isValid) {
        return { RspCode: "97", Message: "Invalid Signature" };
      }

      const orderId = verified.orderId;
      if (!orderId) {
        return { RspCode: "01", Message: "Order not found" };
      }

      // 2. Tìm order + payment từ DB
      const order = await this.paymentRepository.findOrderWithPayment(orderId);

      if (!order || !order.payment) {
        return { RspCode: "01", Message: "Order not found" };
      }

      // 3. Idempotency guard — đã xử lý thành công → bỏ qua
      if (order.payment.paymentStatus === PaymentStatus.SUCCESS) {
        return { RspCode: "02", Message: "Order already confirmed" };
      }

      // 4. Kiểm tra số tiền khớp (tolerance ±1 VND do floating point)
      const vnpAmount   = Number(params.vnp_Amount ?? 0) / 100;
      const orderAmount = Number(order.payment.amount);

      if (Math.abs(vnpAmount - orderAmount) > 1) {
        return { RspCode: "04", Message: "Invalid Amount" };
      }

      const transactionId = params.vnp_TransactionNo ?? null;

      // 5a. User huỷ ("24") hoặc giao dịch thất bại → mark FAILED (không là lỗi server)
      if (!verified.isSuccess) {
        await this.paymentRepository.markPaymentFailed(order.payment.id, transactionId);
        return { RspCode: "00", Message: "Confirm Success" };
      }

      // 5b. Giao dịch thành công → atomic: payment SUCCESS + order CONFIRMED
      await this.paymentRepository.confirmPaymentAndOrder(
        order.payment.id,
        orderId,
        transactionId,
        order.status,
      );

      return { RspCode: "00", Message: "Confirm Success" };

    } catch (err) {
      // IPN KHÔNG được throw — VNPay sẽ retry. Log lỗi và trả 99.
      console.error("[PaymentService.handleIPN] Unexpected error:", err);
      return { RspCode: "99", Message: "Unknown error" };
    }
  }

  // ── Stubs (future) ─────────────────────────────────────────────

  async queryTransaction(): Promise<Record<string, never>> {
    return {};
  }

  async refundTransaction(): Promise<Record<string, never>> {
    return {};
  }
}