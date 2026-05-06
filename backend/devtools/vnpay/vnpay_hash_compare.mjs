/**
 * VNPay Hash Method Comparison
 * Tests 4 different encoding approaches to find which one VNPay sandbox accepts.
 * Run: node vnpay_hash_compare.mjs
 */
import crypto from "crypto";
import qs from "qs";

const SECRET = "ESH5TONG7TCO4EPOGIOSM0R5KTFKW3OL";
const VNPAY_SANDBOX = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

// Use the exact params from the failing order #20
const sorted = {
  vnp_Amount:     "1500000000",
  vnp_Command:    "pay",
  vnp_CreateDate: "20260423182254",
  vnp_CurrCode:   "VND",
  vnp_IpAddr:     "127.0.0.1",
  vnp_Locale:     "vn",
  vnp_OrderInfo:  "ThanhToanDonHang_20_MaverikStore",
  vnp_OrderType:  "other",
  vnp_ReturnUrl:  "http://localhost:5000/api/v1/payments/vnpay/return",
  vnp_TmnCode:    "MF33CGUI",
  vnp_TxnRef:     "20",
  vnp_Version:    "2.1.0",
};

function hmac(data) {
  return crypto.createHmac("sha512", SECRET).update(Buffer.from(data, "utf-8")).digest("hex");
}

// PHP urlencode: same as encodeURIComponent except space→+ and tilde NOT encoded
function phpUrlencode(str) {
  return encodeURIComponent(String(str))
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

// ─── Method A: qs.stringify encode:false (current implementation) ──
const signA = qs.stringify(sorted, { encode: false });
const hashA = hmac(signA);

// ─── Method B: PHP urlencode on values only (keys are vnp_ = safe) ─
const signB = Object.entries(sorted).map(([k, v]) => `${k}=${phpUrlencode(v)}`).join("&");
const hashB = hmac(signB);

// ─── Method C: encodeURIComponent on values only ───────────────────
const signC = Object.entries(sorted).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
const hashC = hmac(signC);

// ─── Method D: qs default (full encoding) ─────────────────────────
const signD = qs.stringify(sorted);   // encode: true (default)
const hashD = hmac(signD);

// ─── Method E: Node's querystring module (older VNPay demos used this) ─
import { stringify as qsStringify } from "querystring";
const signE = qsStringify(sorted);   // Node built-in querystring
const hashE = hmac(signE);

console.log("╔═══════════════════════════════════════════════════════╗");
console.log("║        VNPay Hash Method Comparison                  ║");
console.log("╚═══════════════════════════════════════════════════════╝\n");

const methods = [
  { label: "A  qs.stringify({ encode: false }) [current]", sign: signA, hash: hashA },
  { label: "B  key=phpUrlencode(value)", sign: signB, hash: hashB },
  { label: "C  key=encodeURIComponent(value)", sign: signC, hash: hashC },
  { label: "D  qs.stringify() default (encode:true)", sign: signD, hash: hashD },
  { label: "E  Node querystring.stringify (legacy)", sign: signE, hash: hashE },
];

methods.forEach(({ label, sign, hash }) => {
  console.log(`【${label}】`);
  console.log("  signData:", sign);
  console.log("  hash    :", hash);
  console.log("  length  :", hash.length);
  console.log();
});

// Unique hashes?
const uniqueHashes = [...new Set(methods.map(m => m.hash))];
console.log(`\n  Unique hash values: ${uniqueHashes.length}`);
uniqueHashes.forEach((h, i) => console.log(`  ${i+1}. ${h}`));

// Build clickable test URLs (new order with current timestamp)
const now = new Date();
const gmt7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
const createDate = gmt7.getUTCFullYear().toString()
  + String(gmt7.getUTCMonth() + 1).padStart(2, "0")
  + String(gmt7.getUTCDate()).padStart(2, "0")
  + String(gmt7.getUTCHours()).padStart(2, "0")
  + String(gmt7.getUTCMinutes()).padStart(2, "0")
  + String(gmt7.getUTCSeconds()).padStart(2, "0");

const freshSorted = { ...sorted, vnp_CreateDate: createDate, vnp_TxnRef: "999" };

console.log("\n╔══════════════════════════════════════════════════════╗");
console.log("║  FRESH TEST URLs (createDate=" + createDate + ")  ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

// Fresh URL-A
const freshSignA = qs.stringify(freshSorted, { encode: false });
const freshHashA = hmac(freshSignA);
const urlA = `${VNPAY_SANDBOX}?${qs.stringify({ ...freshSorted, vnp_SecureHash: freshHashA }, { encode: false })}`;

// Fresh URL-B (encode values with PHP urlencode)
const freshSignB = Object.entries(freshSorted).map(([k, v]) => `${k}=${phpUrlencode(v)}`).join("&");
const freshHashB = hmac(freshSignB);
const urlB = `${VNPAY_SANDBOX}?` + Object.entries({ ...freshSorted, vnp_SecureHash: freshHashB }).map(([k, v]) => `${k}=${phpUrlencode(v)}`).join("&");

console.log("URL-A (current - encode:false):");
console.log(urlA);
console.log();
console.log("URL-B (PHP urlencode values):");
console.log(urlB);
console.log();
console.log("→ Open BOTH in browser. Whichever passes VNPay is the correct method.");
