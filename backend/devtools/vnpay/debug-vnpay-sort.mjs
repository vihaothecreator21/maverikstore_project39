import crypto from "crypto";
import qs from "qs";

const TMN_CODE    = "MF33CGUI";
const HASH_SECRET = "LN6Q8B39MD9DC7368TP3CXM300VZVLIK";

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

// VNPay official Node.js sortObject implementation
function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj){
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(String(obj[str[key]])).replace(/%20/g, "+");
  }
  return sorted;
}

const sorted = sortObject(vnpParams);
const signData = qs.stringify(sorted, { encode: false });

const signed = crypto
  .createHmac("sha512", HASH_SECRET)
  .update(Buffer.from(signData, "utf-8"))
  .digest("hex");

console.log("signData:", signData);
console.log("hash:", signed);

const finalParams = { ...sorted, vnp_SecureHash: signed };
const finalUrl = `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?${qs.stringify(finalParams, { encode: false })}`;
console.log("\nfinalUrl:", finalUrl);
