import * as crypto from "crypto";
import * as qs from "qs";
import { getEnv } from "../config/env.config";

export interface VNPayVerificationResult {
  isValid: boolean;
  isSuccess: boolean;
  isCancelled: boolean;
  orderId: number;
  amount: number;
  responseCode: string;
  message: string;
}

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

function hmacSha512(data: string): string {
  const secret = getEnv().VNPAY_HASH_SECRET.trim();
  return crypto.createHmac("sha512", secret).update(data, "utf-8").digest("hex");
}

function buildSignedUrl(sorted: Record<string, string>, secureHash: string): string {
  return (
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?" +
    qs.stringify({ ...sorted, vnp_SecureHash: secureHash }, { encode: false })
  );
}

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

export function buildVNPayPaymentUrl(input: {
  orderId: number;
  amount: number;
  clientIp: string;
}): string {
  const env = getEnv();
  const params: Record<string, string | number> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: env.VNPAY_TMN_CODE,
    vnp_Amount: Math.round(input.amount * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: String(input.orderId),
    vnp_OrderInfo: `Thanh toan don hang ${input.orderId}`,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: env.VNPAY_RETURN_URL,
    vnp_IpAddr: input.clientIp,
    vnp_CreateDate: getVNPayCreateDate(),
  };

  const sorted = sortObject(params);
  const signData = qs.stringify(sorted, { encode: false });
  const secureHash = hmacSha512(signData);

  return buildSignedUrl(sorted, secureHash);
}

export function verifyVNPayReturn(query: Record<string, string>): VNPayVerificationResult {
  const secureHash = query.vnp_SecureHash;

  if (!secureHash) {
    return {
      isValid: false,
      isSuccess: false,
      isCancelled: false,
      orderId: 0,
      amount: 0,
      responseCode: "97",
      message: "Chữ ký không hợp lệ",
    };
  }

  const cloned = { ...query };
  delete cloned.vnp_SecureHash;
  delete cloned.vnp_SecureHashType;

  const sorted = sortObject(cloned);
  const signData = qs.stringify(sorted, { encode: false });
  const localHash = hmacSha512(signData);

  const isValid = localHash.toLowerCase() === secureHash.toLowerCase();
  const responseCode = query.vnp_ResponseCode ?? "99";
  const isCancelled = isValid && responseCode === "24";
  const isSuccess = isValid && responseCode === "00";

  return {
    isValid,
    isSuccess,
    isCancelled,
    orderId: Number(query.vnp_TxnRef ?? 0),
    amount: Number(query.vnp_Amount ?? 0) / 100,
    responseCode,
    message: vnpayMessage(responseCode),
  };
}
