import * as crypto from "crypto";
import * as qs from "qs";
import { getEnv } from "../config/env.config";

export function sortObject(obj: Record<string, any>): Record<string, string> {
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

export function getVNPayCreateDate(date?: Date): string {
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

export function hmacSha512(data: string): string {
  const secret = getEnv().VNPAY_HASH_SECRET.trim();
  return crypto.createHmac("sha512", secret).update(data, "utf-8").digest("hex");
}

export function buildSignedUrl(
  sorted: Record<string, string>,
  secureHash: string,
): string {
  return (
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?" +
    qs.stringify({ ...sorted, vnp_SecureHash: secureHash }, { encode: false })
  );
}

export function vnpayMessage(code: string): string {
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
