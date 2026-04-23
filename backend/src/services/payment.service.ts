import { prisma } from "../config/database.js";
import { APIError } from "../utils/apiResponse.js";
import { PaymentStatus, OrderStatus } from "@prisma/client";
import { writeAuditLog } from "../utils/auditLog.helper.js";

// ── VNPay manual helpers (theo đúng VNPay NodeJS official demo) ───────
// NOTE: Không dùng vnpay npm library's buildPaymentUrl() vì library dùng URLSearchParams
//       encoding (spaces→+, ://→%3A%2F%2F) trong khi VNPay verify bằng
//       qs.stringify({encode:false}) → hash không khớp → "Sai chữ ký"
import * as crypto from "crypto";
import * as qs from "qs";

/**
 * Sắp xếp object theo thứ tự alphabet của key (VNPay yêu cầu)
 * KHÔNG encode ở đây. VNPay Node.js demo yêu cầu dùng chuỗi thô để hash.
 */
function sortObject(obj: Record<string, any>): Record<string, string> {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] !== "" && obj[key] !== undefined && obj[key] !== null) {
      sorted[key] = String(obj[key]);
    }
  }
  return sorted;
}

/**
 * Tạo vnp_CreateDate theo GMT+7 — đúng theo yêu cầu VNPay
 * Tránh lỗi timezone: không dùng library's getDateInGMT7() vì bị
 * double-add 7h khi máy đang ở UTC+7
 */
