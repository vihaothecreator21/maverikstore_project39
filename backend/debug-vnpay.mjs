/**
 * Script debug VNPay — chạy: node debug-vnpay.mjs
 * In ra URL thanh toán để kiểm tra chữ ký
 */
import { VNPay, HashAlgorithm, ignoreLogger, ProductCode, VnpLocale } from "vnpay";
import crypto from "crypto";
import qs from "qs";

const TMN_CODE    = "MF33CGUI";
const HASH_SECRET = "LN6Q8B39MD9DC7368TP3CXM300VZVLIK";
const RETURN_URL  = "http://localhost:5000/api/v1/payments/vnpay/return";

// ── 1. Dùng vnpay npm library ─────────────────────────────────────
const vnpay = new VNPay({
  tmnCode:       TMN_CODE,
  secureSecret:  HASH_SECRET,
  vnpayHost:     "https://sandbox.vnpayment.vn",
  testMode:      true,
  hashAlgorithm: HashAlgorithm.SHA512,
  enableLog:     false,
  loggerFn:      ignoreLogger,
});

const libUrl = vnpay.buildPaymentUrl({
  vnp_Amount:    150000,            // 150,000 VNĐ (library * 100 = 15,000,000)
  vnp_IpAddr:    "127.0.0.1",
  vnp_TxnRef:    "1",
  vnp_OrderInfo: "Thanh toan don hang 1 Maverik Store", // Không có # hoặc ký tự đặc biệt
  vnp_OrderType: ProductCode.Other,
  vnp_ReturnUrl: RETURN_URL,
  vnp_Locale:    VnpLocale.VN,
});

console.log("\n=== URL từ vnpay library ===");
console.log(libUrl);
const libParams = new URL(libUrl);
console.log("\nvnp_SecureHash (library):", libParams.searchParams.get("vnp_SecureHash"));
console.log("vnp_Amount (library):", libParams.searchParams.get("vnp_Amount"));
console.log("vnp_OrderInfo (library):", libParams.searchParams.get("vnp_OrderInfo"));

// ── 2. Dùng cách thủ công theo VNPay NodeJS official demo ─────────
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = obj[key];
  }
  return sorted;
}

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const createDate =
  now.getFullYear() +
  pad(now.getMonth() + 1) +
  pad(now.getDate()) +
  pad(now.getHours()) +
  pad(now.getMinutes()) +
  pad(now.getSeconds());

const manualParams = {
  vnp_Version:   "2.1.0",
  vnp_Command:   "pay",
  vnp_TmnCode:   TMN_CODE,
  vnp_Locale:    "vn",
  vnp_CurrCode:  "VND",
  vnp_TxnRef:    "1",
  vnp_OrderInfo: "Thanh toan don hang 1 Maverik Store",
  vnp_OrderType: "other",
  vnp_Amount:    150000 * 100,  // Manual: phải nhân 100
  vnp_ReturnUrl: RETURN_URL,
  vnp_IpAddr:    "127.0.0.1",
  vnp_CreateDate: createDate,
};

const sortedManual = sortObject(manualParams);
const signData = qs.stringify(sortedManual, { encode: false });
const hmac = crypto.createHmac("sha512", HASH_SECRET);
const manualHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

console.log("\n=== Hash thủ công (theo VNPay NodeJS demo) ===");
console.log("signData:", signData.substring(0, 200), "...");
console.log("manualHash:", manualHash);

// ── 3. So sánh ────────────────────────────────────────────────────
// Lấy hash data mà library dùng (từ URL search params)
const libSearchStr = new URL(libUrl).search.slice(1);
// Xóa vnp_SecureHash ra khỏi search string để so sánh
const libParamsNoHash = new URLSearchParams(libSearchStr);
libParamsNoHash.delete("vnp_SecureHash");
const libHashData = libParamsNoHash.toString();

console.log("\n=== Hash data (library URLSearchParams) ===");
console.log(libHashData.substring(0, 200), "...");

console.log("\n=== So sánh hash data ===");
console.log("Library (encoded):", libHashData.substring(0, 100));
console.log("Manual (non-encoded):", signData.substring(0, 100));
console.log("Match:", libHashData === signData);
console.log("\n=> Nếu không match, đây là nguyên nhân lỗi 'Sai chữ ký'");
