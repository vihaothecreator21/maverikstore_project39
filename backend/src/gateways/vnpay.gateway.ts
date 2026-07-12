import * as crypto from "crypto";
import * as qs from "qs";
import { getEnv } from "../config/env.config";

/** Mã ngân hàng hỗ trợ — INTCARD = thẻ quốc tế (Visa, Mastercard, JCB) */
export type VNPayBankCode = "INTCARD";

/** Kết quả xác minh chữ ký từ VNPAY Return URL / IPN */
export interface VNPayVerificationResult {
  isValid: boolean;      // Chữ ký hợp lệ (không bị giả mạo)
  isSuccess: boolean;    // Thanh toán thành công (responseCode "00")
  isCancelled: boolean;  // User tự hủy giao dịch (responseCode "24")
  orderId: number;       // ID đơn hàng (từ vnp_TxnRef)
  amount: number;        // Số tiền (VNĐ, đã chia 100 từ đơn vị xu)
  responseCode: string;  // Mã phản hồi VNPAY (vd: "00", "24", "51"...)
  message: string;       // Thông điệp tiếng Việt tương ứng
}

/**
 * Sắp xếp object theo thứ tự alphabet của key (đã URL-encode)
 * VNPAY yêu cầu ký trên chuỗi query string với key được sắp xếp
 * → phải sắp xếp nhất quán trước khi ký và trước khi verify
 */
function sortObject(obj: Record<string, any>): Record<string, string> {
  const sorted: Record<string, string> = {};
  // URL-encode key rồi sắp xếp để đảm bảo thứ tự nhất quán
  const keys = Object.keys(obj)
    .map((k) => encodeURIComponent(k))
    .sort();

  for (const encodedKey of keys) {
    const originalKey = decodeURIComponent(encodedKey);
    const val = obj[originalKey];
    // Bỏ qua giá trị rỗng/null/undefined
    if (val !== undefined && val !== null && val !== "") {
      // URL-encode giá trị, thay %20 bằng + (chuẩn VNPAY)
      sorted[encodedKey] = encodeURIComponent(String(val)).replace(/%20/g, "+");
    }
  }
  return sorted;
}

/**
 * Tạo chuỗi ngày giờ theo định dạng VNPAY: yyyyMMddHHmmss (múi giờ GMT+7)
 * VNPAY yêu cầu trường vnp_CreateDate theo múi giờ Việt Nam
 */
function getVNPayCreateDate(date?: Date): string {
  const now = date ?? new Date();
  const gmt7 = new Date(now.getTime() + 7 * 60 * 60 * 1000); // Cộng 7 giờ để ra giờ VN
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
 * Tạo chữ ký HMAC-SHA512 cho request/response VNPAY
 * Secret key lấy từ biến môi trường VNPAY_HASH_SECRET
 */
function hmacSha512(data: string): string {
  const secret = getEnv().VNPAY_HASH_SECRET.trim();
  return crypto.createHmac("sha512", secret).update(data, "utf-8").digest("hex");
}

/**
 * Build URL thanh toán cuối cùng (cổng sandbox VNPAY)
 * Ghép sorted params + secureHash thành query string
 */
function buildSignedUrl(sorted: Record<string, string>, secureHash: string): string {
  return (
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?" +
    qs.stringify({ ...sorted, vnp_SecureHash: secureHash }, { encode: false })
  );
}

/**
 * Bảng dịch mã phản hồi VNPAY sang thông điệp tiếng Việt
 * Dùng cho cả Return URL và IPN để hiển thị cho user/log
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

/**
 * Build URL thanh toán VNPAY từ thông tin đơn hàng
 *
 * Quy trình:
 * 1. Tập hợp các tham số theo chuẩn VNPAY 2.1.0
 * 2. Sắp xếp key theo alphabet
 * 3. Ký HMAC-SHA512 trên chuỗi query string đã sort
 * 4. Append chữ ký vào cuối URL
 *
 * @param input.amount - Số tiền VNĐ (sẽ ×100 thành đơn vị xu cho VNPAY)
 */
export function buildVNPayPaymentUrl(input: {
  orderId: number;
  amount: number;
  clientIp: string;
  bankCode?: VNPayBankCode;
}): string {
  const env = getEnv();
  const params: Record<string, string | number> = {
    vnp_Version:   "2.1.0",
    vnp_Command:   "pay",
    vnp_TmnCode:   env.VNPAY_TMN_CODE,
    vnp_Amount:    Math.round(input.amount * 100), // Đơn vị xu = VNĐ × 100
    vnp_CurrCode:  "VND",
    vnp_TxnRef:    String(input.orderId),          // Mã đơn hàng (dùng để tra cứu sau)
    vnp_OrderInfo: `Thanh toan don hang ${input.orderId}`,
    vnp_OrderType: "other",
    vnp_Locale:    "vn",
    vnp_ReturnUrl: env.VNPAY_RETURN_URL,           // URL VNPAY redirect user về sau thanh toán
    vnp_IpAddr:    input.clientIp,
    vnp_CreateDate: getVNPayCreateDate(),           // Thời gian tạo lệnh thanh toán (GMT+7)
  };

  // vnp_BankCode chỉ gửi nếu user chọn cụ thể (vd: INTCARD)
  if (input.bankCode) {
    params.vnp_BankCode = input.bankCode;
  }

  const sorted = sortObject(params);
  const signData = qs.stringify(sorted, { encode: false }); // Chuỗi cần ký
  const secureHash = hmacSha512(signData);                  // Tạo chữ ký

  return buildSignedUrl(sorted, secureHash);
}

/**
 * Xác minh chữ ký từ VNPAY Return URL hoặc IPN callback
 *
 * Cách hoạt động:
 * 1. Lấy vnp_SecureHash từ query params
 * 2. Xóa vnp_SecureHash và vnp_SecureHashType khỏi params
 * 3. Sắp xếp và ký lại với secret key cục bộ
 * 4. So sánh hash cục bộ với hash VNPAY gửi
 * → Nếu khớp: request không bị giả mạo (isValid = true)
 *
 * @param query - Toàn bộ query params từ VNPAY (req.query)
 */
export function verifyVNPayReturn(query: Record<string, string>): VNPayVerificationResult {
  const secureHash = query.vnp_SecureHash;

  // Không có chữ ký → request không hợp lệ
  if (!secureHash) {
    return {
      isValid: false, isSuccess: false, isCancelled: false,
      orderId: 0, amount: 0, responseCode: "97", message: "Chữ ký không hợp lệ",
    };
  }

  // Tạo bản sao và xóa 2 trường chữ ký trước khi verify
  const cloned = { ...query };
  delete cloned.vnp_SecureHash;
  delete cloned.vnp_SecureHashType;

  // Ký lại với secret key cục bộ theo cùng cách VNPAY đã ký
  const sorted = sortObject(cloned);
  const signData = qs.stringify(sorted, { encode: false });
  const localHash = hmacSha512(signData);

  // So sánh không phân biệt hoa thường (VNPAY đôi khi gửi uppercase)
  const isValid = localHash.toLowerCase() === secureHash.toLowerCase();
  const responseCode = query.vnp_ResponseCode ?? "99";
  const isCancelled = isValid && responseCode === "24"; // "24" = user tự hủy
  const isSuccess   = isValid && responseCode === "00"; // "00" = thành công

  return {
    isValid,
    isSuccess,
    isCancelled,
    orderId: Number(query.vnp_TxnRef ?? 0),
    amount:  Number(query.vnp_Amount ?? 0) / 100, // Chia 100 để về đơn vị VNĐ
    responseCode,
    message: vnpayMessage(responseCode),
  };
}