function getVNPayCreateDate(): string {
  // Lấy thời gian hiện tại theo UTC rồi offset +7h thủ công
  const now  = new Date();
  const gmt7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const y    = gmt7.getUTCFullYear();
  const mo   = String(gmt7.getUTCMonth() + 1).padStart(2, "0");
  const d    = String(gmt7.getUTCDate()).padStart(2, "0");
  const h    = String(gmt7.getUTCHours()).padStart(2, "0");
  const mi   = String(gmt7.getUTCMinutes()).padStart(2, "0");
  const s    = String(gmt7.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${d}${h}${mi}${s}`;
}

/**
 * Tạo VNPay payment URL thủ công
 * Node.js demo của VNPay: Hash và URL đều dùng qs.stringify({ encode: false })
 */
function buildVNPayUrl(params: {
  tmnCode:    string;
  hashSecret: string;
  amount:     number;         // Đơn vị VNĐ (chưa * 100)
  ipAddr:     string;
  txnRef:     string;
  orderInfo:  string;
  returnUrl:  string;
  locale?:    string;
}): string {
  const VNPAY_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

  const vnpParams: Record<string, string | number> = {
    vnp_Version:    "2.1.0",
    vnp_Command:    "pay",
    vnp_TmnCode:    params.tmnCode,
    vnp_Locale:     params.locale ?? "vn",
    vnp_CurrCode:   "VND",
    vnp_TxnRef:     params.txnRef,
    vnp_OrderInfo:  params.orderInfo,
    vnp_OrderType:  "other",
    vnp_Amount:     Math.round(params.amount * 100),   // VNPay yêu cầu * 100
    vnp_ReturnUrl:  params.returnUrl,
    vnp_IpAddr:     params.ipAddr,
    vnp_CreateDate: getVNPayCreateDate(),
  };

  const sorted   = sortObject(vnpParams);
  // 1. Dữ liệu trong chuỗi signData dùng để Hash KHÔNG được URL Encode
  const signData = qs.stringify(sorted, { encode: false });

  // 2. HMAC-SHA512 với key = hashSecret
  const signed = crypto
    .createHmac("sha512", params.hashSecret)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  // 3. Thêm chữ ký vào params rồi build URL cuối
  const finalParams = { ...sorted, vnp_SecureHash: signed };
  
  // 4. Chỉ URL cuối cùng sau khi đã có mã Hash mới được URL Encode các tham số
  return `${VNPAY_URL}?${qs.stringify(finalParams, { encode: true })}`;
}

/**
 * Verify chữ ký VNPay từ query params (ReturnURL / IPN)
 * Dùng qs.stringify({ encode: false }) để nhất quán với cách VNPay verify
 */
function verifyVNPaySignature(
  params: Record<string, string>,
  hashSecret: string,
): boolean {
  const receivedHash = params["vnp_SecureHash"];
  if (!receivedHash) return false;

  // Loại bỏ vnp_SecureHash, vnp_SecureHashType và các param không bắt đầu bằng vnp_ khỏi params
  const dataParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (k.startsWith("vnp_") && k !== "vnp_SecureHash" && k !== "vnp_SecureHashType") {
      dataParams[k] = v;
    }
  }

  const sorted   = sortObject(dataParams);
  // params từ req.query đã được express tự động URL Decode, nên sorted hiện là un-encoded.
  // Tạo chuỗi signData KHÔNG URL Encode để hash
  const signData = qs.stringify(sorted, { encode: false });
  const signed   = crypto
    .createHmac("sha512", hashSecret)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  return signed.toLowerCase() === receivedHash.toLowerCase();
}

/**
 * PaymentService — VNPay Sandbox Integration
 *
 * Luồng:
 *   1. createVNPayUrl()  → build signed payment URL → redirect user sang VNPay
 *   2. verifyReturn()    → verify hash khi VNPay redirect về → hiện trang kết quả
 *   3. handleIPN()       → verify hash + update Payment & Order trong DB (server-to-server)
 */
export class PaymentService {
  // ── UC-Pay-01: Tạo URL thanh toán VNPay ─────────────────────────
  static async createVNPayUrl(
    orderId: number,
    userId: number,
    ipAddr: string,
  ): Promise<string> {
    // 1. Lấy order — kiểm tra ownership
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new APIError(404, "Không tìm thấy đơn hàng", {}, "ORDER_NOT_FOUND");
    }

    if (order.userId !== userId) {
      throw new APIError(403, "Bạn không có quyền thanh toán đơn hàng này", {}, "FORBIDDEN");
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new APIError(
        400,
        `Đơn hàng ở trạng thái "${order.status}" không thể thanh toán`,
        { currentStatus: order.status },
        "INVALID_ORDER_STATUS",
      );
    }

    // 2. Kiểm tra nếu đã thanh toán thành công trước đó
    if (order.payment?.paymentStatus === PaymentStatus.SUCCESS) {
      throw new APIError(400, "Đơn hàng đã được thanh toán", {}, "ALREADY_PAID");
    }

    // 3. Upsert Payment record với status PENDING
    await prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        paymentMethod: "VNPAY",
        paymentStatus: PaymentStatus.PENDING,
        amount:        order.totalAmount,
      },
      update: {
        paymentMethod: "VNPAY",
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    // 4. Build VNPay payment URL thủ công (tránh lỗi encoding của library)
    const tmnCode    = process.env.VNPAY_TMN_CODE    ?? "";
    const hashSecret = process.env.VNPAY_HASH_SECRET ?? "";
    const returnUrl  = process.env.VNPAY_RETURN_URL  ?? "http://localhost:5000/api/v1/payments/vnpay/return";

    // vnp_OrderInfo: VNPay yêu cầu không có dấu và không có ký tự đặc biệt (#, &, ...)
    // Xóa toàn bộ khoảng trắng để tránh lỗi khác biệt encoding giữa Node.js và PHP
    const orderInfo = `ThanhToanDonHang_${orderId}_MaverikStore`;

    const paymentUrl = buildVNPayUrl({
      tmnCode,
      hashSecret,
      amount:    Number(order.totalAmount),
      ipAddr:    "127.0.0.1", // FORCED FOR TESTING (VNPay có thể lỗi với ::1)
      txnRef:    String(orderId),
      orderInfo,
      returnUrl,
      locale:    "vn",
    });

    return paymentUrl;
  }

  // ── UC-Pay-02: Verify Return URL từ VNPay ───────────────────────
  /**
   * Dùng để frontend check kết quả sau khi VNPay redirect về
   * KHÔNG update DB ở đây (dùng IPN cho điều đó)
   * Chỉ verify hash + trả về thông tin để frontend hiển thị
   */
  static verifyReturn(params: Record<string, string>): {
    isValid: boolean;
    isSuccess: boolean;
    orderId: number;
    amount: number;
    responseCode: string;
    message: string;
  } {
    const hashSecret = process.env.VNPAY_HASH_SECRET ?? "";
    const isVerified = verifyVNPaySignature(params, hashSecret);

    const responseCode = params.vnp_ResponseCode ?? "";
    const orderId = parseInt(params.vnp_TxnRef ?? "0", 10);
    const amount  = parseInt(params.vnp_Amount ?? "0", 10) / 100; // VNPay gửi * 100

    // ResponseCode "00" = thành công
    const isSuccess = isVerified && responseCode === "00";

    const MESSAGE_MAP: Record<string, string> = {
      "00": "Giao dịch thành công",
      "07": "Trừ tiền thành công. Giao dịch bị nghi ngờ (liên hệ VNPAY)",
      "09": "Thẻ / tài khoản chưa đăng ký dịch vụ Internet Banking",
      "10": "Xác thực thông tin thẻ / tài khoản quá 3 lần",
      "11": "Đã hết hạn chờ thanh toán. Vui lòng thực hiện lại",
      "12": "Thẻ / tài khoản bị khóa",
      "13": "Sai mật khẩu OTP. Vui lòng thực hiện lại",
      "24": "Khách hàng hủy giao dịch",
      "51": "Tài khoản không đủ số dư",
      "65": "Tài khoản vượt quá hạn mức giao dịch trong ngày",
      "75": "Ngân hàng thanh toán đang bảo trì",
      "79": "Sai mật khẩu thanh toán quá số lần quy định",
      "99": "Lỗi không xác định",
    };

    return {
      isValid:      isVerified,
      isSuccess,
      orderId,
      amount,
      responseCode,
      message: MESSAGE_MAP[responseCode] ?? `Lỗi không xác định (${responseCode})`,
    };
  }

  // ── UC-Pay-03: Xử lý IPN (server-to-server từ VNPay) ───────────
  /**
   * VNPay gọi IPN URL sau khi giao dịch hoàn tất
   * Phải verify hash và update DB — trả về { RspCode, Message } cho VNPay
   *
   * VNPay sẽ retry IPN nếu không nhận được response { RspCode: "00" }
   */
  static async handleIPN(params: Record<string, string>): Promise<{
    RspCode: string;
    Message: string;
  }> {
    try {
      const hashSecret = process.env.VNPAY_HASH_SECRET ?? "";
      
      // 1. Verify HMAC signature
      const isVerified = verifyVNPaySignature(params, hashSecret);
      if (!isVerified) {
        console.error("[VNPay IPN] Invalid signature:", params);
        return { RspCode: "97", Message: "Invalid Signature" };
      }

      const orderId      = parseInt(params.vnp_TxnRef ?? "0", 10);
      const responseCode = params.vnp_ResponseCode ?? "";
      const vnpAmount    = parseInt(params.vnp_Amount ?? "0", 10) / 100;
      const transId      = params.vnp_TransactionNo ?? null;

      // 2. Tìm order trong DB
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payment: true },
      });

      if (!order) {
        return { RspCode: "01", Message: "Order not found" };
      }

      // 3. Kiểm tra số tiền khớp
      const expectedAmount = Number(order.totalAmount);
      if (Math.abs(vnpAmount - expectedAmount) > 1) {
        // Dung sai 1 VNĐ để tránh lỗi làm tròn
        console.error(
          `[VNPay IPN] Amount mismatch: expected ${expectedAmount}, got ${vnpAmount}`,
        );
        return { RspCode: "04", Message: "Invalid Amount" };
      }

      // 4. Kiểm tra đã xử lý trước đó chưa (idempotent)
      if (order.payment?.paymentStatus === PaymentStatus.SUCCESS) {
        // Đã thành công → VNPay retry — trả OK, không cập nhật lại
        return { RspCode: "00", Message: "Confirm Success" };
      }

      // 5. Cập nhật Payment + Order trong 1 transaction
      const isSuccess = responseCode === "00";
      const newPaymentStatus = isSuccess ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
      const newOrderStatus   = isSuccess ? OrderStatus.CONFIRMED : order.status;

      await prisma.$transaction([
        // Update Payment record
        prisma.payment.upsert({
          where:  { orderId },
          create: {
            orderId,
            paymentMethod: "VNPAY",
            paymentStatus: newPaymentStatus,
            amount:        order.totalAmount,
            transactionId: transId,
          },
          update: {
            paymentStatus: newPaymentStatus,
            transactionId: transId ?? undefined,
          },
        }),

        // Update Order status nếu thanh toán thành công
        ...(isSuccess
          ? [
              prisma.order.update({
                where: { id: orderId },
                data:  { status: newOrderStatus },
              }),
            ]
          : []),
      ]);

      // 6. Ghi AuditLog
      await writeAuditLog({
        action:   isSuccess ? "PAYMENT_SUCCESS" : "PAYMENT_FAILED",
        entity:   "Payment",
        entityId: orderId,
        oldValue: { paymentStatus: order.payment?.paymentStatus ?? "PENDING" },
        newValue: { paymentStatus: newPaymentStatus, responseCode, transId },
        userId:   order.userId,
      });

      console.log(
        `[VNPay IPN] Order #${orderId} → ${newPaymentStatus} (RC: ${responseCode})`,
      );

      return { RspCode: "00", Message: "Confirm Success" };
    } catch (err) {
      console.error("[VNPay IPN] Unhandled error:", err);
      return { RspCode: "99", Message: "Unknown Error" };
    }
  }
}
