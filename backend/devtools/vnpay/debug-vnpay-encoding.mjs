import crypto from "crypto";
import qs from "qs";

const TMN_CODE    = "MF33CGUI";
const HASH_SECRET = "LN6Q8B39MD9DC7368TP3CXM300VZVLIK";

// Test data
const vnpParams = {
  vnp_Version:    "2.1.0",
  vnp_Command:    "pay",
  vnp_TmnCode:    TMN_CODE,
  vnp_Locale:     "vn",
  vnp_CurrCode:   "VND",
  vnp_TxnRef:     "123",
  vnp_OrderInfo:  "Thanh toan don hang 123",
  vnp_OrderType:  "other",
  vnp_Amount:     15000000,
  vnp_ReturnUrl:  "http://localhost:5000/api/v1/payments/vnpay/return",
  vnp_IpAddr:     "127.0.0.1",
  vnp_CreateDate: "20260423165402",
};

// 1. Sort keys
function sortObject(obj) {
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return sorted;
}
const sorted = sortObject(vnpParams);

// 2. Build hashdata matching PHP's behavior exactly
// In PHP, urlencode() replaces spaces with '+' and encodes special chars.
// We can use encodeURIComponent and replace %20 with + if needed, or just let encodeURIComponent use %20 (which is rawurlencode in PHP).
// Let's use standard encodeURIComponent.
let signDataArray = [];
for (const [key, value] of Object.entries(sorted)) {
    if (value !== undefined && value !== null && value !== '') {
        signDataArray.push(key + '=' + encodeURIComponent(String(value)).replace(/%20/g, '+'));
    }
}
const signData = signDataArray.join('&');

const signed = crypto
  .createHmac("sha512", HASH_SECRET)
  .update(Buffer.from(signData, "utf-8"))
  .digest("hex");

console.log("signData (PHP-like):", signData);
console.log("hash (PHP-like):", signed);

// 3. Compare with qs.stringify({encode: false})
const signDataQsFalse = qs.stringify(sorted, { encode: false });
const signedQsFalse = crypto.createHmac("sha512", HASH_SECRET).update(Buffer.from(signDataQsFalse, "utf-8")).digest("hex");
console.log("\nsignData (qs encode:false):", signDataQsFalse);
console.log("hash (qs encode:false):", signedQsFalse);

// 4. Compare with qs.stringify({encode: true})
const signDataQsTrue = qs.stringify(sorted, { encode: true });
const signedQsTrue = crypto.createHmac("sha512", HASH_SECRET).update(Buffer.from(signDataQsTrue, "utf-8")).digest("hex");
console.log("\nsignData (qs encode:true):", signDataQsTrue);
console.log("hash (qs encode:true):", signedQsTrue);
