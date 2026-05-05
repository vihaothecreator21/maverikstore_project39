/**
 * VNPay Signature Debug Script
 * Chạy: node vnpay_debug.mjs
 *
 * Script này tái tạo chính xác cách buildVNPayUrl() tính hash
 * và in ra toàn bộ thông tin để so sánh với VNPay.
 */
import crypto from "crypto";

// ─── CONFIG (khớp với .env) ───────────────────────────────────────────────────
const TMN_CODE   = "MF33CGUI";
const HASH_SECRET = "LN6Q8B39MD9DC7368TP3CXM300VZVLIK";
const RETURN_URL = "http://localhost:5000/api/v1/payments/vnpay/return";

// ─── TEST PARAMS (thay orderId và amount theo đơn hàng bạn đang test) ─────────
const TEST_ORDER_ID = "1";           // <-- thay ID đơn hàng
const TEST_AMOUNT   = 50000;        // <-- thay số tiền (đơn vị VNĐ, chưa * 100)
const TEST_IP       = "127.0.0.1";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function sortObject(obj) {
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v !== "" && v !== undefined && v !== null) {
      sorted[key] = String(v);
    }
  }
  return sorted;
}

function getVNPayCreateDate(date) {
  const now  = date ?? new Date();
  const gmt7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const y  = gmt7.getUTCFullYear();
  const mo = String(gmt7.getUTCMonth() + 1).padStart(2, "0");
  const d  = String(gmt7.getUTCDate()).padStart(2, "0");
  const h  = String(gmt7.getUTCHours()).padStart(2, "0");
  const mi = String(gmt7.getUTCMinutes()).padStart(2, "0");
  const s  = String(gmt7.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${d}${h}${mi}${s}`;
}

// Manual stringify (không dùng qs library để loại trừ lỗi import)
function manualStringify(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

// ─── BUILD PARAMS ─────────────────────────────────────────────────────────────
const createDate = getVNPayCreateDate();
const orderInfo  = `ThanhToanDonHang_${TEST_ORDER_ID}_MaverikStore`;

const vnpParams = {
  vnp_Version:    "2.1.0",
  vnp_Command:    "pay",
  vnp_TmnCode:    TMN_CODE,
  vnp_Locale:     "vn",
  vnp_CurrCode:   "VND",
  vnp_TxnRef:     TEST_ORDER_ID,
  vnp_OrderInfo:  orderInfo,
  vnp_OrderType:  "other",
  vnp_Amount:     Math.round(TEST_AMOUNT * 100),
  vnp_ReturnUrl:  RETURN_URL,
  vnp_IpAddr:     TEST_IP,
  vnp_CreateDate: createDate,
};

const sorted   = sortObject(vnpParams);
const signData = manualStringify(sorted);

const signed = crypto
  .createHmac("sha512", HASH_SECRET)
  .update(Buffer.from(signData, "utf-8"))
  .digest("hex");

// ─── OUTPUT ───────────────────────────────────────────────────────────────────
console.log("\n╔══════════════════════════════════════════════╗");
console.log("║         VNPay Signature Debug Tool          ║");
console.log("╚══════════════════════════════════════════════╝\n");

console.log("📋 Config:");
console.log("  TMN_CODE   :", TMN_CODE);
console.log("  HASH_SECRET:", HASH_SECRET);
console.log("  RETURN_URL :", RETURN_URL);
console.log("");

console.log("📦 Sorted Params (theo thứ tự alphabet — QUAN TRỌNG):");
Object.entries(sorted).forEach(([k, v], i) => {
  console.log(`  ${String(i+1).padStart(2)}. ${k} = ${v}`);
});
console.log("");

console.log("🔑 signData (chuỗi để hash):");
console.log(" ", signData);
console.log("");

console.log("🔐 HMAC-SHA512 Hash:");
console.log(" ", signed);
console.log("");

// ─── BUILD FINAL URL ──────────────────────────────────────────────────────────
const finalParams = { ...sorted, vnp_SecureHash: signed };
const queryString = manualStringify(finalParams);
const paymentUrl  = `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?${queryString}`;

console.log("🌐 Payment URL:");
console.log(" ", paymentUrl);
console.log("");

// ─── SELF-VERIFY (giả lập VNPay verify lại) ──────────────────────────────────
console.log("🔁 Self-Verify (giả lập VNPay server verify):");
const receivedParams = Object.fromEntries(new URLSearchParams(queryString));
const receivedHash = receivedParams["vnp_SecureHash"];
const verifyParams = {};
for (const [k, v] of Object.entries(receivedParams)) {
  if (k.startsWith("vnp_") && k !== "vnp_SecureHash" && k !== "vnp_SecureHashType") {
    verifyParams[k] = v;
  }
}
const verifySorted   = sortObject(verifyParams);
const verifySignData = manualStringify(verifySorted);
const verifySigned   = crypto
  .createHmac("sha512", HASH_SECRET)
  .update(Buffer.from(verifySignData, "utf-8"))
  .digest("hex");

console.log("  Received hash  :", receivedHash);
console.log("  Computed hash  :", verifySigned);
console.log("  Match?         :", receivedHash === verifySigned ? "✅ YES" : "❌ NO — BUG FOUND!");

if (receivedHash !== verifySigned) {
  console.log("\n  ⚠️  signData khi create :", signData);
  console.log("  ⚠️  signData khi verify :", verifySignData);
  if (signData !== verifySignData) {
    console.log("\n  ❌ HAI CHUỖI KHÁC NHAU! Nguyên nhân lỗi là URL encode thay đổi params.");
  }
}

console.log("\n══════════════════════════════════════════════════\n");
